// Phase 41B · dev/operator-only LIVE Dixie Recall Wedge demo command
// (`/recall-wedge-live-demo`) regression + static-guard gate.
// Authority: docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md (Phase 41A
// §F–§M) under docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md (Phase 37B).
//
// What these tests prove:
//   A. env gate exactness — ENABLED exact "true" only; near-truthy fail;
//      missing/blank/non-matching guild fail; missing/blank operator allowlist
//      fail; non-operator fails; allowlist parsing trims + drops empties.
//   B. refused paths — disabled / wrong-guild / missing-guild / non-operator /
//      empty-allowlist all return the SAME generic ephemeral refusal; every
//      refused path is ephemeral; refused paths neither load nor call the live
//      Dixie client.
//   C. lazy live-client load/call — load + call happen only after gates pass;
//      the injected seam counts loads + recall calls; a load failure after
//      gates fails closed; a thrown live client fails closed; no network-like
//      call occurs except via the injected fake (the one real-loader test
//      throws on config before any egress).
//   D. input source — no freeform query; no message-history inspection; the
//      fixed synthetic probe (not interaction options) reaches the live client
//      even when freeform-like options are smuggled in.
//   E. success render — a served classification renders ephemeral live-demo
//      output with dev framing + only safe classification/summary, no raw
//      payload, passing the no-leak scan.
//   F. error / classification render — every Phase 37C classification renders
//      a safe summary or the generic refusal; unsupported_response_shape /
//      network_error / unsafe_idempotency_key_reuse fail closed; config classes
//      render a safe summary with no env values; contaminated summary falls
//      back to the generic refusal.
//   G. registration — disabled by default; exact "true" enables; near-truthy
//      do not register; missing/blank guild does not register; enabled path
//      POSTs ONLY to the guild route, never global; name is exactly
//      recall-wedge-live-demo; description is dev-only/live-Dixie/gated/demo
//      with no production claim; no freeform option; buildCommandSet never
//      contains it.
//   H. static guards — no Telegram/private-chat/storage/Finn/LLM imports; no
//      render-public-recall / dixie-envelope-adapter import; no recorded
//      fixture / recorded_dixie_recall_envelope use; no memory-admission /
//      candidate-write / "remember this"; no child_process / TLS; no raw
//      fetch; live client reached only via the authorized package subpath
//      (type-only static + gated dynamic import); `/recall-wedge-demo` still
//      never imports live Dixie; registration code imports neither the live
//      client nor the harness; the global publish set excludes the live
//      command; dispatch routes the live command to the gated handler.

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MessageFlags, type DiscordInteraction } from './types.ts';
import {
  RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION,
  RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
  RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL,
  handleRecallWedgeLiveDemoInteraction,
  isRecallWedgeLiveDiscordDemoAllowedGuild,
  isRecallWedgeLiveDiscordDemoOperator,
  parseRecallWedgeLiveDiscordDemoOperatorIds,
  recallWedgeLiveDemoRefusal,
  renderRecallWedgeLiveDemoContent,
  resolveRecallWedgeLiveDiscordDemoGuildId,
  shouldEnableRecallWedgeLiveDiscordDemo,
  shouldRegisterRecallWedgeLiveDiscordDemo,
  type RecallWedgeLiveDixieClientModule,
} from './recall-wedge-live-demo.ts';
// Live Dixie client reached through the AUTHORIZED package subpath (Phase 41B
// added `./recall-wedge/live-dixie-client` to persona-engine exports) — NOT a
// deep relative import that climbs into the package's src tree. Used here only
// for the test's own assertions + to feed the injected client seam.
import {
  LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS,
  findBannedPublicSubstring,
  type LiveDixieClientConfig,
  type LiveDixieRecallClassification,
  type LiveDixieRecallResult,
  type LiveRecallInput,
} from '@freeside-characters/persona-engine/recall-wedge/live-dixie-client';
import {
  buildCommandSet,
  registerRecallWedgeLiveDemoCommand,
} from '../lib/publish-commands.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GUILD = 'guild-allowed-123';
const OPERATOR = 'operator-user-456';
const OTHER_GUILD = 'guild-other-999';
const OTHER_USER = 'user-other-789';

function fullEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED: 'true',
    RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: GUILD,
    RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: OPERATOR,
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
    data: { id: 'cmd', name: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME },
    ...overrides,
  };
}

// A dummy live Dixie config — the injected client never uses it for a real
// call, so its field values are inert placeholders (no secrets).
const DUMMY_CONFIG = {
  baseUrl: 'https://dixie.example.test',
  serviceToken: 'inert',
  tenantId: '0xinert',
  callerActorId: '0xinert',
  requestKeyPrefix: 'p41b',
  timeoutMs: 10_000,
} satisfies LiveDixieClientConfig;

function liveResult(
  classification: LiveDixieRecallClassification,
  reasonCode: string = classification,
  outcome: string = classification,
): LiveDixieRecallResult {
  return {
    classification,
    public_summary: {
      // The render path reads only these three fields; cast the outcome to the
      // client's outcome union for the type — value content is what matters.
      outcome: outcome as LiveDixieRecallResult['public_summary']['outcome'],
      classification,
      stable_reason_code: reasonCode,
    },
    // A deliberately dirty internal diagnostic — proves the renderer never
    // surfaces raw payload / fingerprint / http_status material.
    internal_diagnostic: {
      http_status: 200,
      idempotency_key_present: true,
      fingerprint: 'fnv1a64:deadbeefdeadbeef',
    },
  };
}

/**
 * A counting live-client module seam. Returns the real banned-substring helper
 * so the no-leak scan is genuine, a configurable config loader, and a recall
 * fn that records call count + captured input.
 */
function countingClient(
  result: LiveDixieRecallResult,
  opts: {
    loadConfig?: (env: Record<string, string | undefined>) => LiveDixieClientConfig;
    throwOnRecall?: boolean;
  } = {},
): {
  module: RecallWedgeLiveDixieClientModule;
  recallCalls: () => number;
  capturedInput: () => LiveRecallInput | undefined;
} {
  let recallCalls = 0;
  let captured: LiveRecallInput | undefined;
  const module: RecallWedgeLiveDixieClientModule = {
    loadLiveDixieClientConfigFromEnv: opts.loadConfig ?? (() => DUMMY_CONFIG),
    liveRecallViaDixie: async (input) => {
      recallCalls += 1;
      captured = input;
      if (opts.throwOnRecall) throw new Error('simulated live client failure');
      return result;
    },
    findBannedPublicSubstring,
  };
  return {
    module,
    recallCalls: () => recallCalls,
    capturedInput: () => captured,
  };
}

/**
 * A counting loader seam: records how many times the live client is loaded so a
 * test can prove a refused path never loads it.
 */
function countingLoader(module: RecallWedgeLiveDixieClientModule): {
  load: () => Promise<RecallWedgeLiveDixieClientModule>;
  loads: () => number;
} {
  let loads = 0;
  return {
    load: async () => {
      loads += 1;
      return module;
    },
    loads: () => loads,
  };
}

// =====================================================================
// A. env gate exactness
// =====================================================================

describe('Phase 41B · env gate · enable (exact "true")', () => {
  test('enabled only by the exact string "true"', () => {
    expect(
      shouldEnableRecallWedgeLiveDiscordDemo({
        RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED: 'true',
      }),
    ).toBe(true);
  });

  test('disabled by default (missing var)', () => {
    expect(shouldEnableRecallWedgeLiveDiscordDemo({})).toBe(false);
  });

  test.each(['TRUE', 'True', '1', 'yes', ' true', 'true ', 'truthy', ''])(
    'near-truthy value %p does NOT enable',
    (value) => {
      expect(
        shouldEnableRecallWedgeLiveDiscordDemo({
          RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED: value,
        }),
      ).toBe(false);
    },
  );
});

describe('Phase 41B · env gate · register (exact "true")', () => {
  test('registration enabled only by exact "true"', () => {
    expect(
      shouldRegisterRecallWedgeLiveDiscordDemo({
        RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: 'true',
      }),
    ).toBe(true);
  });

  test.each(['TRUE', 'True', '1', 'yes', undefined as unknown as string, ''])(
    'register value %p does NOT enable',
    (value) => {
      expect(
        shouldRegisterRecallWedgeLiveDiscordDemo({
          RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: value,
        }),
      ).toBe(false);
    },
  );
});

describe('Phase 41B · env gate · operator allowlist parsing', () => {
  test('missing var → empty list (fails closed)', () => {
    expect(parseRecallWedgeLiveDiscordDemoOperatorIds({})).toEqual([]);
  });

  test('blank var → empty list', () => {
    expect(
      parseRecallWedgeLiveDiscordDemoOperatorIds({
        RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: '   ',
      }),
    ).toEqual([]);
  });

  test('comma-separated, trimmed, empties dropped', () => {
    expect(
      parseRecallWedgeLiveDiscordDemoOperatorIds({
        RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: ' a , b ,, c ',
      }),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('Phase 41B · guild gate', () => {
  test('matching guild passes', () => {
    expect(
      isRecallWedgeLiveDiscordDemoAllowedGuild(interaction(), fullEnv()),
    ).toBe(true);
  });

  test('wrong guild fails closed', () => {
    expect(
      isRecallWedgeLiveDiscordDemoAllowedGuild(
        interaction({ guild_id: OTHER_GUILD }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test('missing guild_id (DM) fails closed', () => {
    expect(
      isRecallWedgeLiveDiscordDemoAllowedGuild(
        interaction({ guild_id: undefined }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test.each([undefined as unknown as string, '', '   ', '\t'])(
    'missing / blank configured guild id %p fails closed',
    (value) => {
      expect(
        isRecallWedgeLiveDiscordDemoAllowedGuild(
          interaction(),
          fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: value }),
        ),
      ).toBe(false);
    },
  );
});

describe('Phase 41B · operator gate', () => {
  test('operator in allowlist passes', () => {
    expect(isRecallWedgeLiveDiscordDemoOperator(interaction(), fullEnv())).toBe(
      true,
    );
  });

  test('reads user.id when invoked in a DM shape', () => {
    expect(
      isRecallWedgeLiveDiscordDemoOperator(
        interaction({ member: undefined, user: { id: OPERATOR, username: 'op' } }),
        fullEnv(),
      ),
    ).toBe(true);
  });

  test('non-operator fails closed', () => {
    expect(
      isRecallWedgeLiveDiscordDemoOperator(
        interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
        fullEnv(),
      ),
    ).toBe(false);
  });

  test('empty allowlist fails closed', () => {
    expect(
      isRecallWedgeLiveDiscordDemoOperator(
        interaction(),
        fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
      ),
    ).toBe(false);
  });
});

// =====================================================================
// B. refused paths (generic ephemeral refusal · no client load/call)
// =====================================================================

describe('Phase 41B · handler fail-closed gating', () => {
  test('disabled by default → generic ephemeral refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), {});
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test.each(['TRUE', 'True', '1', 'yes', ' true'])(
    'enabled value %p does NOT enable the handler',
    async (value) => {
      const res = await handleRecallWedgeLiveDemoInteraction(
        interaction(),
        fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED: value }),
      );
      expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    },
  );

  test('wrong guild → generic refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction({ guild_id: OTHER_GUILD }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
  });

  test('missing guild → generic refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction({ guild_id: undefined }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
  });

  test('non-operator → generic refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
      fullEnv(),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
  });

  test('empty operator allowlist → generic refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
    );
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
  });

  test('disabled / wrong-guild / missing-guild / non-operator / empty-allowlist share ONE generic string', async () => {
    const refusals = [
      await handleRecallWedgeLiveDemoInteraction(interaction(), {}),
      await handleRecallWedgeLiveDemoInteraction(
        interaction({ guild_id: OTHER_GUILD }),
        fullEnv(),
      ),
      await handleRecallWedgeLiveDemoInteraction(
        interaction({ guild_id: undefined }),
        fullEnv(),
      ),
      await handleRecallWedgeLiveDemoInteraction(
        interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
        fullEnv(),
      ),
      await handleRecallWedgeLiveDemoInteraction(
        interaction(),
        fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
      ),
    ];
    for (const r of refusals) {
      expect(r.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
      expect(r.data?.flags).toBe(MessageFlags.EPHEMERAL);
    }
  });

  test('refusal string passes the live-client banned-substring scan', () => {
    for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
      expect(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL).not.toContain(banned);
    }
    expect(findBannedPublicSubstring(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL)).toBeNull();
  });

  test('recallWedgeLiveDemoRefusal() is ephemeral and the generic string', () => {
    const r = recallWedgeLiveDemoRefusal();
    expect(r.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    expect(r.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });
});

describe('Phase 41B · refused paths never load or call the live Dixie client', () => {
  for (const [label, build] of [
    ['disabled', () => ({ int: interaction(), env: {} as Record<string, string | undefined> })],
    ['wrong-guild', () => ({ int: interaction({ guild_id: OTHER_GUILD }), env: fullEnv() })],
    ['missing-guild', () => ({ int: interaction({ guild_id: undefined }), env: fullEnv() })],
    [
      'non-operator',
      () => ({
        int: interaction({ member: { user: { id: OTHER_USER, username: 'x' } } }),
        env: fullEnv(),
      }),
    ],
    [
      'empty-allowlist',
      () => ({
        int: interaction(),
        env: fullEnv({ RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS: '' }),
      }),
    ],
  ] as const) {
    test(`${label} path loads NO client and makes NO call`, async () => {
      const client = countingClient(liveResult('served'));
      const loader = countingLoader(client.module);
      const { int, env } = build();
      const res = await handleRecallWedgeLiveDemoInteraction(int, env, {
        loadLiveClient: loader.load,
      });
      expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
      expect(loader.loads()).toBe(0);
      expect(client.recallCalls()).toBe(0);
    });
  }
});

// =====================================================================
// C. lazy live-client load/call
// =====================================================================

describe('Phase 41B · live client is loaded + called only after gates pass', () => {
  test('enabled + allowed path loads the client once and calls recall once', async () => {
    const client = countingClient(liveResult('served'));
    const loader = countingLoader(client.module);
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      { loadLiveClient: loader.load },
    );
    expect(loader.loads()).toBe(1);
    expect(client.recallCalls()).toBe(1);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('classification: served');
  });

  test('client load failure after gates pass → generic ephemeral refusal', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
      loadLiveClient: async () => {
        throw new Error('simulated client load failure');
      },
    });
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test('thrown live client (recall throws) → generic ephemeral refusal', async () => {
    const client = countingClient(liveResult('served'), { throwOnRecall: true });
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
      loadLiveClient: async () => client.module,
    });
    expect(client.recallCalls()).toBe(1);
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });

  test('default loader (real dynamic import) + missing live env → safe config summary, NO network egress', async () => {
    // No injected loader — exercises defaultLoadLiveClient's dynamic import of
    // the authorized package subpath AND the real config loader. With the live
    // Dixie env absent, config load throws missing_required_env BEFORE any
    // network egress, so we spy on globalThis.fetch and assert zero calls.
    const original = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async (_url: string, _init?: RequestInit) => {
      fetchCalls += 1;
      return { ok: true, status: 200, text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv());
      expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
      // Safe config-error summary (no env values) OR generic refusal — both
      // are fail-closed-acceptable per Phase 41A §I.
      const content = res.data?.content ?? '';
      const okShape =
        content === RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL ||
        content.includes('classification: missing_required_env');
      expect(okShape).toBe(true);
      // Crucially: no network egress on the missing-env path.
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

// =====================================================================
// D. input source (fixed synthetic probe · no freeform query)
// =====================================================================

describe('Phase 41B · input source is the fixed synthetic probe (no freeform query)', () => {
  test('the live client receives the FIXED probe, never interaction options', async () => {
    const client = countingClient(liveResult('served'));
    await handleRecallWedgeLiveDemoInteraction(
      interaction({
        // Smuggle freeform-like options; the handler must ignore them entirely.
        data: {
          id: 'cmd',
          name: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
          options: [
            { name: 'prompt', type: 3, value: 'remember my secret' },
            { name: 'query', type: 3, value: 'recall everything' },
            { name: 'memory', type: 3, value: 'PRIVATE_SENTINEL' },
            { name: 'case', type: 3, value: 'served' },
          ],
        },
      }),
      fullEnv(),
      { loadLiveClient: async () => client.module },
    );
    const captured = client.capturedInput();
    expect(captured).toBeDefined();
    // Fixed probe identity — not derived from any option.
    expect(captured!.recallRequestId).toBe('recall-wedge-live-demo-1');
    expect(captured!.task).toContain('operator/dev probe');
    expect(captured!.environmentFrame).toBe('private_operator');
    // None of the smuggled freeform values reached the request.
    const serialized = JSON.stringify(captured);
    expect(serialized).not.toContain('remember my secret');
    expect(serialized).not.toContain('recall everything');
    expect(serialized).not.toContain('PRIVATE_SENTINEL');
  });

  test('smuggled freeform option values never appear in the rendered output', async () => {
    const client = countingClient(liveResult('served'));
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction({
        data: {
          id: 'cmd',
          name: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
          options: [{ name: 'prompt', type: 3, value: 'leak me PRIVATE_SENTINEL' }],
        },
      }),
      fullEnv(),
      { loadLiveClient: async () => client.module },
    );
    const content = res.data?.content ?? '';
    expect(content).not.toContain('leak me');
    expect(content).not.toContain('PRIVATE_SENTINEL');
    expect(content).toContain('classification: served');
  });

  test('handler module source reads no interaction options / message history', () => {
    const moduleSource = readFileSync(
      resolve(__dirname, 'recall-wedge-live-demo.ts'),
      'utf8',
    );
    // No option/text readers, no interaction.data access (the request is fixed).
    expect(moduleSource).not.toContain('interaction.data');
    expect(moduleSource).not.toMatch(/readStringOption|readBooleanOption/);
    expect(moduleSource).not.toMatch(/\.options\?\./);
    expect(moduleSource).not.toMatch(/message[_-]?history/i);
    expect(moduleSource).not.toMatch(/getMessages|fetchMessages|channel\.messages/);
  });
});

// =====================================================================
// E. success render
// =====================================================================

describe('Phase 41B · success render (served)', () => {
  const withServed = {
    loadLiveClient: async () => countingClient(liveResult('served')).module,
  };

  test('served renders ephemeral live-demo output', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      withServed,
    );
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    expect(res.data?.content).toContain('classification: served');
  });

  test('output includes the live-demo dev framing', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      withServed,
    );
    const content = res.data?.content ?? '';
    expect(content).toContain('live Dixie dev demo (not production recall)');
    expect(content).toContain('phase 37c live Dixie client output');
  });

  test('output includes only the safe classification / summary fields', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      withServed,
    );
    const content = res.data?.content ?? '';
    expect(content).toContain('classification: served');
    expect(content).toContain('route:          /api/recall/intake');
    expect(content).toContain('reason:');
  });

  test('output does NOT include raw Dixie payload / diagnostic fields', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      withServed,
    );
    const content = res.data?.content ?? '';
    expect(content).not.toContain('internal_diagnostic');
    expect(content).not.toContain('http_status');
    expect(content).not.toContain('fingerprint');
    expect(content).not.toContain('idempotency_key');
  });

  test('output passes the live-client no-leak scan', async () => {
    const res = await handleRecallWedgeLiveDemoInteraction(
      interaction(),
      fullEnv(),
      withServed,
    );
    const content = res.data?.content ?? '';
    for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
      expect(content).not.toContain(banned);
    }
    expect(findBannedPublicSubstring(content)).toBeNull();
  });
});

// =====================================================================
// F. error / classification render
// =====================================================================

describe('Phase 41B · classification render', () => {
  // Classifications that render a safe ephemeral summary.
  const SAFE: LiveDixieRecallClassification[] = [
    'served',
    'denied_or_forbidden',
    'needs_review',
    'ingress_invalid_request',
    'service_unauthorized',
    'tenant_or_session_mismatch',
    'rate_limited',
    'upstream_unavailable',
  ];

  for (const classification of SAFE) {
    test(`${classification} renders a safe ephemeral summary (no leak)`, async () => {
      const client = countingClient(liveResult(classification));
      const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
        loadLiveClient: async () => client.module,
      });
      expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
      const content = res.data?.content ?? '';
      // Either a safe summary naming the classification, or the generic refusal
      // — both are §I-acceptable. The safe-summary branch must pass no-leak.
      const isRefusal = content === RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL;
      if (!isRefusal) {
        expect(content).toContain(`classification: ${classification}`);
        for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
          expect(content).not.toContain(banned);
        }
      }
    });
  }

  // Classifications that ALWAYS fail closed to the generic refusal.
  for (const classification of [
    'unsupported_response_shape',
    'network_error',
    'unsafe_idempotency_key_reuse',
  ] as LiveDixieRecallClassification[]) {
    test(`${classification} fails closed to the generic refusal`, async () => {
      const client = countingClient(liveResult(classification));
      const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
        loadLiveClient: async () => client.module,
      });
      expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
      expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    });
  }

  test('missing_required_env config throw → safe summary with NO env name / value', async () => {
    const loadConfig = () => {
      const e = new Error(
        'required env "RECALL_WEDGE_DIXIE_SERVICE_TOKEN" is missing or empty',
      ) as Error & { code: string; missingEnv: string };
      e.code = 'missing_required_env';
      e.missingEnv = 'RECALL_WEDGE_DIXIE_SERVICE_TOKEN';
      throw e;
    };
    const client = countingClient(liveResult('served'), { loadConfig });
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
      loadLiveClient: async () => client.module,
    });
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    const content = res.data?.content ?? '';
    const okShape =
      content === RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL ||
      content.includes('classification: missing_required_env');
    expect(okShape).toBe(true);
    // Never leaks the env NAME or the underlying message, and never calls recall.
    expect(content).not.toContain('RECALL_WEDGE_DIXIE_SERVICE_TOKEN');
    expect(content).not.toContain('RECALL_WEDGE_DIXIE_');
    expect(client.recallCalls()).toBe(0);
  });

  test('invalid_config config throw → safe summary with NO env values', async () => {
    const loadConfig = () => {
      const e = new Error('RECALL_WEDGE_DIXIE_BASE_URL is not a valid URL') as Error & {
        code: string;
      };
      e.code = 'invalid_config';
      throw e;
    };
    const client = countingClient(liveResult('served'), { loadConfig });
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
      loadLiveClient: async () => client.module,
    });
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
    const content = res.data?.content ?? '';
    const okShape =
      content === RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL ||
      content.includes('classification: invalid_config');
    expect(okShape).toBe(true);
    expect(content).not.toContain('RECALL_WEDGE_DIXIE_BASE_URL');
    expect(client.recallCalls()).toBe(0);
  });

  test('contaminated stable_reason_code falls back to the generic refusal', async () => {
    // A safe-summary classification but with a reason code that carries a
    // banned substring — the final no-leak scan must catch it.
    const client = countingClient(
      liveResult('denied_or_forbidden', 'leak:raw_reasons:PRIVATE_SENTINEL', 'denied'),
    );
    const res = await handleRecallWedgeLiveDemoInteraction(interaction(), fullEnv(), {
      loadLiveClient: async () => client.module,
    });
    expect(res.data?.content).toBe(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
    expect(res.data?.flags).toBe(MessageFlags.EPHEMERAL);
  });
});

describe('Phase 41B · renderRecallWedgeLiveDemoContent (direct)', () => {
  test('served renders content', () => {
    const out = renderRecallWedgeLiveDemoContent({
      classification: 'served',
      outcome: 'served',
      stable_reason_code: 'served',
    });
    expect(out).not.toBeNull();
    expect(out).toContain('classification: served');
    expect(out).toContain('/api/recall/intake');
  });

  test.each([
    'unsupported_response_shape',
    'network_error',
    'unsafe_idempotency_key_reuse',
  ] as LiveDixieRecallClassification[])('%s renders null (fail closed)', (classification) => {
    expect(
      renderRecallWedgeLiveDemoContent({
        classification,
        outcome: 'x',
        stable_reason_code: 'x',
      }),
    ).toBeNull();
  });

  test('config classes force the reason to the bare class name (no env leak)', () => {
    const out = renderRecallWedgeLiveDemoContent({
      classification: 'missing_required_env',
      outcome: 'config_error',
      stable_reason_code: 'missing:RECALL_WEDGE_DIXIE_SERVICE_TOKEN',
    });
    expect(out).not.toBeNull();
    expect(out).toContain('reason:         missing_required_env');
    expect(out).not.toContain('RECALL_WEDGE_DIXIE_SERVICE_TOKEN');
  });

  test('unknown classification renders null (fail closed)', () => {
    expect(
      renderRecallWedgeLiveDemoContent({
        classification: 'totally_unknown' as LiveDixieRecallClassification,
        outcome: 'x',
        stable_reason_code: 'x',
      }),
    ).toBeNull();
  });
});

// =====================================================================
// G. registration (guild-scoped ONLY · never global)
// =====================================================================

function captureFetch(
  response: { ok: boolean; status?: number; json?: unknown } = {
    ok: true,
    json: { id: 'cmd-id-live', name: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME },
  },
): { calls: Array<{ url: string; init: RequestInit }>; restore: () => void } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.json ?? {},
      text: async () => JSON.stringify(response.json ?? {}),
    } as unknown as Response;
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const REGISTER_ENABLED = {
  RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: 'true',
  RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: GUILD,
};

describe('Phase 41B · command definition metadata', () => {
  test('command name is exactly recall-wedge-live-demo (no alias)', () => {
    expect(RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION.name).toBe(
      'recall-wedge-live-demo',
    );
    expect(RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION.name).toBe(
      RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
    );
  });

  test('description includes dev-only / live Dixie / gated / demo wording', () => {
    const d = RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION.description.toLowerCase();
    expect(d).toContain('dev-only');
    expect(d).toContain('live dixie');
    expect(d).toContain('gated');
    expect(d).toContain('demo');
  });

  test('description makes no production memory / recall / consent claim', () => {
    const d = RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION.description.toLowerCase();
    for (const banned of [
      'your memory',
      'remembered',
      'saved',
      'stored',
      'consent',
      'admitted',
    ]) {
      expect(d).not.toContain(banned);
    }
    expect(d).toContain('not production recall');
  });

  test('command has NO options (no freeform query path)', () => {
    expect(RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION.options.length).toBe(0);
  });

  test('buildCommandSet (the global-capable array) never contains the live command', () => {
    const set = buildCommandSet([
      { id: 'ruggy', displayName: 'Ruggy' } as never,
      { id: 'satoshi', displayName: 'Satoshi' } as never,
    ]);
    for (const cmd of set) {
      expect(cmd.name).not.toBe(RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME);
    }
  });
});

describe('Phase 41B · guild-id resolution (fails closed, never global)', () => {
  test('present non-empty guild id resolves', () => {
    expect(
      resolveRecallWedgeLiveDiscordDemoGuildId({
        RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: GUILD,
      }),
    ).toBe(GUILD);
  });

  test.each([undefined as unknown as string, '', '   ', '\t', ' \n '])(
    'missing / empty / whitespace guild id %p resolves to null',
    (value) => {
      expect(
        resolveRecallWedgeLiveDiscordDemoGuildId({
          RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: value,
        }),
      ).toBeNull();
    },
  );
});

describe('Phase 41B · registration gate (disabled by default)', () => {
  test('disabled by default (no env) → not registered, no network call', async () => {
    const fetchCap = captureFetch();
    try {
      const res = await registerRecallWedgeLiveDemoCommand({
        botToken: 'tok',
        applicationId: 'app',
        env: {},
      });
      expect(res.registered).toBe(false);
      expect(fetchCap.calls.length).toBe(0);
    } finally {
      fetchCap.restore();
    }
  });

  test.each(['TRUE', 'True', '1', 'yes', ' true', 'true ', ''])(
    'near-truthy register flag %p → not registered, no network call',
    async (value) => {
      const fetchCap = captureFetch();
      try {
        const res = await registerRecallWedgeLiveDemoCommand({
          botToken: 'tok',
          applicationId: 'app',
          env: {
            RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: value,
            RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: GUILD,
          },
        });
        expect(res.registered).toBe(false);
        if (!res.registered) expect(res.reason).toBe('gate_disabled');
        expect(fetchCap.calls.length).toBe(0);
      } finally {
        fetchCap.restore();
      }
    },
  );

  test('exact "true" register flag enables the registration path', async () => {
    const fetchCap = captureFetch();
    try {
      const res = await registerRecallWedgeLiveDemoCommand({
        botToken: 'tok',
        applicationId: 'app',
        env: REGISTER_ENABLED,
      });
      expect(res.registered).toBe(true);
      expect(fetchCap.calls.length).toBe(1);
    } finally {
      fetchCap.restore();
    }
  });

  test('missing guild id (register enabled) → not registered, NO global fallback', async () => {
    const fetchCap = captureFetch();
    try {
      const res = await registerRecallWedgeLiveDemoCommand({
        botToken: 'tok',
        applicationId: 'app',
        env: { RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: 'true' },
      });
      expect(res.registered).toBe(false);
      if (!res.registered) expect(res.reason).toBe('no_guild');
      expect(fetchCap.calls.length).toBe(0);
    } finally {
      fetchCap.restore();
    }
  });

  test.each(['', '   ', '\t'])(
    'empty / whitespace guild id %p (register enabled) → not registered, no call',
    async (value) => {
      const fetchCap = captureFetch();
      try {
        const res = await registerRecallWedgeLiveDemoCommand({
          botToken: 'tok',
          applicationId: 'app',
          env: {
            RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: 'true',
            RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID: value,
          },
        });
        expect(res.registered).toBe(false);
        if (!res.registered) expect(res.reason).toBe('no_guild');
        expect(fetchCap.calls.length).toBe(0);
      } finally {
        fetchCap.restore();
      }
    },
  );
});

describe('Phase 41B · registration is guild-scoped ONLY', () => {
  test('enabled path POSTs to the guild commands route with the configured guild id', async () => {
    const fetchCap = captureFetch();
    try {
      const res = await registerRecallWedgeLiveDemoCommand({
        botToken: 'tok',
        applicationId: 'app-77',
        env: REGISTER_ENABLED,
      });
      expect(res.registered).toBe(true);
      if (res.registered) {
        expect(res.scope).toBe('guild');
        expect(res.guildId).toBe(GUILD);
      }
      expect(fetchCap.calls.length).toBe(1);
      const { url, init } = fetchCap.calls[0]!;
      expect(url).toBe(
        `https://discord.com/api/v10/applications/app-77/guilds/${GUILD}/commands`,
      );
      expect(url).toContain(`/guilds/${GUILD}/commands`);
      expect(url).not.toBe(
        'https://discord.com/api/v10/applications/app-77/commands',
      );
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body));
      expect(body.name).toBe(RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME);
      // No freeform option smuggled into the registered payload.
      expect(body.options ?? []).toEqual([]);
    } finally {
      fetchCap.restore();
    }
  });

  test('no env path reaches the global commands route', async () => {
    const fetchCap = captureFetch();
    try {
      await registerRecallWedgeLiveDemoCommand({ botToken: 't', applicationId: 'a', env: {} });
      await registerRecallWedgeLiveDemoCommand({
        botToken: 't',
        applicationId: 'a',
        env: { RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS: 'true' },
      });
      for (const { url } of fetchCap.calls) {
        expect(url).not.toMatch(/\/applications\/[^/]+\/commands$/);
      }
      expect(fetchCap.calls.length).toBe(0);
    } finally {
      fetchCap.restore();
    }
  });
});

// =====================================================================
// H. static source guards
// =====================================================================

// Assembled from parts so this guard's OWN source does not contain the literal
// it forbids (the test reads its sibling sources back).
const DEEP_PKG_NEEDLE = ['..', '..', '..', '..', 'packages', 'persona-engine'].join(
  '/',
);

describe('Phase 41B · static source guards (handler module)', () => {
  const moduleSource = readFileSync(
    resolve(__dirname, 'recall-wedge-live-demo.ts'),
    'utf8',
  );

  test('does not deep-import across the app→package boundary (no TS6059 delta)', () => {
    expect(moduleSource).not.toContain(DEEP_PKG_NEEDLE);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\.\.\/packages\//);
  });

  test('reaches the live Dixie client only via the authorized package subpath', () => {
    const refs =
      moduleSource.match(/["'][^"']*live-dixie-client[^"']*["']/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toContain(
        '@freeside-characters/persona-engine/recall-wedge/live-dixie-client',
      );
      expect(ref).not.toContain('packages/persona-engine');
      expect(ref).not.toContain('../');
    }
  });

  test('only static import of the client specifier is type-only; a dynamic import() exists', () => {
    expect(moduleSource).toMatch(
      /import\s+type\s*\{[^}]*\}\s*from\s+["']@freeside-characters\/persona-engine\/recall-wedge\/live-dixie-client["']/,
    );
    expect(moduleSource).toMatch(
      /import\(\s*[\s\n]*["']@freeside-characters\/persona-engine\/recall-wedge\/live-dixie-client["']/,
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
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*(render-public-recall|dixie-envelope-adapter)[^"']*["']/,
    );
  });

  test('does not import the Phase 38A multi-surface harness', () => {
    expect(moduleSource).not.toMatch(/multi-surface-recall-harness/);
  });

  test('does not use recorded_dixie_recall_envelope or recorded fixtures', () => {
    expect(moduleSource).not.toMatch(/recorded_dixie_recall_envelope/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*fixtures?[^"']*["']/);
  });

  test('does not import Telegram / private-chat clients', () => {
    expect(moduleSource).not.toMatch(/from\s+["']telegraf["']/);
    expect(moduleSource).not.toMatch(/from\s+["']grammy["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*telegram[^"']*["']/i);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*private[-_]chat[^"']*["']/i);
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*private[-_]chat[^"']*["']/i,
    );
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

  test('contains no raw fetch / low-level network primitives (egress stays in the client)', () => {
    expect(moduleSource).not.toMatch(/\bfetch\s*\(/);
    expect(moduleSource).not.toMatch(/globalThis\.fetch/);
    expect(moduleSource).not.toMatch(/\bundici\b/);
    expect(moduleSource).not.toMatch(/from\s+["']node:http["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:https["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:net["']/);
  });

  test('does not import TLS (node:tls / tls)', () => {
    expect(moduleSource).not.toMatch(/from\s+["']node:tls["']/);
    expect(moduleSource).not.toMatch(/from\s+["']tls["']/);
    expect(moduleSource).not.toMatch(/import\(\s*[\s\n]*["'](?:node:)?tls["']/);
    expect(moduleSource).not.toMatch(/\brequire\(\s*["'](?:node:)?tls["']\)/);
  });

  test('does not import or use child_process', () => {
    expect(moduleSource).not.toMatch(/from\s+["']node:child_process["']/);
    expect(moduleSource).not.toMatch(/from\s+["']child_process["']/);
    expect(moduleSource).not.toMatch(
      /import\(\s*[\s\n]*["'](?:node:)?child_process["']/,
    );
    expect(moduleSource).not.toMatch(
      /\brequire\(\s*["'](?:node:)?child_process["']\)/,
    );
    expect(moduleSource).not.toMatch(/\b(spawn|exec|execFile|execSync|fork)\s*\(/);
  });

  test('contains no memory-admission / candidate-write / "remember this" affordance', () => {
    const lc = moduleSource.toLowerCase();
    expect(lc).not.toMatch(/admit(memory|candidate)\(/);
    expect(lc).not.toMatch(/candidate[_-]?memory/);
    expect(lc).not.toMatch(/writememory|write_memory/);
    expect(lc).not.toMatch(/enqueueadmission|admission[_-]?job/);
    expect(lc).not.toContain('remember this');
  });

  test('renders only via the EPHEMERAL flag — no non-ephemeral / deferred branch', () => {
    expect(moduleSource).toContain('MessageFlags.EPHEMERAL');
    expect(moduleSource).not.toMatch(/DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE/);
    const responseDataBlocks = moduleSource.match(/data:\s*\{[^}]*\}/g) ?? [];
    expect(responseDataBlocks.length).toBeGreaterThan(0);
    for (const block of responseDataBlocks) {
      expect(block).toContain('MessageFlags.EPHEMERAL');
    }
  });
});

describe('Phase 41B · test file crosses no app→package boundary', () => {
  const testSource = readFileSync(
    resolve(__dirname, 'recall-wedge-live-demo.test.ts'),
    'utf8',
  );

  test('test does not deep-import across the app→package boundary', () => {
    expect(testSource).not.toContain(DEEP_PKG_NEEDLE);
    expect(testSource).not.toMatch(/from\s+["'][^"']*\.\.\/packages\//);
  });

  test('test reaches the live client only via the authorized package subpath', () => {
    const refs =
      testSource.match(/from\s+["'][^"']*live-dixie-client[^"']*["']/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toContain(
        '@freeside-characters/persona-engine/recall-wedge/live-dixie-client',
      );
    }
  });
});

// =====================================================================
// `/recall-wedge-demo` preservation guard (Phase 41A §J · §O)
// =====================================================================

describe('Phase 41B · /recall-wedge-demo still never imports live Dixie', () => {
  const harnessSource = readFileSync(
    resolve(__dirname, 'recall-wedge-demo.ts'),
    'utf8',
  );

  test('harness handler imports no live Dixie client / runner (static or dynamic)', () => {
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(harnessSource).not.toMatch(
      /import\(\s*[\s\n]*["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
  });

  test('harness command name is unchanged (no alias collision with live)', () => {
    expect(harnessSource).toContain("RECALL_WEDGE_DEMO_COMMAND_NAME = 'recall-wedge-demo'");
    expect(RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME).not.toBe('recall-wedge-demo');
  });
});

// =====================================================================
// dispatch wiring + registration-code static guards
// =====================================================================

describe('Phase 41B · dispatch wiring', () => {
  const dispatchSource = readFileSync(resolve(__dirname, 'dispatch.ts'), 'utf8');

  test('dispatch routes the live command name to the gated handler', () => {
    expect(dispatchSource).toContain('RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME');
    expect(dispatchSource).toContain('handleRecallWedgeLiveDemoInteraction');
    expect(dispatchSource).toMatch(
      /interaction\.data\?\.name\s*===\s*RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME/,
    );
    expect(dispatchSource).toMatch(
      /return\s+await\s+handleRecallWedgeLiveDemoInteraction\(interaction\)/,
    );
  });

  test('dispatch still routes the harness command independently', () => {
    expect(dispatchSource).toContain('handleRecallWedgeDemoInteraction');
    expect(dispatchSource).toContain('RECALL_WEDGE_DEMO_COMMAND_NAME');
  });
});

describe('Phase 41B · registration-code static guards (publish-commands.ts)', () => {
  const publishSource = readFileSync(
    resolve(__dirname, '../lib/publish-commands.ts'),
    'utf8',
  );
  const publishScriptSource = readFileSync(
    resolve(__dirname, '../../scripts/publish-commands.ts'),
    'utf8',
  );

  test('registration code imports no live Dixie client / runner / harness', () => {
    expect(publishSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(publishSource).not.toMatch(
      /from\s+["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
    expect(publishSource).not.toMatch(/multi-surface-recall-harness/);
    // It reaches the live command module only for lightweight metadata + gates.
    expect(publishSource).toContain(
      "from '../discord-interactions/recall-wedge-live-demo.ts'",
    );
  });

  test('the live registration path uses ONLY the guild route, never the global route', () => {
    const start = publishSource.indexOf(
      'export async function registerRecallWedgeLiveDemoCommand',
    );
    expect(start).toBeGreaterThan(-1);
    const after = publishSource.indexOf('\nexport function buildCommandSet', start);
    const body = publishSource.slice(start, after > -1 ? after : undefined);
    expect(body).toMatch(/\/guilds\/\$\{guildId\}\/commands/);
    expect(body).not.toMatch(/applications\/\$\{applicationId\}\/commands`/);
  });

  test('buildCommandSet body does not mention the live command (no global-array entry)', () => {
    const start = publishSource.indexOf('export function buildCommandSet');
    expect(start).toBeGreaterThan(-1);
    const after = publishSource.indexOf('\nfunction buildCommand(', start);
    const body = publishSource.slice(start, after > -1 ? after : undefined);
    expect(body).not.toContain('recall-wedge-live-demo');
    expect(body).not.toContain('RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION');
  });

  test('registration code consumes no RECALL_WEDGE_DIXIE_* secret envs', () => {
    expect(publishSource).not.toMatch(/RECALL_WEDGE_DIXIE_/);
  });

  test('CLI script registers the live command via the gated guild-only helper', () => {
    expect(publishScriptSource).toContain('registerRecallWedgeLiveDemoCommand');
    expect(publishScriptSource).not.toMatch(/applications\/\$\{[^}]+\}\/commands`/);
  });
});
