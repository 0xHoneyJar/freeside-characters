// surface-config.test.ts — DB-0 (arrakis-ojm0) · default-OFF safety.
//
// Proves the SHIPS-DARK contract: with no RAILWAY_MIBERA_DATABASE_URL the read-shim returns
// null, and buildVerifyCardForWorld therefore renders the EXACT code-constant card that
// buildVerifyCard() (no opts) renders today. Byte-identical.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getSurfaceConfig } from './surface-config.ts';
import { buildVerifyCard, buildVerifyCardForWorld } from './verify-card.ts';

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
