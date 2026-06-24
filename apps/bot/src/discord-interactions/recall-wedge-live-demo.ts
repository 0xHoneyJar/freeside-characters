/**
 * Phase 41B · dev/operator-only LIVE Dixie Recall Wedge demo command
 * (`/recall-wedge-live-demo`).
 *
 * Authority: docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md (Phase 41A)
 * under the Phase 37B live Dixie client gate
 * (docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md). Phase 41A locked the SHAPE of
 * this work; Phase 41B implements that locked shape and nothing past it. Every
 * constraint below is binding; partial compliance does not satisfy the gate.
 *
 * This is a SEPARATE command from the Phase 39B `/recall-wedge-demo`. It does
 * NOT alias it, does NOT mutate it, and does NOT replace its harness output.
 * `/recall-wedge-demo` stays harness-backed and provably never imports the
 * live Dixie client (its Phase 39B static guard is preserved and re-asserted
 * by this command's test).
 *
 * What this module does (Phase 41A §F / §G / §J / §I / §K):
 *   - fails closed by default — disabled unless
 *     RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED is the exact string "true";
 *   - fails closed unless interaction.guild_id matches
 *     RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID;
 *   - fails closed unless the invoking user id is in
 *     RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS;
 *   - returns the SAME generic ephemeral refusal for disabled / wrong-guild /
 *     missing-guild / non-operator / empty-allowlist (never reveals which gate
 *     tripped, never reveals why Dixie refused);
 *   - evaluates ALL Discord gates BEFORE importing or calling the live Dixie
 *     client — a refused interaction never loads the client and makes NO
 *     network request;
 *   - after the gates pass, lazily imports the Phase 37C live Dixie client
 *     (the ONLY live-egress seam) through the authorized package subpath and
 *     drives it with a FIXED deterministic operator/dev request shape;
 *   - narrows the live result through the Phase 37C classifier vocabulary and
 *     renders only a public/operator-safe summary (classification + outcome +
 *     route + stable reason code) — never the raw Dixie response;
 *   - fails closed (generic ephemeral refusal) on unknown / unsafe / error
 *     classifications, on a thrown live client, and on any no-leak hit;
 *   - scans the final content with the Phase 37C client's exported
 *     banned-substring helper before returning;
 *   - is ephemeral on every path (success and refusal).
 *
 * What this module does NOT do (Phase 41A §F / §H / §O):
 *   - NO freeform recall / memory query — it reads NO interaction options at
 *     all; the request shape is a fixed synthetic operator/dev probe;
 *   - NO Discord message history / channel content as recall input;
 *   - NO memory admission, NO candidate writes, NO remembering affordance;
 *   - NO Telegram / private-chat surface, NO storage, NO LLM, NO character
 *     voice, NO production auth / consent claim;
 *   - NO raw network egress — all of it stays inside the Phase 37C live Dixie
 *     client (this module never opens its own HTTP path);
 *   - NO public channel-visible output;
 *   - does NOT mutate render-public-recall.ts or dixie-envelope-adapter.ts, and
 *     does NOT use recorded recall envelopes or any recorded fixture as live
 *     traffic.
 */

// Type-only import across the authorized package subpath (Phase 41B added a
// narrow recall-wedge client subpath to the persona-engine package exports to
// avoid an app to package deep relative import that would trip the apps/bot
// rootDir src TS6059, exactly as the Phase 39B harness command reaches the
// Phase 38A harness). import type is fully erased at build time, so this file
// carries NO runtime dependency on the live client at module load — the client
// runtime is pulled in lazily via defaultLoadLiveClient ONLY after every
// Discord gate passes (see the handler below).
import type {
  BuildDevSeededSignatureInput,
  LiveDixieClientConfig,
  LiveDixieRecallClassification,
  LiveDixieRecallResult,
  LiveRecallInput,
  LiveRecallSignatureEnvelopeInput,
} from '@freeside-characters/persona-engine/recall-wedge/live-dixie-client';
import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
  type DiscordInteractionResponse,
} from './types.ts';

/** The single chosen command name (Phase 41A §E). No aliases. */
export const RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME = 'recall-wedge-live-demo';

/**
 * The single, stable, generic refusal string used for EVERY fail-closed path
 * (disabled / wrong guild / missing guild / non-operator / empty allowlist /
 * load failure / unsafe classification / contaminated output). It must not
 * differ between cases and must not leak which gate tripped or why Dixie
 * refused (Phase 41A §K). Lowercase, no banned emojis, no production claim.
 */
export const RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL =
  'recall-wedge-live-demo is not available here.';

// -- runtime invocation env gates (Phase 41A §G · separate live gates) -----

type Env = Record<string, string | undefined>;

/**
 * Disabled by default. Enabled ONLY when the env var is the exact string
 * "true" — "TRUE", "True", "1", "yes", and whitespace variants are all false,
 * and a missing var is false (fail closed). These are the LIVE command's own
 * gates and never reuse the harness command's `RECALL_WEDGE_DISCORD_DEMO_*`
 * gates (Phase 41A §G).
 */
export function shouldEnableRecallWedgeLiveDiscordDemo(env: Env): boolean {
  return env.RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED === 'true';
}

/**
 * Registration gate (Phase 41A §M). Exact string "true" only; missing/other
 * values fail closed. Consumed by the guild-only registration helper in
 * `lib/publish-commands.ts`.
 */
export function shouldRegisterRecallWedgeLiveDiscordDemo(env: Env): boolean {
  return env.RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS === 'true';
}

/**
 * Resolve the configured guild id. Trims the value and returns null when
 * missing / blank / whitespace-only — registration MUST fail closed (never
 * global) when no guild is configured (Phase 41A §G). The single allowed
 * guild scope is shared by registration (`lib/publish-commands.ts`) and the
 * invocation-time guild gate below.
 */
export function resolveRecallWedgeLiveDiscordDemoGuildId(
  env: Env,
): string | null {
  const id = env.RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/**
 * Parse the comma-separated operator allowlist. Trims each entry and drops
 * empties. A missing/blank var yields an empty list (which fails closed at
 * the operator check).
 */
export function parseRecallWedgeLiveDiscordDemoOperatorIds(env: Env): string[] {
  const raw = env.RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS;
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
export function isRecallWedgeLiveDiscordDemoAllowedGuild(
  interaction: DiscordInteraction,
  env: Env,
): boolean {
  const allowed = resolveRecallWedgeLiveDiscordDemoGuildId(env);
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
export function isRecallWedgeLiveDiscordDemoOperator(
  interaction: DiscordInteraction,
  env: Env,
): boolean {
  const operatorIds = parseRecallWedgeLiveDiscordDemoOperatorIds(env);
  if (operatorIds.length === 0) return false;
  const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!invokerId) return false;
  return operatorIds.includes(invokerId);
}

// -- pre-Dixie gate diagnostics (Phase 42B · §K safe operator diagnostics) -
//
// Phase 41A §K explicitly permits "safe operator diagnostics ... if they
// contain no IDs / secrets / private fields — stable reason codes are fine."
// Phase 42B adds exactly that for the pre-Dixie refusal path: a single safe
// log line of BOOLEANS and a stable refusal CODE so an operator can see WHICH
// gate tripped without the public/ephemeral refusal ever revealing it.
//
// Hard no-leak contract (mirrors §K + the runbook §M "do not record" list):
// the diagnostics carry NO guild IDs, NO user IDs, NO operator allowlist
// contents, NO tokens, NO Dixie URL / token, NO raw interaction or Dixie
// payload, NO channel / message IDs, NO env names or values, and NO stack
// traces — only booleans and a fixed reason-code enum. The booleans answer
// "is the value present / does the gate pass" without ever surfacing the
// value itself.

/**
 * Stable, no-leak reason codes for a pre-Dixie gate refusal. These name
 * WHICH gate tripped for the operator log ONLY — they never reach Discord
 * (the public refusal stays the single generic string). `unknown_gate_refusal`
 * is a defensive fallback that should never be emitted in practice (it would
 * mean the refusal path ran with all gate booleans passing).
 */
export type RecallWedgeLiveDemoRefusalCode =
  | 'disabled'
  | 'missing_or_wrong_guild'
  | 'empty_allowlist'
  | 'non_operator'
  | 'missing_invoker'
  | 'unknown_gate_refusal';

/**
 * The safe, booleans-only snapshot of the pre-Dixie gate state. Every field is
 * a boolean or the fixed reason-code enum — there is intentionally no slot for
 * an ID, env value, token, or payload. `refusal_code` is null when ALL pre-Dixie
 * gates pass (the handler then proceeds to the gated live path).
 */
export interface RecallWedgeLiveDemoGateDiagnostics {
  readonly command: typeof RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME;
  readonly stage: 'pre_dixie_gate';
  readonly enabled_gate: boolean;
  readonly guild_gate: boolean;
  readonly operator_gate: boolean;
  readonly has_configured_guild: boolean;
  readonly has_interaction_guild: boolean;
  readonly has_operator_allowlist: boolean;
  readonly has_invoker_id: boolean;
  readonly refusal_code: RecallWedgeLiveDemoRefusalCode | null;
}

/**
 * Compute the safe pre-Dixie gate diagnostics. Pure: reads only env + the
 * presence/equality of interaction fields, evaluates the same three gate
 * helpers the handler uses, and derives a stable `refusal_code` following the
 * handler's precedence (enabled → guild → operator). Calls no client, makes no
 * network request, and copies NO id / value / token / payload into its result.
 *
 * `refusal_code` is null exactly when `enabled_gate && guild_gate &&
 * operator_gate` — i.e. when the handler would NOT refuse before Dixie. The
 * operator-gate failure is split into `empty_allowlist` (no allowlist
 * configured), `missing_invoker` (allowlist present but no invoker id), and
 * `non_operator` (invoker present but not allowlisted) so the operator log
 * distinguishes a misconfiguration from a genuinely-unauthorized caller —
 * still without ever logging the allowlist or the id.
 */
export function computeRecallWedgeLiveDemoGateDiagnostics(
  interaction: DiscordInteraction,
  env: Env,
): RecallWedgeLiveDemoGateDiagnostics {
  const enabled_gate = shouldEnableRecallWedgeLiveDiscordDemo(env);
  const guild_gate = isRecallWedgeLiveDiscordDemoAllowedGuild(interaction, env);
  const operator_gate = isRecallWedgeLiveDiscordDemoOperator(interaction, env);

  const has_configured_guild =
    resolveRecallWedgeLiveDiscordDemoGuildId(env) !== null;
  const has_interaction_guild = Boolean(interaction.guild_id);
  const has_operator_allowlist =
    parseRecallWedgeLiveDiscordDemoOperatorIds(env).length > 0;
  const has_invoker_id = Boolean(
    interaction.member?.user?.id ?? interaction.user?.id,
  );

  let refusal_code: RecallWedgeLiveDemoRefusalCode | null;
  if (!enabled_gate) {
    refusal_code = 'disabled';
  } else if (!guild_gate) {
    refusal_code = 'missing_or_wrong_guild';
  } else if (!operator_gate) {
    refusal_code = !has_operator_allowlist
      ? 'empty_allowlist'
      : !has_invoker_id
        ? 'missing_invoker'
        : 'non_operator';
  } else {
    refusal_code = null;
  }

  return {
    command: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
    stage: 'pre_dixie_gate',
    enabled_gate,
    guild_gate,
    operator_gate,
    has_configured_guild,
    has_interaction_guild,
    has_operator_allowlist,
    has_invoker_id,
    refusal_code,
  };
}

/**
 * Emit the safe pre-Dixie gate diagnostics as ONE operator log line. Called
 * only on the refusal path (so the line always carries a refusal code; a null
 * code is coerced to the defensive `unknown_gate_refusal`). The line is
 * booleans + the reason code only — it matches the repo's `interactions: …`
 * single-line key=value log convention and the lowercase-log voice rule, and
 * it contains no id / env value / token / payload by construction (the
 * `RecallWedgeLiveDemoGateDiagnostics` shape has nowhere to put one).
 */
function logRecallWedgeLiveDemoGateRefusal(
  diagnostics: RecallWedgeLiveDemoGateDiagnostics,
): void {
  const refusal_code = diagnostics.refusal_code ?? 'unknown_gate_refusal';
  console.warn(
    `interactions: ${diagnostics.command} pre-dixie gate refusal · ` +
      `command=${diagnostics.command} ` +
      `stage=${diagnostics.stage} ` +
      `enabled_gate=${diagnostics.enabled_gate} ` +
      `guild_gate=${diagnostics.guild_gate} ` +
      `operator_gate=${diagnostics.operator_gate} ` +
      `has_configured_guild=${diagnostics.has_configured_guild} ` +
      `has_interaction_guild=${diagnostics.has_interaction_guild} ` +
      `has_operator_allowlist=${diagnostics.has_operator_allowlist} ` +
      `has_invoker_id=${diagnostics.has_invoker_id} ` +
      `refusal_code=${refusal_code}`,
  );
}

// -- fixed deterministic operator/dev request shape (Phase 41A §H · Phase 42C) --

/**
 * The fixed synthetic operator/dev probe SHAPE (Phase 41A §H option 1) — every
 * field except the signature, which is computed per call (Phase 42C). It is a
 * code-reviewed constant, NOT derived from the interaction: no option is read,
 * no message history is read, no channel content is read, and there is no
 * fallback to interaction text.
 *
 * Phase 42C aligns this probe with Dixie's Phase 32K dev/operator seeded-estate
 * smoke (the only shape that passes against live seeded Dixie):
 *   - `environmentFrame: 'private_chat'` (was `private_operator`);
 *   - `detailLevel: 'standard'` / `receiptDetail: 'standard'` (were `minimal`).
 * The signature itself is NOT a constant here — it binds to
 * `actor_id === estate_id === wallet`, and the wallet only exists once the
 * Phase 37C client's `RECALL_WEDGE_DIXIE_*` config is loaded. So the handler
 * computes a fresh Phase 32K `dev_signature` (via the client's
 * `buildDevSeededRecallSignature`) AFTER config load, using the configured
 * tenant wallet — never any Discord input, never a hard-coded placeholder.
 * This carries no secret value: the signer / key_ref are PUBLIC dev-seed
 * labels fixed by Dixie's seed contract, and the live Dixie secrets live only
 * in the Phase 37C client's own env (§G), which this module does not read.
 * No fixed idempotencyKey is set, so the live client mints a fresh key per
 * call (no reuse).
 */
const RECALL_WEDGE_LIVE_DEMO_PROBE = {
  recallRequestId: 'recall-wedge-live-demo-1',
  task: 'recall-wedge-live-demo operator/dev probe',
  environmentFrame: 'private_chat',
  riskProfile: 'low',
  detailLevel: 'standard',
  receiptDetail: 'standard',
  signatureId: 'recall-wedge-live-demo-sig',
  signedAt: '2026-05-18T00:00:00Z',
  createdAt: '2026-05-18T00:00:00Z',
} as const;

/**
 * Build the full live recall input for the fixed probe by computing a Phase
 * 32K-compatible `dev_signature` from the configured tenant wallet
 * (`config.tenantId`, which the live client already binds to
 * `actor_id === estate_id === requested_by`). The crypto lives in the Phase
 * 37C client (`buildDevSeededRecallSignature`); this module only assembles the
 * already-fixed probe fields around it. The wallet is read from config (env),
 * never from the interaction, and is used ONLY to sign — it is never logged or
 * rendered.
 */
function buildRecallWedgeLiveDemoInput(
  client: RecallWedgeLiveDixieClientModule,
  config: LiveDixieClientConfig,
): LiveRecallInput {
  const probe = RECALL_WEDGE_LIVE_DEMO_PROBE;
  const signature = client.buildDevSeededRecallSignature({
    wallet: config.tenantId,
    task: probe.task,
    environmentFrame: probe.environmentFrame,
    riskProfile: probe.riskProfile,
    signatureId: probe.signatureId,
    signedAt: probe.signedAt,
  });
  return {
    recallRequestId: probe.recallRequestId,
    task: probe.task,
    environmentFrame: probe.environmentFrame,
    riskProfile: probe.riskProfile,
    detailLevel: probe.detailLevel,
    receiptDetail: probe.receiptDetail,
    signature,
    createdAt: probe.createdAt,
  };
}

// -- live Dixie client seam (Phase 41A §J · lazy after gates) --------------

/**
 * The narrow runtime surface this command needs from the Phase 37C live Dixie
 * client. Resolved lazily (dynamic import) so the client module is never
 * evaluated at bot startup — only after the enable / guild / operator gates
 * pass. All live network egress lives inside `liveRecallViaDixie` (the client),
 * never in this module.
 */
export interface RecallWedgeLiveDixieClientModule {
  readonly loadLiveDixieClientConfigFromEnv: (
    env: Env,
  ) => LiveDixieClientConfig;
  readonly liveRecallViaDixie: (
    input: LiveRecallInput,
    config: LiveDixieClientConfig,
  ) => Promise<LiveDixieRecallResult>;
  // Phase 42C · computes a self-consistent Phase 32K dev/operator seeded-estate
  // `dev_signature` envelope from the configured tenant wallet (the crypto and
  // the public dev-seed labels live in the client, never here).
  readonly buildDevSeededRecallSignature: (
    input: BuildDevSeededSignatureInput,
  ) => LiveRecallSignatureEnvelopeInput;
  readonly findBannedPublicSubstring: (value: unknown) => string | null;
}

/**
 * Default lazy loader — dynamic-imports the Phase 37C live Dixie client
 * through the authorized package subpath. Evaluated ONLY on the fully-gated
 * path; a disabled / wrong-guild / non-operator interaction never reaches it,
 * so the client runtime (and its network egress) stays unloaded for refused
 * calls.
 */
async function defaultLoadLiveClient(): Promise<RecallWedgeLiveDixieClientModule> {
  return import(
    '@freeside-characters/persona-engine/recall-wedge/live-dixie-client'
  );
}

// -- classification → render decision (Phase 41A §I) -----------------------

/**
 * Classifications that may render a public/operator-safe summary. Their
 * `stable_reason_code` is classifier-controlled in the Phase 37C client (never
 * an echoed raw upstream string), and the config classes' reason codes are
 * overridden to the bare class name below so no env name can ride along.
 */
const SAFE_SUMMARY_CLASSIFICATIONS = new Set<LiveDixieRecallClassification>([
  'served',
  'denied_or_forbidden',
  'needs_review',
  'ingress_invalid_request',
  'service_unauthorized',
  'tenant_or_session_mismatch',
  'rate_limited',
  'upstream_unavailable',
  'missing_required_env',
  'invalid_config',
]);

/**
 * Classifications that ALWAYS fail closed to the generic refusal (Phase 41A
 * §I): an unsafely-narrowable response shape, a transport failure, or unsafe
 * idempotency-key reuse. Any classification not in `SAFE_SUMMARY_*` also fails
 * closed by default (the renderer treats unknown classes as fail-closed).
 */
const FAIL_CLOSED_CLASSIFICATIONS = new Set<LiveDixieRecallClassification>([
  'unsupported_response_shape',
  'network_error',
  'unsafe_idempotency_key_reuse',
]);

/**
 * The fixed, public-safe Dixie route string surfaced in the operator summary
 * (Phase 41A §I allows a safe non-secret route/path summary). Declared as a
 * local literal so this module imports no client value at runtime; it matches
 * the Phase 37C client's `LIVE_DIXIE_CLIENT_INTAKE_PATH`.
 */
const RECALL_WEDGE_LIVE_DEMO_ROUTE = '/api/recall/intake';

const RECALL_WEDGE_LIVE_DEMO_FRAMING_HEADER =
  'recall-wedge-live-demo · live Dixie dev demo (not production recall)\n' +
  'gated · operator-only · ephemeral · phase 37c live Dixie client output';

/**
 * The minimal public/operator-safe slice of a live result the renderer reads.
 * Only the narrowed classification / outcome / stable reason code — never the
 * raw Dixie response, never `internal_diagnostic`, never raw_reasons / source
 * fields / IDs / tokens.
 */
interface RenderableLiveSummary {
  readonly classification: LiveDixieRecallClassification;
  readonly outcome: string;
  readonly stable_reason_code: string;
}

/**
 * Render the public/operator-safe live-demo content from a narrowed summary,
 * or return null to signal "fail closed to the generic refusal".
 *
 * Renders ONLY: the fixed dev-only framing, the classification, the public-safe
 * outcome enum, the fixed safe route, and a stable reason code. For the config
 * classes (`missing_required_env` / `invalid_config`) the reason is forced to
 * the bare class name so a `missing:<ENV_NAME>`-style reason code can never
 * surface an env name. Unknown / fail-closed classifications return null. The
 * caller still runs the no-leak scan over this string as defense-in-depth.
 */
export function renderRecallWedgeLiveDemoContent(
  summary: RenderableLiveSummary,
): string | null {
  if (FAIL_CLOSED_CLASSIFICATIONS.has(summary.classification)) return null;
  if (!SAFE_SUMMARY_CLASSIFICATIONS.has(summary.classification)) return null;

  const reason =
    summary.classification === 'missing_required_env' ||
    summary.classification === 'invalid_config'
      ? summary.classification
      : summary.stable_reason_code;

  return [
    RECALL_WEDGE_LIVE_DEMO_FRAMING_HEADER,
    '',
    `classification: ${summary.classification}`,
    `outcome:        ${summary.outcome}`,
    `route:          ${RECALL_WEDGE_LIVE_DEMO_ROUTE}`,
    `reason:         ${reason}`,
  ].join('\n');
}

/**
 * Map a thrown live-client config error to a classification WITHOUT importing
 * the client's error class as a runtime value (the static import stays
 * type-only). Duck-types on the error's `code` field; anything unrecognized
 * collapses to the conservative `invalid_config`.
 */
function configErrorClassification(
  err: unknown,
): 'missing_required_env' | 'invalid_config' {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;
  return code === 'missing_required_env' ? 'missing_required_env' : 'invalid_config';
}

// -- ephemeral delivery (Phase 41A §F · ephemeral-only) --------------------

/**
 * Build an ephemeral interaction response. EVERY response from this module —
 * success or refusal — goes through here, so there is no non-ephemeral path
 * and no public channel-visible output.
 */
function ephemeralResponse(content: string): DiscordInteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: MessageFlags.EPHEMERAL },
  };
}

/** The single generic refusal response (ephemeral, stable string). */
export function recallWedgeLiveDemoRefusal(): DiscordInteractionResponse {
  return ephemeralResponse(RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL);
}

/**
 * Injectable seam (Phase 41B). Tests use `loadLiveClient` to prove:
 *   - the live client is NOT loaded on refused (disabled/wrong-guild/
 *     non-operator/empty-allowlist) paths and IS loaded only after the gates
 *     pass;
 *   - the injected client's `liveRecallViaDixie` is invoked exactly when
 *     expected (call counting) and never on refused paths;
 *   - a load failure after the gates pass fails closed to the generic refusal;
 *   - a thrown live client fails closed;
 *   - contaminated summaries fall back to the generic refusal (the injected
 *     module supplies the real banned-substring helper).
 * There is no network seam here: live egress is the client's responsibility,
 * and tests inject the whole client module rather than a network primitive.
 */
export interface RecallWedgeLiveDemoDeps {
  readonly loadLiveClient?: () => Promise<RecallWedgeLiveDixieClientModule>;
}

/**
 * Handle a `/recall-wedge-live-demo` interaction.
 *
 * Fails closed (generic ephemeral refusal) unless ALL Discord gates pass:
 *   enabled (exact "true") + allowed guild + operator allowlist.
 *
 * The Phase 37C live Dixie client is loaded LAZILY — only after all three
 * gates pass (Phase 41A §J: no client evaluation, and crucially no network
 * egress, on refused paths). After the gates pass, the handler:
 *   1. lazily imports the live client seam (load failure → generic refusal);
 *   2. loads the live client's own `RECALL_WEDGE_DIXIE_*` config (a config
 *      throw is mapped to a safe `missing_required_env` / `invalid_config`
 *      classification — never echoing an env name);
 *   3. calls `liveRecallViaDixie` with the FIXED operator/dev probe (a thrown
 *      client → generic refusal);
 *   4. narrows the result and renders a public/operator-safe summary, or fails
 *      closed for unknown / unsafe / transport classifications;
 *   5. runs the client's banned-substring no-leak scan over the final content
 *      and falls back to the generic refusal on any hit.
 *
 * Async because the client is dynamically imported and called; the dispatcher
 * awaits the response. The only network egress is inside the client.
 */
export async function handleRecallWedgeLiveDemoInteraction(
  interaction: DiscordInteraction,
  env: Env = process.env,
  deps: RecallWedgeLiveDemoDeps = {},
): Promise<DiscordInteractionResponse> {
  // Gate order is irrelevant to the user: all gates fail to the SAME refusal.
  // No client load — and therefore no network egress — happens before these
  // checks, so a refused interaction never reaches the live path.
  //
  // Phase 42B (§K safe operator diagnostics): compute the booleans-only gate
  // snapshot up front. The PUBLIC refusal is unchanged — still the single
  // generic ephemeral string with no hint of which gate tripped — but on a
  // pre-Dixie refusal we emit ONE safe operator log line (booleans + stable
  // reason code, no IDs / tokens / env values / payloads) so operators can
  // diagnose which gate is failing. `refusal_code` is null only when all three
  // gates pass, so the log fires exactly on the refusal branch below.
  const gateDiagnostics = computeRecallWedgeLiveDemoGateDiagnostics(
    interaction,
    env,
  );
  if (gateDiagnostics.refusal_code !== null) {
    logRecallWedgeLiveDemoGateRefusal(gateDiagnostics);
    return recallWedgeLiveDemoRefusal();
  }

  // Gates passed — NOW lazily load the live client. Any load failure fails
  // closed to the generic refusal (never throws to dispatch).
  const loadLiveClient = deps.loadLiveClient ?? defaultLoadLiveClient;
  let client: RecallWedgeLiveDixieClientModule;
  try {
    client = await loadLiveClient();
  } catch {
    return recallWedgeLiveDemoRefusal();
  }

  // Resolve the live result. Config errors are mapped to safe classes; a
  // thrown live call fails closed. NOTE: the request shape is the fixed
  // synthetic probe above — the interaction's options are never read.
  let summary: RenderableLiveSummary;
  try {
    const config = client.loadLiveDixieClientConfigFromEnv(env);
    // Phase 42C: assemble the fixed probe with a per-call Phase 32K-compatible
    // dev signature bound to the configured tenant wallet (from env via
    // config, never from the interaction). The request shape is otherwise the
    // code-reviewed constant above — no option is read.
    const input = buildRecallWedgeLiveDemoInput(client, config);
    let result: LiveDixieRecallResult;
    try {
      result = await client.liveRecallViaDixie(input, config);
    } catch {
      // A thrown live client fails closed (Phase 41A §I / §J).
      return recallWedgeLiveDemoRefusal();
    }
    summary = {
      classification: result.public_summary.classification,
      outcome: result.public_summary.outcome,
      stable_reason_code: result.public_summary.stable_reason_code,
    };
  } catch (err) {
    // Missing / invalid live Dixie env/config fails closed to a SAFE classified
    // summary (no env values, no env names) per Phase 41A §I.
    const classification = configErrorClassification(err);
    summary = {
      classification,
      outcome: 'config_error',
      stable_reason_code: classification,
    };
  }

  const content = renderRecallWedgeLiveDemoContent(summary);
  if (content === null) return recallWedgeLiveDemoRefusal();

  // Final no-leak scan — the Phase 37C client's exported banned-substring
  // posture (Phase 41A §I). On any hit, fall back to the generic ephemeral
  // refusal rather than emitting a leaky response.
  if (client.findBannedPublicSubstring(content) !== null) {
    return recallWedgeLiveDemoRefusal();
  }

  return ephemeralResponse(content);
}

// -- registration metadata (Phase 41A §M · guild-scoped only) --------------

/**
 * The `/recall-wedge-live-demo` registration payload (Phase 41A §M).
 *
 * Plain metadata — no client import, no runtime behavior — so it is safe to
 * import from `lib/publish-commands.ts` without dragging in the live Dixie
 * client (which is reached ONLY via the type-only import above and the gated
 * dynamic import inside the handler).
 *
 * The description is explicitly dev-only / gated / live-Dixie / demo framed and
 * makes NO production memory / recall / consent claim (it disclaims "not
 * production recall"). There are NO options at all — the request shape is the
 * fixed synthetic probe, so no freeform query path can exist (Phase 41A §H).
 */
export interface RecallWedgeLiveDemoCommandDefinition {
  readonly name: typeof RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME;
  readonly description: string;
  readonly options: readonly never[];
}

export const RECALL_WEDGE_LIVE_DEMO_COMMAND_DEFINITION: RecallWedgeLiveDemoCommandDefinition =
  {
    name: RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME,
    description:
      'dev-only gated live Dixie demo (not production recall) · operator-only',
    options: [],
  };
