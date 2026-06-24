// surface-config.test.ts — DB-0 (arrakis-ojm0) · default-OFF safety.
//
// Proves the SHIPS-DARK contract: with no RAILWAY_MIBERA_DATABASE_URL the read-shim returns
// null, and buildVerifyCardForWorld therefore renders the EXACT code-constant card that
// buildVerifyCard() (no opts) renders today. Byte-identical.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { Pool } from 'pg';
import { getSurfaceConfig, type SurfaceConfig } from './surface-config.ts';
import { buildVerifyCard, buildVerifyCardForWorld } from './verify-card.ts';

// A fake pg client/pool that records query calls + whether the client was released, so we can
// prove the BB #180 HIGH fix: the connection is ALWAYS released (no pool leak), on success and
// on error, and statement_timeout is set DB-side rather than an abandon-but-keep-running race.
function makeFakeClient(opts: { rows?: unknown[]; throwOnSelect?: boolean }) {
  const calls: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      const head = typeof sql === 'string' ? sql.trim().split('\n')[0] : 'OBJ';
      calls.push(head);
      if (opts.throwOnSelect && head.startsWith('SELECT')) throw new Error('boom');
      if (head.startsWith('SELECT')) return { rows: opts.rows ?? [] };
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };
  return { client, calls, isReleased: () => released };
}
function fakePool(fc: { client: unknown }): Pool {
  return { connect: async () => fc.client } as unknown as Pool;
}

describe('surface-config DB-0 default-OFF', () => {
  let savedUrl: string | undefined;

  beforeEach(() => {
    savedUrl = process.env.RAILWAY_MIBERA_DATABASE_URL;
    // Force the "no DB" path — getPool() returns null when the URL is unset.
    delete process.env.RAILWAY_MIBERA_DATABASE_URL;
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.RAILWAY_MIBERA_DATABASE_URL;
    else process.env.RAILWAY_MIBERA_DATABASE_URL = savedUrl;
  });

  test('getSurfaceConfig returns null when no DB is configured (fail-soft)', async () => {
    const cfg = await getSurfaceConfig('mibera', 'onboarding:verify');
    expect(cfg).toBeNull();
  });

  test('buildVerifyCardForWorld renders the byte-identical default card with no config', async () => {
    const live = await buildVerifyCardForWorld('mibera');
    const codeDefault = buildVerifyCard();
    expect(JSON.stringify(live)).toBe(JSON.stringify(codeDefault));
  });

  test('default card carries the unchanged custom_id (onboard:verify untouched)', async () => {
    const live = (await buildVerifyCardForWorld('mibera'))[0] as {
      components: Array<{ type: number; components?: Array<{ custom_id?: string }> }>;
    };
    const row = live.components.find((b) => b.type === 1)!;
    expect(row.components![0]!.custom_id).toBe('onboard:verify');
  });
});

describe('surface-config connection lifecycle (BB #180 HIGH — no pool leak)', () => {
  test('enabled row: BEGIN + SET LOCAL statement_timeout + SELECT + COMMIT, client released', async () => {
    const fc = makeFakeClient({ rows: [{ enabled: true, copy: { title: 'hi' }, template_json: null }] });
    const cfg = await getSurfaceConfig('mibera', 'onboarding:verify', fakePool(fc));
    expect(cfg).toEqual({ enabled: true, copy: { title: 'hi' }, template_json: null });
    expect(fc.calls).toContain('BEGIN');
    expect(fc.calls.some((c) => c.startsWith('SET LOCAL statement_timeout'))).toBe(true);
    expect(fc.calls).toContain('COMMIT');
    expect(fc.isReleased()).toBe(true); // released on success
  });

  test('query throws → ROLLBACK + client STILL released (the leak fix) → null', async () => {
    const fc = makeFakeClient({ throwOnSelect: true });
    const cfg = await getSurfaceConfig('mibera', 'onboarding:verify', fakePool(fc));
    expect(cfg).toBeNull();
    expect(fc.calls).toContain('ROLLBACK');
    expect(fc.isReleased()).toBe(true); // released despite the throw — no checked-out connection lingers
  });

  test('null pool override short-circuits to null without connecting', async () => {
    const cfg = await getSurfaceConfig('mibera', 'onboarding:verify', null);
    expect(cfg).toBeNull();
  });
});

describe('verify-card CM-copy key narrowing (BB #180 MEDIUM)', () => {
  const enabledWith = (copy: Record<string, string>) =>
    (async () => ({ enabled: true, copy, template_json: null }) as SurfaceConfig);

  test('only VerifyCardOpts keys are applied; unknown keys are ignored (not silently rendered)', async () => {
    const live = (await buildVerifyCardForWorld('mibera', enabledWith({ title: 'custom title', header: 'WRONG KEY' })))[0] as {
      components: Array<{ type: number; content?: string }>;
    };
    const heading = live.components.find((c) => typeof c.content === 'string' && c.content!.startsWith('## '));
    expect(heading!.content).toBe('## custom title'); // valid key applied
    // the unknown 'header' key did not leak into the card (would-be silent partial fallback)
    expect(JSON.stringify(live)).not.toContain('WRONG KEY');
  });

  test('unknown keys are surfaced via console.warn', async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => warnings.push(a.join(' '));
    try {
      await buildVerifyCardForWorld('mibera', enabledWith({ header: 'oops', body: 'ok' }));
    } finally {
      console.warn = orig;
    }
    expect(warnings.some((w) => w.includes('header') && w.includes('not in VerifyCardOpts'))).toBe(true);
  });
});
