// Phase 39B · dev-only Recall Wedge demo command regression + static-guard
// gate. Authority: docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md
// (Phase 39A §D–§N).
//
// What these tests prove (Phase 39A §L · plus the Phase 39B Codex PATCH):
//   - disabled by default; exact "true" enables; near-truthy values do NOT;
//   - wrong / missing guild fails closed; non-operator fails closed; empty
//     operator allowlist fails closed;
//   - allowed operator in allowed guild succeeds when enabled;
//   - every response is ephemeral (no channel-visible path);
//   - disabled / wrong-guild / non-operator refusals share ONE generic
//     string and pass the §I banned-substring scan;
//   - success renders the public_discord_simulated frame + safe framing only;
//   - success does NOT expose operator_dev diagnostics;
//   - final output passes the banned-substring scan; contaminated output
//     falls back to the generic ephemeral refusal;
//   - no freeform memory / recall query option is read;
//   - the Phase 38A harness is LAZILY loaded — refused paths never load it;
//     the success path does; a harness load failure after the gates pass
//     fails closed to the generic ephemeral refusal (Codex PATCH §2);
//   - static guards: no deep app-to-package relative import; harness reached
//     only through the authorized package subpath; no live Dixie client /
//     runner import; no live network primitive (incl. node:tls / tls); no
//     child_process; no Telegram / private-chat / storage / Finn / LLM
//     import; no memory-admission / candidate-write / "remember this"
//     strings; render-public-recall.ts + dixie-envelope-adapter.ts + the
//     Phase 38A harness source/tests are not imported or mutated;
//   - registration helper is gated by the exact-"true" env posture;
//   - registration is NOT globally wired this phase.

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MessageFlags, type DiscordInteraction } from './types.ts';
import {
  RECALL_WEDGE_DEMO_COMMAND_NAME,
  RECALL_WEDGE_DEMO_GENERIC_REFUSAL,
  RECALL_WEDGE_DEMO_SELECTOR_OPTION,
  buildRecallWedgeDemoInput,
  handleRecallWedgeDemoInteraction,
  isRecallWedgeDiscordDemoAllowedGuild,
  isRecallWedgeDiscordDemoOperator,
  parseRecallWedgeDiscordDemoOperatorIds,
  readRecallWedgeDemoSelector,
  recallWedgeDemoRefusal,
  renderRecallWedgeDemoContent,
  shouldEnableRecallWedgeDiscordDemo,
  shouldRegisterRecallWedgeDiscordDemo,
  type RecallWedgeHarnessModule,
} from './recall-wedge-demo.ts';
// Harness reached through the AUTHORIZED package subpath (Codex PATCH §1/§3) —
// NOT a deep relative import that climbs into the package's src tree. Used
// here only for the test's own assertions + to feed the injected harness seam.
import {
  MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS,
  findMultiSurfaceBannedSubstring,
  projectAcrossMultiSurfaceFrames,
} from '@freeside-characters/persona-engine/recall-wedge/multi-surface-recall-harness';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GUILD = 'guild-allowed-123';
const OPERATOR = 'operator-user-456';
const OTHER_GUILD = 'guild-other-999';
const OTHER_USER = 'user-other-789';

// The real Phase 38A harness surface, injected via the `loadHarness` seam so
// success-path tests are deterministic and so we can assert load-vs-no-load.
const REAL_HARNESS: RecallWedgeHarnessModule = {
  projectAcrossMultiSurfaceFrames,
  findMultiSurfaceBannedSubstring,
};

function fullEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    RECALL_WEDGE_DISCORD_DEMO_ENABLED: 'true',
    RECALL_WEDGE_DISCORD_DEMO_GUILD_ID: GUILD,
    RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS: OPERATOR,
    ...overrides,
  };
}

function interaction(
  overrides: Partial<DiscordInteraction> = {},
): DiscordInteraction {
  return {
    type: 2,
    id: 'interaction-id',
    application_id: 'app-id',
    token: 'tok',
    guild_id: GUILD,
    channel_id: 'chan',
    member: { user: { id: OPERATOR, username: 'op' } },
    data: { id: 'cmd', name: RECALL_WEDGE_DEMO_COMMAND_NAME },
    ...overrides,
  };
}

/**
 * A counting `loadHarness` seam: records how many times it is invoked so a
 * test can prove a refused path never loads the harness. Returns the real
 * harness surface so the success path renders genuine Phase 38A output.
 */
function countingHarnessLoader(): {
  load: () => Promise<RecallWedgeHarnessModule>;
  calls: () => number;
} {
  let calls = 0;
  return {
    load: async () => {
      calls += 1;
      return REAL_HARNESS;
    },
    calls: () => calls,
  };
}

// -- 1. env gate helpers --------------------------------------------------

describe('Phase 39B · env gate · enable (exact "true")', () => {
  test('enabled only by the exact string "true"', () => {
    expect(
      shouldEnableRecallWedgeDiscordDemo({
        RECALL_WEDGE_DISCORD_DEMO_ENABLED: 'true',
      }),
    ).toBe(true);
  });

  test('disabled by default (missing var)', () => {
    expect(shouldEnableRecallWedgeDiscordDemo({})).toBe(false);
  });

  test.each(['TRUE', 'True', '1', 'yes', ' true', 'true ', 'truthy', ''])(
    'near-truthy value %p does NOT enable',
    (value) => {
      expect(
        shouldEnableRecallWedgeDiscordDemo({
          RECALL_WEDGE_DISCORD_DEMO_ENABLED: value,
        }),
      ).toBe(false);
    },
  );
});

describe('Phase 39B · env gate · register (exact "true")', () => {
  test('registration enabled only by exact "true"', () => {
    expect(
      shouldRegisterRecallWedgeDiscordDemo({
        RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS: 'true',
      }),
    ).toBe(true);
  });

  test.each(['TRUE', 'True', '1', 'yes', undefined as unknown as string, ''])(
    'register value %p does NOT enable',
    (value) => {
      expect(
        shouldRegisterRecallWedgeDiscordDemo({
          RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS: value,
        }),
      ).toBe(false);
    },
  );
});

describe('Phase 39B · env gate · operator allowlist parsing', () => {
  test('missing var → empty list (fails closed)', () => {
    expect(parseRecallWedgeDiscordDemoOperatorIds({})).toEqual([]);
  });

  test('blank var → empty list', () => {
    expect(
      parseRecallWedgeDiscordDemoOperatorIds({
        RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS: '   ',
      }),
    ).toEqual([]);
  });

  test('comma-separated, trimmed, empties dropped', () => {
    expect(
      parseRecallWedgeDiscordDemoOperatorIds({
        RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS: ' a , b ,, c ',
      }),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('Phase 39B · guild gate', () => {
  test('matching guild passes', () => {
    expect(
      isRecallWedgeDiscordDemoAllowedGuild(interaction(), fullEnv()),
    ).toBe(true);
  });

  test('wrong guild fails closed', () => {
    expect(
      isRecallWedgeDiscordDemoAllowedGuild(
        interaction({ guild_id: OTHER_GUILD }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test('missing guild_id (DM) fails closed', () => {
    expect(
      isRecallWedgeDiscordDemoAllowedGuild(
        interaction({ guild_id: undefined }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test('missing configured guild id fails closed', () => {
    expect(
      isRecallWedgeDiscordDemoAllowedGuild(
        interaction(),
        fullEnv({ RECALL_WEDGE_DISCORD_DEMO_GUILD_ID: undefined }),
      ),
    ).toBe(false);
  });
});

describe('Phase 39B · operator gate', () => {
  test('operator in allowlist passes', () => {
    expect(isRecallWedgeDiscordDemoOperator(interaction(), fullEnv())).toBe(
      true,
    );
  });

  test('reads user.id when invoked in a DM shape', () => {
    expect(
      isRecallWedgeDiscordDemoOperator(
        interaction({ member: undefined, user: { id: OPERATOR, username: 'op' } }),
        fullEnv(),
      ),
    ).toBe(true);
  });

  test('non-operator fails closed', () => {
    expect(
      isRecallWedgeDiscordDemoOperator(
        interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test('empty allowlist fails closed', () => {
    expect(
      isRecallWedgeDiscordDemoOperator(
        interaction(),
        fullEnv({ RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
      ),
    ).toBe(false);
  });
});

// -- 2. handler gating ----------------------------------------------------

describe('Phase 39B · handler fail-closed gating', () => {
  test('disabled by default → generic ephemeral refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(interaction(), {});
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test.each(['TRUE', 'True', '1', 'yes', ' true'])(
    'enabled value %p does NOT enable the handler',
    async (value) => {
      const res = await handleRecallWedgeDemoInteraction(
        interaction(),
        fullEnv({ RECALL_WEDGE_DISCORD_DEMO_ENABLED: value }),
      );
      expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
    },
  );

  test('wrong guild → generic refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction({ guild_id: OTHER_GUILD }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
  });

  test('missing guild → generic refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction({ guild_id: undefined }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
  });

  test('non-operator → generic refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
  });

  test('empty operator allowlist → generic refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction(),
      fullEnv({ RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
  });

  test('disabled / wrong-guild / non-operator all share ONE generic string', async () => {
    const disabled = await handleRecallWedgeDemoInteraction(interaction(), {});
    const wrongGuild = await handleRecallWedgeDemoInteraction(
      interaction({ guild_id: OTHER_GUILD }),
      fullEnv(),
    );
    const nonOperator = await handleRecallWedgeDemoInteraction(
      interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
      fullEnv(),
    );
    expect(disabled.data?.content).toBe(wrongGuild.data?.content);
    expect(wrongGuild.data?.content).toBe(nonOperator.data?.content);
  });

  test('every refusal path is ephemeral', async () => {
    for (const res of [
      await handleRecallWedgeDemoInteraction(interaction(), {}),
      await handleRecallWedgeDemoInteraction(
        interaction({ guild_id: OTHER_GUILD }),
        fullEnv(),
      ),
      await handleRecallWedgeDemoInteraction(
        interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
        fullEnv(),
      ),
      recallWedgeDemoRefusal(),
    ]) {
      expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    }
  });

  test('refusal string passes the banned-substring scan', () => {
    for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
      expect(RECALL_WEDGE_DEMO_GENERIC_REFUSAL).not.toContain(banned);
    }
  });
});

// -- 2b. lazy-load posture (Codex PATCH §2) -------------------------------

describe('Phase 39B · harness is lazily loaded after gates', () => {
  test('disabled path does NOT load the harness', async () => {
    const loader = countingHarnessLoader();
    await handleRecallWedgeDemoInteraction(interaction(), {}, {
      loadHarness: loader.load,
    });
    expect(loader.calls()).toBe(0);
  });

  test('wrong-guild path does NOT load the harness', async () => {
    const loader = countingHarnessLoader();
    await handleRecallWedgeDemoInteraction(
      interaction({ guild_id: OTHER_GUILD }),
      fullEnv(),
      { loadHarness: loader.load },
    );
    expect(loader.calls()).toBe(0);
  });

  test('non-operator path does NOT load the harness', async () => {
    const loader = countingHarnessLoader();
    await handleRecallWedgeDemoInteraction(
      interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
      fullEnv(),
      { loadHarness: loader.load },
    );
    expect(loader.calls()).toBe(0);
  });

  test('enabled + allowed path DOES load the harness and succeeds', async () => {
    const loader = countingHarnessLoader();
    const res = await handleRecallWedgeDemoInteraction(interaction(), fullEnv(), {
      loadHarness: loader.load,
    });
    expect(loader.calls()).toBe(1);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('public_discord_simulated');
  });

  test('harness load failure after gates pass → generic ephemeral refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(interaction(), fullEnv(), {
      loadHarness: async () => {
        throw new Error('simulated harness load failure');
      },
    });
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test('default loader (real dynamic import) succeeds when gates pass', async () => {
    // No injected loader — exercises defaultLoadHarness's dynamic import of
    // the authorized package subpath.
    const res = await handleRecallWedgeDemoInteraction(interaction(), fullEnv());
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('public_discord_simulated');
  });
});

// -- 3. handler success ---------------------------------------------------

describe('Phase 39B · handler success (enabled + allowed)', () => {
  const env = fullEnv();
  const withHarness = { loadHarness: async () => REAL_HARNESS };

  test('allowed operator in allowed guild succeeds, ephemeral', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction(),
      env,
      withHarness,
    );
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('public_discord_simulated');
    expect(res.data?.content).toContain('fixture-bound dev demo');
  });

  test('success renders the public_discord_simulated frame text', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction(),
      env,
      withHarness,
    );
    expect(res.data?.content).toContain(
      '[recall · public_discord_simulated · served]',
    );
  });

  test('success does NOT expose operator_dev diagnostics', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction(),
      env,
      withHarness,
    );
    const content = res.data?.content ?? '';
    expect(content).not.toContain('operator_dev');
    expect(content).not.toContain('INTERNAL/operator-only');
    expect(content).not.toContain('operator_diagnostic');
  });

  test('success output passes the banned-substring scan', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction(),
      env,
      withHarness,
    );
    const content = res.data?.content ?? '';
    for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
      expect(content).not.toContain(banned);
    }
  });

  test('denied selector renders a refusal frame (still ephemeral, no leak)', async () => {
    const res = await handleRecallWedgeDemoInteraction(
      interaction({
        data: {
          id: 'cmd',
          name: RECALL_WEDGE_DEMO_COMMAND_NAME,
          options: [
            { name: RECALL_WEDGE_DEMO_SELECTOR_OPTION, type: 3, value: 'denied' },
          ],
        },
      }),
      env,
      withHarness,
    );
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('public_discord_simulated');
    const content = res.data?.content ?? '';
    for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
      expect(content).not.toContain(banned);
    }
  });

  test('contaminated success content falls back to generic ephemeral refusal', async () => {
    const res = await handleRecallWedgeDemoInteraction(interaction(), env, {
      loadHarness: async () => REAL_HARNESS,
      // Inject a builder that leaks a banned substring — the final no-leak
      // scan must catch it and fall back to the generic refusal.
      buildSuccessContent: () => 'leak: session_id=abc123 PRIVATE_SENTINEL',
    });
    expect(res.data?.content).toBe(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test('clean injected content is delivered as-is (scan passes)', async () => {
    const res = await handleRecallWedgeDemoInteraction(interaction(), env, {
      loadHarness: async () => REAL_HARNESS,
      buildSuccessContent: () => 'clean dev-demo content',
    });
    expect(res.data?.content).toBe('clean dev-demo content');
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });
});

// -- 4. selector / input source ------------------------------------------

describe('Phase 39B · input source (fixed enum selector only)', () => {
  test('default selector is "served"', () => {
    expect(readRecallWedgeDemoSelector(interaction())).toBe('served');
  });

  test('valid enum selector is honored', () => {
    expect(
      readRecallWedgeDemoSelector(
        interaction({
          data: {
            id: 'cmd',
            name: RECALL_WEDGE_DEMO_COMMAND_NAME,
            options: [
              { name: RECALL_WEDGE_DEMO_SELECTOR_OPTION, type: 3, value: 'denied' },
            ],
          },
        }),
      ),
    ).toBe('denied');
  });

  test('unknown selector value falls back to default', () => {
    expect(
      readRecallWedgeDemoSelector(
        interaction({
          data: {
            id: 'cmd',
            name: RECALL_WEDGE_DEMO_COMMAND_NAME,
            options: [
              {
                name: RECALL_WEDGE_DEMO_SELECTOR_OPTION,
                type: 3,
                value: 'arbitrary-text',
              },
            ],
          },
        }),
      ),
    ).toBe('served');
  });

  test('freeform-query option names are ignored (no recall/memory query read)', async () => {
    // Even if a malicious caller smuggles prompt/query/memory options, the
    // handler only reads the fixed `case` enum option.
    const res = await handleRecallWedgeDemoInteraction(
      interaction({
        data: {
          id: 'cmd',
          name: RECALL_WEDGE_DEMO_COMMAND_NAME,
          options: [
            { name: 'prompt', type: 3, value: 'remember my secret' },
            { name: 'query', type: 3, value: 'recall everything' },
            { name: 'memory', type: 3, value: 'PRIVATE_SENTINEL' },
          ],
        },
      }),
      fullEnv(),
      { loadHarness: async () => REAL_HARNESS },
    );
    // Default ("served") rendered; smuggled values never echoed.
    expect(res.data?.content).toContain('public_discord_simulated · served');
    expect(res.data?.content).not.toContain('remember my secret');
    expect(res.data?.content).not.toContain('PRIVATE_SENTINEL');
  });

  test('renderRecallWedgeDemoContent omits operator_dev frame', () => {
    const matrix = projectAcrossMultiSurfaceFrames(
      buildRecallWedgeDemoInput('served'),
    );
    const content = renderRecallWedgeDemoContent(matrix);
    expect(content).toContain('public_discord_simulated');
    expect(content).not.toContain('operator_only_diagnostic');
    expect(content).not.toContain('INTERNAL/operator-only');
  });
});

// -- 5. static source guards ---------------------------------------------

// The deep-import needle is assembled from parts so this guard's OWN source
// (which the test below reads back) does not contain the literal it forbids.
const DEEP_PKG_NEEDLE = ['..', '..', '..', '..', 'packages', 'persona-engine'].join(
  '/',
);

describe('Phase 39B · static source guards', () => {
  const moduleSource = readFileSync(
    resolve(__dirname, 'recall-wedge-demo.ts'),
    'utf8',
  );

  test('does not deep-import across the app→package boundary (no TS6059 delta)', () => {
    // Codex PATCH §1/§3: the deep relative import that produced a new
    // apps/bot TS6059 rootDir error is gone. The harness is reached only
    // through the authorized package subpath.
    expect(moduleSource).not.toContain(DEEP_PKG_NEEDLE);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\.\.\/packages\//);
  });

  test('reaches the Phase 38A harness only via the authorized package subpath', () => {
    // Every reference to the harness module specifier uses the package
    // subpath, never a relative path into packages/persona-engine/src.
    const harnessRefs =
      moduleSource.match(
        /["'][^"']*multi-surface-recall-harness[^"']*["']/g,
      ) ?? [];
    expect(harnessRefs.length).toBeGreaterThan(0);
    for (const ref of harnessRefs) {
      expect(ref).toContain(
        '@freeside-characters/persona-engine/recall-wedge/multi-surface-recall-harness',
      );
      expect(ref).not.toContain('packages/persona-engine');
      expect(ref).not.toContain('../');
    }
  });

  test('only static import of the harness specifier is type-only', () => {
    // The runtime dependency is the dynamic import() inside defaultLoadHarness;
    // the static import of the harness subpath specifier must be `import type`
    // so the harness is NOT evaluated at module load.
    expect(moduleSource).toMatch(
      /import\s+type\s*\{[^}]*\}\s*from\s+["']@freeside-characters\/persona-engine\/recall-wedge\/multi-surface-recall-harness["']/,
    );
    // And there is a dynamic import() of the same subpath for lazy loading.
    expect(moduleSource).toMatch(
      /import\(\s*[\s\n]*["']@freeside-characters\/persona-engine\/recall-wedge\/multi-surface-recall-harness["']/,
    );
  });

  test('does not import the Phase 37C live Dixie client', () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*live-dixie-client[^"']*["']/,
    );
  });

  test('does not import the Phase 37C live Dixie runner', () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
  });

  test('does not import render-public-recall or dixie-envelope-adapter', () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
  });

  test('does not import Telegram / private-chat clients', () => {
    expect(moduleSource).not.toMatch(/from\s+["']telegraf["']/);
    expect(moduleSource).not.toMatch(/from\s+["']grammy["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*telegram[^"']*["']/i);
  });

  test('does not import or dynamic-import a private-chat module', () => {
    // Codex PATCH §3: explicit private-chat import-syntax guards (both
    // hyphen + underscore spellings, static and dynamic forms). Targets
    // import/runtime syntax, NOT prose comments.
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*private[-_]chat[^"']*["']/i,
    );
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*private[-_]chat[^"']*["']/i,
    );
    // No private-chat client-ish runtime identifier (call / construction).
    expect(moduleSource).not.toMatch(/\bprivateChat[A-Za-z]*\s*\(/);
    expect(moduleSource).not.toMatch(/\bnew\s+PrivateChat[A-Za-z]*\s*\(/);
  });

  test('does not import storage clients', () => {
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
    expect(moduleSource).not.toMatch(/from\s+["']redis["']/);
    expect(moduleSource).not.toMatch(/from\s+["']ioredis["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@aws-sdk\/[^"']+["']/);
  });

  test('does not import Finn / @loa/dixie / @loa/straylight', () => {
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
  });

  test('does not import an LLM SDK / Claude Agent SDK', () => {
    expect(moduleSource).not.toMatch(/from\s+["']@anthropic-ai\/[^"']+["']/);
    expect(moduleSource).not.toMatch(/from\s+["']openai["']/);
  });

  test('contains no fetch / low-level network primitives', () => {
    expect(moduleSource).not.toMatch(/\bfetch\s*\(/);
    expect(moduleSource).not.toMatch(/globalThis\.fetch/);
    expect(moduleSource).not.toMatch(/\bundici\b/);
    expect(moduleSource).not.toMatch(/from\s+["']node:http["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:https["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:net["']/);
  });

  test('does not import TLS (node:tls / tls)', () => {
    // Codex PATCH §3: explicit TLS guard — no socket-level crypto transport.
    expect(moduleSource).not.toMatch(/from\s+["']node:tls["']/);
    expect(moduleSource).not.toMatch(/from\s+["']tls["']/);
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'](?:node:)?tls["']/,
    );
    expect(moduleSource).not.toMatch(/\brequire\(\s*["'](?:node:)?tls["']\)/);
  });

  test('does not import or use child_process', () => {
    // Codex PATCH §3: explicit child_process guard — no subprocess spawning.
    expect(moduleSource).not.toMatch(/from\s+["']node:child_process["']/);
    expect(moduleSource).not.toMatch(/from\s+["']child_process["']/);
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'](?:node:)?child_process["']/,
    );
    expect(moduleSource).not.toMatch(
      /\brequire\(\s*["'](?:node:)?child_process["']\)/,
    );
    // No spawn/exec/fork call shapes (the child_process API surface).
    expect(moduleSource).not.toMatch(/\b(spawn|exec|execFile|execSync|fork)\s*\(/);
  });

  test('does not consume RECALL_WEDGE_DIXIE_* envs (only the demo-gating envs)', () => {
    expect(moduleSource).not.toMatch(/RECALL_WEDGE_DIXIE_/);
  });

  test('contains no memory-admission / candidate-write / "remember this" affordance', () => {
    const lc = moduleSource.toLowerCase();
    // Admission / candidate-write APIs (identifiers, not prose). The word
    // "admit" alone may appear in a NON-affordance comment ("does not admit");
    // these patterns target the actual write/enqueue call shapes.
    expect(lc).not.toMatch(/admit(memory|candidate)\(/);
    expect(lc).not.toMatch(/candidate[_-]?memory/);
    expect(lc).not.toMatch(/writememory|write_memory/);
    expect(lc).not.toMatch(/enqueueadmission|admission[_-]?job/);
    // No "remember this" affordance phrase as a behavior in this module.
    expect(lc).not.toContain('remember this');
  });

  test('renders only via the EPHEMERAL flag — no non-ephemeral data branch', () => {
    // Every response data object in the module sets the EPHEMERAL flag.
    // Guard: there is no `data: {}` (flagless) or DEFERRED response shape.
    expect(moduleSource).toContain('MessageFlags.EPHEMERAL');
    expect(moduleSource).not.toMatch(/DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE/);
    // The only response builder sets flags: MessageFlags.EPHEMERAL.
    const responseDataBlocks = moduleSource.match(/data:\s*\{[^}]*\}/g) ?? [];
    expect(responseDataBlocks.length).toBeGreaterThan(0);
    for (const block of responseDataBlocks) {
      expect(block).toContain('MessageFlags.EPHEMERAL');
    }
  });
});

// -- 5b. test-file boundary guard ----------------------------------------

describe('Phase 39B · test file crosses no app→package boundary', () => {
  const testSource = readFileSync(
    resolve(__dirname, 'recall-wedge-demo.test.ts'),
    'utf8',
  );

  test('test does not deep-import across the app→package boundary', () => {
    // Codex PATCH §1/§3: the test must also reach the harness through the
    // authorized package subpath, not a deep relative path. The needle is
    // assembled from parts (DEEP_PKG_NEEDLE) so this assertion does not
    // itself plant the forbidden literal in the file it reads back.
    expect(testSource).not.toContain(DEEP_PKG_NEEDLE);
    expect(testSource).not.toMatch(/from\s+["'][^"']*\.\.\/packages\//);
  });

  test('test reaches the harness only via the authorized package subpath', () => {
    const harnessRefs =
      testSource.match(
        /from\s+["'][^"']*multi-surface-recall-harness[^"']*["']/g,
      ) ?? [];
    expect(harnessRefs.length).toBeGreaterThan(0);
    for (const ref of harnessRefs) {
      expect(ref).toContain(
        '@freeside-characters/persona-engine/recall-wedge/multi-surface-recall-harness',
      );
    }
  });
});

// -- 6. dispatch wiring guard --------------------------------------------

describe('Phase 39B · dispatch wiring', () => {
  const dispatchSource = readFileSync(
    resolve(__dirname, 'dispatch.ts'),
    'utf8',
  );

  test('dispatch routes the command name to the gated handler', () => {
    expect(dispatchSource).toContain('RECALL_WEDGE_DEMO_COMMAND_NAME');
    expect(dispatchSource).toContain('handleRecallWedgeDemoInteraction');
    expect(dispatchSource).toMatch(
      /interaction\.data\?\.name\s*===\s*RECALL_WEDGE_DEMO_COMMAND_NAME/,
    );
  });

  test('dispatch awaits the (now async) handler and returns its response', () => {
    expect(dispatchSource).toMatch(
      /return\s+await\s+handleRecallWedgeDemoInteraction\(interaction\)/,
    );
  });

  test('command name is the locked Phase 39A name with no alias', () => {
    expect(RECALL_WEDGE_DEMO_COMMAND_NAME).toBe('recall-wedge-demo');
  });
});

// -- 7. registration guard (registration NOT wired this phase) -----------

describe('Phase 39B · registration not globally wired', () => {
  const publishSource = readFileSync(
    resolve(__dirname, '../lib/publish-commands.ts'),
    'utf8',
  );
  const publishScriptSource = readFileSync(
    resolve(__dirname, '../../scripts/publish-commands.ts'),
    'utf8',
  );

  test('publish-commands does not register /recall-wedge-demo', () => {
    // Phase 39B implements handler + dispatch only; registration is NOT
    // added (no command-set entry, no global path). A later phase that
    // wires registration must gate on RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS
    // and the RECALL_WEDGE_DISCORD_DEMO_GUILD_ID guild scope.
    expect(publishSource).not.toContain('recall-wedge-demo');
    expect(publishScriptSource).not.toContain('recall-wedge-demo');
  });
});
