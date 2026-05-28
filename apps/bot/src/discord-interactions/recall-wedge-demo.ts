/**
 * Phase 39B · dev-only Recall Wedge demo command (`/recall-wedge-demo`).
 *
 * Authority: docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md (Phase 39A).
 * Phase 39A authorized ONLY a tightly gated, dev-only, guild-scoped,
 * operator-invoked, ephemeral, harness-backed Discord slash command that
 * renders Phase 38A multi-surface harness output. Every constraint below is
 * binding; partial compliance does not satisfy the gate.
 *
 * What this module does:
 *   - fails closed by default (disabled unless RECALL_WEDGE_DISCORD_DEMO_ENABLED
 *     is the exact string "true");
 *   - fails closed unless interaction.guild_id matches
 *     RECALL_WEDGE_DISCORD_DEMO_GUILD_ID;
 *   - fails closed unless the invoking user id is in
 *     RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS;
 *   - returns the SAME generic ephemeral refusal for disabled / wrong-guild /
 *     non-operator cases (never reveals which gate tripped);
 *   - renders ONLY the Phase 38A public_discord_simulated frame plus fixed
 *     dev-only framing text and a compact public-safe per-frame outcome
 *     summary;
 *   - scans the final content with the Phase 38A harness banned-substring
 *     posture before returning, falling back to the generic ephemeral refusal
 *     on any hit;
 *   - is ephemeral on every path (success and refusal).
 *
 * What this module does NOT do (Phase 39A §C / §G / §H / §J):
 *   - it does NOT call live Dixie. It does not import the Phase 37C live Dixie
 *     client (live-dixie-client) or runner (run-live-dixie-recall-demo);
 *   - it does NOT accept freeform recall / memory query options (no prompt /
 *     query / text / message / memory / recall option) — only a fixed enum
 *     demo selector;
 *   - it does NOT read Discord message history;
 *   - it does NOT admit / write / nominate memory, and offers no
 *     remembering affordance from Discord input;
 *   - it does NOT invoke any LLM and emits no character voice;
 *   - it does NOT mutate render-public-recall.ts or dixie-envelope-adapter.ts;
 *   - it does NOT claim production auth / consent (the env allowlists are
 *     deployment-side gates, not Straylight authority);
 *   - it does NOT log raw harness input, the raw matrix, operator_dev
 *     diagnostics, tokens, or any actor / operational / channel / guild / user
 *     id.
 */

// Type-only import across the authorized package subpath (Phase 39B patch ·
// Codex PATCH §1/§2). `import type` is fully erased at build time, so this
// file carries NO runtime dependency on the Phase 38A harness at module load
// — the harness runtime is pulled in lazily via `defaultLoadHarness` ONLY
// after every gate passes (see the handler below). Importing through the
// package export (NOT a deep relative path that climbs into the package's
// src tree) keeps apps/bot's `rootDir: "src"` clean (no TS6059).
import type {
  MultiSurfaceRecallInput,
  MultiSurfaceRecallProjectionMatrix,
} from '@freeside-characters/persona-engine/recall-wedge/multi-surface-recall-harness';
import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
  type DiscordInteractionResponse,
} from './types.ts';

/**
 * The narrow runtime surface this command needs from the Phase 38A harness.
 * Resolved lazily (dynamic import) so the harness module is never evaluated
 * at bot startup — only after the enable / guild / operator gates pass.
 */
export interface RecallWedgeHarnessModule {
  readonly projectAcrossMultiSurfaceFrames: (
    input: MultiSurfaceRecallInput,
  ) => MultiSurfaceRecallProjectionMatrix;
  readonly findMultiSurfaceBannedSubstring: (value: unknown) => string | null;
}

/**
 * Default lazy loader — dynamic-imports the Phase 38A harness through the
 * authorized package subpath. Evaluated ONLY on the fully-gated success path;
 * a disabled / wrong-guild / non-operator interaction never reaches it, so
 * the harness runtime stays unloaded for refused calls.
 */
async function defaultLoadHarness(): Promise<RecallWedgeHarnessModule> {
  return import(
    '@freeside-characters/persona-engine/recall-wedge/multi-surface-recall-harness'
  );
}

/** The single chosen command name (Phase 39A §E). No aliases. */
export const RECALL_WEDGE_DEMO_COMMAND_NAME = 'recall-wedge-demo';

/**
 * The single, stable, generic refusal string used for EVERY fail-closed path
 * (disabled / wrong guild / non-operator / contaminated output). It must not
 * differ between cases and must not leak which gate tripped (Phase 39A §D, §F).
 * Lowercase, no banned emojis, no production-recall wording.
 */
export const RECALL_WEDGE_DEMO_GENERIC_REFUSAL =
  'recall-wedge-demo is not available here.';

// -- env / config gate helpers (Phase 39A §D.1) ---------------------------

type Env = Record<string, string | undefined>;

/**
 * Disabled by default. Enabled ONLY when the env var is the exact string
 * "true" — "TRUE", "True", "1", "yes", and whitespace variants are all false,
 * and a missing var is false (fail closed).
 */
export function shouldEnableRecallWedgeDiscordDemo(env: Env): boolean {
  return env.RECALL_WEDGE_DISCORD_DEMO_ENABLED === 'true';
}

/**
 * Registration gate (Phase 39A §H). Exact string "true" only; missing/other
 * values fail closed. Phase 39B does not wire registration (see the module
 * note in the Phase 39B report), but the helper is provided + tested so a
 * later registration step inherits the exact-"true" posture by construction.
 */
export function shouldRegisterRecallWedgeDiscordDemo(env: Env): boolean {
  return env.RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS === 'true';
}

/**
 * Resolve the configured registration guild id (Phase 39C). Trims the value
 * and returns null when missing / blank / whitespace-only — registration
 * MUST fail closed (never global) when no guild is configured. This is the
 * registration-side counterpart to the invocation-time guild gate
 * (`isRecallWedgeDiscordDemoAllowedGuild`); it intentionally does NOT compare
 * against an interaction, it only surfaces the single allowed guild scope for
 * the guild-only registration path in `lib/publish-commands.ts`.
 */
export function resolveRecallWedgeDiscordDemoGuildId(env: Env): string | null {
  const id = env.RECALL_WEDGE_DISCORD_DEMO_GUILD_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/**
 * Parse the comma-separated operator allowlist. Trims each entry and drops
 * empties. A missing/blank var yields an empty list (which fails closed at
 * the operator check).
 */
export function parseRecallWedgeDiscordDemoOperatorIds(env: Env): string[] {
  const raw = env.RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Guild gate. The configured guild id (trimmed) must be non-empty AND must
 * exactly match interaction.guild_id. A missing configured guild, or an
 * interaction with no guild_id (e.g. a DM), fails closed.
 */
export function isRecallWedgeDiscordDemoAllowedGuild(
  interaction: DiscordInteraction,
  env: Env,
): boolean {
  const allowed = env.RECALL_WEDGE_DISCORD_DEMO_GUILD_ID?.trim();
  if (!allowed) return false;
  const guildId = interaction.guild_id;
  if (!guildId) return false;
  return guildId === allowed;
}

/**
 * Operator gate. The invoking user id (member.user.id in a guild, user.id in
 * a DM) must be present AND in the allowlist. An empty allowlist or a missing
 * invoker id fails closed.
 */
export function isRecallWedgeDiscordDemoOperator(
  interaction: DiscordInteraction,
  env: Env,
): boolean {
  const operatorIds = parseRecallWedgeDiscordDemoOperatorIds(env);
  if (operatorIds.length === 0) return false;
  const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!invokerId) return false;
  return operatorIds.includes(invokerId);
}

// -- deterministic demo input (Phase 39A §G) ------------------------------

/**
 * Fixed enum demo selectors. NOT freeform memory / recall queries — they map
 * to harness-internal canned inputs only. Anything outside this set falls
 * back to the default ("served").
 */
export const RECALL_WEDGE_DEMO_SELECTORS = ['served', 'denied'] as const;
export type RecallWedgeDemoSelector =
  (typeof RECALL_WEDGE_DEMO_SELECTORS)[number];

/** The slash option name for the enum selector (NOT a freeform query name). */
export const RECALL_WEDGE_DEMO_SELECTOR_OPTION = 'case';

const DEFAULT_RECALL_WEDGE_DEMO_SELECTOR: RecallWedgeDemoSelector = 'served';

// -- registration metadata (Phase 39C) ------------------------------------

/**
 * Discord application-command option-type constants used by the registration
 * payload (subset; mirrors `lib/publish-commands.ts`). STRING=3. Declared
 * locally so this module carries no import dependency on publish-commands.
 */
const STRING_OPTION_TYPE = 3 as const;

/**
 * The single, finite, harmless demo selector option exposed at registration
 * time (Phase 39A §E / §G). It is the `case` enum ONLY — NOT a freeform
 * prompt / query / text / message / memory / recall option. Its choices are
 * the same finite set the handler validates (`served` / `denied`); anything
 * else falls back to the default selector at invocation time.
 */
export interface RecallWedgeDemoCommandOptionChoice {
  readonly name: string;
  readonly value: RecallWedgeDemoSelector;
}

export interface RecallWedgeDemoCommandOption {
  readonly name: typeof RECALL_WEDGE_DEMO_SELECTOR_OPTION;
  readonly description: string;
  readonly type: typeof STRING_OPTION_TYPE;
  readonly required: false;
  readonly choices: readonly RecallWedgeDemoCommandOptionChoice[];
}

export interface RecallWedgeDemoCommandDefinition {
  readonly name: typeof RECALL_WEDGE_DEMO_COMMAND_NAME;
  readonly description: string;
  readonly options: readonly RecallWedgeDemoCommandOption[];
}

/**
 * The lightweight registration payload for `/recall-wedge-demo` (Phase 39C).
 *
 * This is plain metadata — no harness import, no runtime behavior — so it is
 * safe to import from `lib/publish-commands.ts` without dragging in the
 * Phase 38A harness (which is reached ONLY via the type-only import above and
 * the gated dynamic import inside the handler).
 *
 * The description is explicitly dev-only / gated / demo framed and makes no
 * production-memory / production-recall / consent claim (Phase 39A §E). The
 * only option is the finite `case` enum selector (Phase 39A §G).
 */
export const RECALL_WEDGE_DEMO_COMMAND_DEFINITION: RecallWedgeDemoCommandDefinition =
  {
    name: RECALL_WEDGE_DEMO_COMMAND_NAME,
    description:
      'dev-only gated demo · renders fixture-bound harness output (not production recall)',
    options: [
      {
        name: RECALL_WEDGE_DEMO_SELECTOR_OPTION,
        description: 'demo case to render (dev-only fixture selector)',
        type: STRING_OPTION_TYPE,
        required: false,
        choices: RECALL_WEDGE_DEMO_SELECTORS.map((s) => ({
          name: s,
          value: s,
        })),
      },
    ],
  };

/**
 * Read the fixed enum selector from the interaction options. Reads ONLY the
 * `case` option, validates against the allowlist, and falls back to the
 * default on anything unknown. No freeform text is ever interpreted as a
 * recall / memory query.
 */
export function readRecallWedgeDemoSelector(
  interaction: DiscordInteraction,
): RecallWedgeDemoSelector {
  const opt = interaction.data?.options?.find(
    (o) => o.name === RECALL_WEDGE_DEMO_SELECTOR_OPTION,
  );
  const value = typeof opt?.value === 'string' ? opt.value : undefined;
  if (
    value !== undefined &&
    (RECALL_WEDGE_DEMO_SELECTORS as readonly string[]).includes(value)
  ) {
    return value as RecallWedgeDemoSelector;
  }
  return DEFAULT_RECALL_WEDGE_DEMO_SELECTOR;
}

/**
 * Build a deterministic, built-in harness input for the chosen selector.
 *
 * The input intentionally carries contaminated raw/private/operational
 * material (the same posture as the Phase 38A harness tests) so the final
 * no-leak scan is NON-VACUOUS: the rendered output is proven clean even
 * though the input is dirty. None of this contaminated material is ever
 * supplied by, or derived from, the Discord interaction — it is a fixed
 * synthetic probe.
 */
export function buildRecallWedgeDemoInput(
  selector: RecallWedgeDemoSelector,
): MultiSurfaceRecallInput {
  const base = {
    continuity_actor_binding: 'recall-wedge-demo-binding',
    raw_continuity_actor_id: 'actor:freeside-characters:shared-substrate#demo',
    recall_result_id: 'rr-recall-wedge-demo',
    operator_diagnostic_label: 'recall_wedge_demo_operator_label',
    // Synthetic contamination — proves the boundary holds; never rendered.
    contaminated_internal: {
      PRIVATE_SENTINEL: 'PRIVATE_SENTINEL',
      raw_reasons: ['raw_reasons:PRIVATE_SENTINEL'],
      source_material: 'source_material_demo',
    },
    operational_ids: {
      session_id: 'session_id_demo',
      message_id: 'message_id_demo',
      tenant_id: 'tenant_id_demo',
      community_id: 'community_id_demo',
      session_thread_id: 'session_thread_id_demo',
      continuityActorId: 'continuityActorId_demo',
    },
  } satisfies Partial<MultiSurfaceRecallInput>;

  if (selector === 'served') {
    return {
      ...base,
      classification: 'served',
      safe_public_summary: 'redacted: 0 · marked: 1',
      safe_public_reason_labels: ['public-allowlisted-label'],
      safe_public_reason_counts: { redacted: 0, marked: 1 },
    };
  }
  // "denied" demo — public surface refuses.
  return {
    ...base,
    classification: 'denied_or_forbidden',
  };
}

// -- rendering (Phase 39A §H) ---------------------------------------------

const RECALL_WEDGE_DEMO_FRAMING_HEADER =
  'recall-wedge-demo · fixture-bound dev demo (not production recall)\n' +
  'gated · operator-only · ephemeral · phase 38a harness output';

/**
 * Build the public-bound success content from the Phase 38A matrix.
 *
 * Renders ONLY:
 *   - fixed dev-only framing text;
 *   - the public_discord_simulated frame's public text;
 *   - a compact per-frame outcome / refusal-code summary for the other
 *     frames (public-safe enum values only).
 *
 * It does NOT render operator_dev diagnostics, does NOT dump the whole
 * matrix, and does NOT emit any field that would fail the §I no-leak scan
 * (the caller still scans the final string as a defense-in-depth).
 */
export function renderRecallWedgeDemoContent(
  matrix: MultiSurfaceRecallProjectionMatrix,
): string {
  const discord = matrix.frames.public_discord_simulated;
  const lines: string[] = [RECALL_WEDGE_DEMO_FRAMING_HEADER, ''];

  lines.push('[public_discord_simulated]');
  lines.push(discord.public_text ?? '(no public text)');

  // Compact, public-safe per-frame outcome summary. operator_dev is
  // intentionally excluded — its diagnostic is operator-only and never
  // surfaces here. Only outcome + stable refusal code (both public-safe
  // enum strings) are listed.
  // Frame order is derived from the matrix itself (Object.keys) rather than
  // the harness's exported frame const, so this module needs no runtime
  // import of the harness for rendering. operator_dev is intentionally
  // excluded — its diagnostic is operator-only and never surfaces here.
  lines.push('');
  lines.push('frame outcomes:');
  for (const frame of Object.keys(matrix.frames) as Array<
    keyof typeof matrix.frames
  >) {
    if (frame === 'operator_dev') continue;
    const r = matrix.frames[frame];
    const code = r.refusal_code ? ` · ${r.refusal_code}` : '';
    lines.push(`- ${frame}: ${r.outcome}${code}`);
  }

  return lines.join('\n');
}

/**
 * Default success-content builder: project the demo input with the (already
 * lazily-loaded) Phase 38A harness and render it. The harness module is passed
 * in by the handler, which loads it ONLY after every gate passes.
 */
function defaultBuildSuccessContent(
  selector: RecallWedgeDemoSelector,
  harness: RecallWedgeHarnessModule,
): string {
  const matrix = harness.projectAcrossMultiSurfaceFrames(
    buildRecallWedgeDemoInput(selector),
  );
  return renderRecallWedgeDemoContent(matrix);
}

// -- ephemeral delivery (Phase 39A §F) ------------------------------------

/**
 * Build an ephemeral interaction response. EVERY response from this module —
 * success or refusal — goes through here, so there is no non-ephemeral path.
 */
function ephemeralResponse(content: string): DiscordInteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: MessageFlags.EPHEMERAL },
  };
}

/** The single generic refusal response (ephemeral, stable string). */
export function recallWedgeDemoRefusal(): DiscordInteractionResponse {
  return ephemeralResponse(RECALL_WEDGE_DEMO_GENERIC_REFUSAL);
}

/**
 * Injectable seams (Phase 39B patch). Tests use these to prove:
 *   - the harness is NOT loaded on refused (disabled/wrong-guild/non-operator)
 *     paths and IS loaded on the fully-gated success path (`loadHarness`);
 *   - a harness load failure after the gates pass still fails closed to the
 *     generic ephemeral refusal (`loadHarness` rejecting);
 *   - the contaminated-output fallback path (`buildSuccessContent`).
 */
export interface RecallWedgeDemoDeps {
  readonly loadHarness?: () => Promise<RecallWedgeHarnessModule>;
  readonly buildSuccessContent?: (
    selector: RecallWedgeDemoSelector,
    harness: RecallWedgeHarnessModule,
  ) => string;
}

/**
 * Handle a `/recall-wedge-demo` interaction.
 *
 * Fails closed (generic ephemeral refusal) unless ALL gates pass:
 *   enabled (exact "true") + allowed guild + operator allowlist.
 *
 * The Phase 38A harness is loaded LAZILY — only after all three gates pass
 * (Codex PATCH §2: no harness evaluation at bot startup). A refused
 * interaction never loads the harness. If the harness load fails after the
 * gates pass, we fall back to the SAME generic ephemeral refusal rather than
 * throwing into Discord dispatch.
 *
 * On success, renders the Phase 38A public_discord_simulated frame plus fixed
 * framing, then scans the final content with the harness banned-substring
 * posture; any hit falls back to the generic ephemeral refusal.
 *
 * Async because the harness is dynamically imported; the dispatcher awaits
 * the response. There is still no deferred PATCH, no follow-up, no webhook,
 * and no live call — the harness itself is pure and in-process.
 */
export async function handleRecallWedgeDemoInteraction(
  interaction: DiscordInteraction,
  env: Env = process.env,
  deps: RecallWedgeDemoDeps = {},
): Promise<DiscordInteractionResponse> {
  // Gate order is irrelevant to the user: all three fail to the SAME refusal.
  // No harness load happens before these checks, so a refused interaction
  // never evaluates the harness runtime.
  if (!shouldEnableRecallWedgeDiscordDemo(env)) return recallWedgeDemoRefusal();
  if (!isRecallWedgeDiscordDemoAllowedGuild(interaction, env)) {
    return recallWedgeDemoRefusal();
  }
  if (!isRecallWedgeDiscordDemoOperator(interaction, env)) {
    return recallWedgeDemoRefusal();
  }

  // Gates passed — NOW lazily load the harness. Any load failure fails closed
  // to the generic refusal (never throws to dispatch).
  const loadHarness = deps.loadHarness ?? defaultLoadHarness;
  let harness: RecallWedgeHarnessModule;
  try {
    harness = await loadHarness();
  } catch {
    return recallWedgeDemoRefusal();
  }

  const selector = readRecallWedgeDemoSelector(interaction);
  const build = deps.buildSuccessContent ?? defaultBuildSuccessContent;
  const content = build(selector, harness);

  // Final no-leak scan — same banned-substring posture as the Phase 38A
  // harness (Phase 39A §H / §I). On any hit, fall back to the generic
  // ephemeral refusal rather than emitting a leaky response.
  if (harness.findMultiSurfaceBannedSubstring(content) !== null) {
    return recallWedgeDemoRefusal();
  }

  return ephemeralResponse(content);
}
