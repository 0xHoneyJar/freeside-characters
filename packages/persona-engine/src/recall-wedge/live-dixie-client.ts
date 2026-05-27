// Phase 37C · isolated operator/dev-only live Dixie recall-intake client.
//
// Authority: docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md (Phase 37B gate).
//
// Scope (per Phase 37B §C):
//   - this module is the ONLY place in freeside-characters that may issue a
//     live HTTP call to Dixie's `POST /api/recall/intake`;
//   - it is operator/dev-only — no Discord, Telegram, storage, admission,
//     LLM, voice, or character output is wired through here;
//   - Phase 35D's recorded fixture adapter
//     (`./dixie-envelope-adapter.ts`) is NOT repurposed here. The live
//     client lives in this distinct module per gate §F / §J;
//   - the public-safe renderer (`./render-public-recall.ts`) is not
//     imported. The live client never feeds raw Dixie output into a
//     public renderer.
//
// Hard non-goals (per Phase 37B §C, §D, §K):
//   - no @loa/dixie / @loa/straylight / Finn import (runtime or value);
//   - no Discord client / Telegram client / bot framework / commands;
//   - no Postgres / Redis / object-storage / vector-index import;
//   - no LLM SDK import;
//   - no character voice;
//   - no use of `recorded_dixie_recall_envelope` for live traffic;
//   - no admission of operator-provided text as Straylight memory.
//
// Dixie contract evidence consulted while implementing this module:
//   - docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md (Phase 37A);
//   - docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md (Phase 37B);
//   - ../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md;
//   - ../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md;
//   - ../loa-dixie/app/src/routes/recall-intake.ts (route, ingress schema,
//     authoritative-tenant rule, Idempotency-Key requirement);
//   - ../loa-dixie/app/src/services/straylight-recall-intake/refusal-mapping.ts
//     (HTTP refusal classes + raw_reasons shape);
//   - ../loa-dixie/app/tests/integration/recall-intake/route.test.ts (proven
//     wire shape; Bearer/wallet-bridge auth; required headers).

// -- classification vocabulary ---------------------------------------------

export const LIVE_DIXIE_RECALL_CLASSIFICATIONS = [
  "served",
  "denied_or_forbidden",
  "needs_review",
  "ingress_invalid_request",
  "service_unauthorized",
  "tenant_or_session_mismatch",
  "rate_limited",
  "upstream_unavailable",
  "unsupported_response_shape",
  "network_error",
  "missing_required_env",
  "invalid_config",
  "unsafe_idempotency_key_reuse",
] as const;

export type LiveDixieRecallClassification =
  (typeof LIVE_DIXIE_RECALL_CLASSIFICATIONS)[number];

// -- config / env ----------------------------------------------------------

export interface LiveDixieClientConfig {
  readonly baseUrl: string;
  readonly serviceToken: string;
  readonly tenantId: string;
  readonly callerActorId: string;
  readonly requestKeyPrefix: string;
  readonly timeoutMs: number;
}

export const LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS = 10_000;
export const LIVE_DIXIE_CLIENT_MAX_TIMEOUT_MS = 60_000;
export const LIVE_DIXIE_CLIENT_MAX_REQUEST_KEY_LEN = 256;
export const LIVE_DIXIE_CLIENT_INTAKE_PATH = "/api/recall/intake" as const;

export class LiveDixieClientConfigError extends Error {
  readonly code: LiveDixieRecallClassification;
  readonly missingEnv?: string;
  constructor(
    code: "missing_required_env" | "invalid_config",
    message: string,
    missingEnv?: string,
  ) {
    super(message);
    this.name = "LiveDixieClientConfigError";
    this.code = code;
    if (missingEnv !== undefined) this.missingEnv = missingEnv;
  }
}

const REQUIRED_ENV_KEYS = [
  "RECALL_WEDGE_DIXIE_BASE_URL",
  "RECALL_WEDGE_DIXIE_SERVICE_TOKEN",
  "RECALL_WEDGE_DIXIE_TENANT_ID",
  "RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID",
  "RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function trimTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
  return s.slice(0, end);
}

function parseTimeoutMs(raw: string | undefined): number {
  if (raw === undefined || raw.length === 0) {
    return LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `RECALL_WEDGE_DIXIE_TIMEOUT_MS must be a positive integer, got "${raw}"`,
    );
  }
  if (n > LIVE_DIXIE_CLIENT_MAX_TIMEOUT_MS) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `RECALL_WEDGE_DIXIE_TIMEOUT_MS=${n} exceeds the conservative ceiling of ${LIVE_DIXIE_CLIENT_MAX_TIMEOUT_MS}ms`,
    );
  }
  return n;
}

function parseBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `RECALL_WEDGE_DIXIE_BASE_URL is not a valid URL: "${raw}"`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `RECALL_WEDGE_DIXIE_BASE_URL must be http(s); got "${parsed.protocol}"`,
    );
  }
  return trimTrailingSlashes(`${parsed.origin}${parsed.pathname}`);
}

export function loadLiveDixieClientConfigFromEnv(
  env: Record<string, string | undefined> = (
    typeof process !== "undefined" && process && process.env
      ? process.env
      : {}
  ) as Record<string, string | undefined>,
): LiveDixieClientConfig {
  for (const key of REQUIRED_ENV_KEYS) {
    if (!isNonEmptyString(env[key])) {
      throw new LiveDixieClientConfigError(
        "missing_required_env",
        `required env "${key}" is missing or empty`,
        key,
      );
    }
  }

  const baseUrl = parseBaseUrl(env.RECALL_WEDGE_DIXIE_BASE_URL as string);
  const timeoutMs = parseTimeoutMs(env.RECALL_WEDGE_DIXIE_TIMEOUT_MS);

  return {
    baseUrl,
    serviceToken: env.RECALL_WEDGE_DIXIE_SERVICE_TOKEN as string,
    tenantId: env.RECALL_WEDGE_DIXIE_TENANT_ID as string,
    callerActorId: env.RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID as string,
    requestKeyPrefix: env.RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX as string,
    timeoutMs,
  };
}

// -- request building ------------------------------------------------------

// Allow-list of environment frames the operator may carry through. Per
// Dixie Phase 32E the route accepts the wedge enum here; the live client
// does NOT expand the vocabulary on its own. Operator picks one.
//
// Phase 37C explicitly has NO positive support for `public_telegram`. The
// live client rejects it fail-closed before any network call. The string
// is preserved only as a static-guard / non-goal phrase below; it is not
// an accepted live request value.
const ALLOWED_ENVIRONMENT_FRAMES = [
  "private_operator",
  "private_chat",
  "public_discord",
  "repo_workflow",
  "tool_action_precheck",
  "audit_review",
] as const;
export type LiveRecallEnvironmentFrame =
  (typeof ALLOWED_ENVIRONMENT_FRAMES)[number];

// Phase 37C non-goal: explicitly disallowed environment frames. Listed by
// name so an operator typo or a recorded-fixture leak that resurrects a
// disallowed frame fails closed before fetch.
export const LIVE_DIXIE_DISALLOWED_ENVIRONMENT_FRAMES = [
  "public_telegram",
] as const;

const ALLOWED_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type LiveRecallRiskLevel = (typeof ALLOWED_RISK_LEVELS)[number];

const ALLOWED_DETAIL_LEVELS = ["minimal", "standard", "debug"] as const;
export type LiveRecallDetailLevel = (typeof ALLOWED_DETAIL_LEVELS)[number];

const ALLOWED_HOST_FRAMES = ["actor_private", "public_discord"] as const;
export type LiveRecallHostFrame = (typeof ALLOWED_HOST_FRAMES)[number];

export interface LiveRecallSignatureEnvelopeInput {
  readonly signature_id: string;
  readonly signer_id: string;
  readonly signer_type:
    | "actor_controller"
    | "operator"
    | "runtime"
    | "reviewer"
    | "policy_service"
    | "admin"
    | "wallet"
    | "service_key";
  readonly signature_type:
    | "ed25519"
    | "secp256k1"
    | "hmac"
    | "dev_signature";
  readonly signed_payload_hash: string;
  readonly signature: string;
  readonly signed_at: string;
  readonly key_ref: string;
}

export interface LiveRecallInput {
  readonly recallRequestId: string;
  readonly task: string;
  readonly environmentFrame: LiveRecallEnvironmentFrame;
  readonly riskProfile: LiveRecallRiskLevel;
  readonly detailLevel: LiveRecallDetailLevel;
  readonly receiptDetail: LiveRecallDetailLevel;
  readonly signature: LiveRecallSignatureEnvelopeInput;
  readonly createdAt: string;
  readonly hostFrame?: LiveRecallHostFrame;
  readonly intent?: string;
  readonly idempotencyKey?: string;
}

export interface LiveDixieRequestPlan {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
}

function assertConfigInvariants(config: LiveDixieClientConfig): void {
  for (const key of REQUIRED_ENV_KEYS) {
    const lookup: Record<string, string> = {
      RECALL_WEDGE_DIXIE_BASE_URL: config.baseUrl,
      RECALL_WEDGE_DIXIE_SERVICE_TOKEN: config.serviceToken,
      RECALL_WEDGE_DIXIE_TENANT_ID: config.tenantId,
      RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID: config.callerActorId,
      RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX: config.requestKeyPrefix,
    };
    if (!isNonEmptyString(lookup[key])) {
      throw new LiveDixieClientConfigError(
        "missing_required_env",
        `config field for "${key}" is missing or empty`,
        key,
      );
    }
  }
}

// Dixie's authoritative-tenant rule (route.ts §3.d) requires that
// `request.actor_id`, `request.estate_id`, `request.requested_by`,
// `caller.tenant_id`, and `caller.actor_id` all equal the session wallet.
// The live client enforces this locally by binding tenantId === callerActorId.
// Mismatches fail closed before any network call.
function assertOperatorIdentityConsistency(config: LiveDixieClientConfig): void {
  if (config.tenantId !== config.callerActorId) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      "Dixie route requires caller.tenant_id === caller.actor_id === session wallet; tenantId and callerActorId must match",
    );
  }
}

// Stable JSON serializer with sorted keys, used for request fingerprint
// computation. Pure (no I/O). Cycle-unsafe: callers pass plain JSON-shaped
// objects.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(k)}:${stableStringify(v)}`);
  }
  return `{${parts.join(",")}}`;
}

// FNV-1a 64-bit (BigInt) — adequate for an in-process fingerprint used to
// detect accidental Idempotency-Key reuse with different content. Not a
// cryptographic identifier.
function fingerprintForBody(body: Record<string, unknown>): string {
  const canonical = stableStringify(body);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = (hash ^ BigInt(canonical.charCodeAt(i))) & mask;
    hash = (hash * prime) & mask;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function computeLiveDixieRequestFingerprint(
  body: Record<string, unknown>,
): string {
  return fingerprintForBody(body);
}

// In-process detection of unsafe key reuse with different content. The live
// client tracks `(tenant_id, caller_actor_id, request_key) → fingerprint`
// across calls; a follow-up call with the same key but a different
// fingerprint surfaces `unsafe_idempotency_key_reuse` BEFORE network.
//
// Operators may construct an isolated detector for tests. The default is a
// module-private singleton.
export interface IdempotencyReuseDetector {
  observe(
    tenantId: string,
    callerActorId: string,
    requestKey: string,
    fingerprint: string,
  ): "ok" | "unsafe_reuse";
}

export function createIdempotencyReuseDetector(): IdempotencyReuseDetector {
  const seen = new Map<string, string>();
  return {
    observe(tenantId, callerActorId, requestKey, fingerprint) {
      const k = JSON.stringify([tenantId, callerActorId, requestKey]);
      const prior = seen.get(k);
      if (prior !== undefined && prior !== fingerprint) return "unsafe_reuse";
      if (prior === undefined) seen.set(k, fingerprint);
      return "ok";
    },
  };
}

const DEFAULT_REUSE_DETECTOR = createIdempotencyReuseDetector();

function generateIdempotencyKey(prefix: string): string {
  // Operator/dev-only key: prefix + monotonic time + random tail. The live
  // client never silently reuses across logical requests; operators may
  // pass `idempotencyKey` explicitly for retries.
  const t = Date.now().toString(36);
  let r = "";
  for (let i = 0; i < 8; i += 1) {
    r += Math.floor(Math.random() * 36)
      .toString(36)
      .charAt(0);
  }
  return `${prefix}-${t}-${r}`;
}

// Build the deterministic request plan. Body shape is reconstructed only
// from operator inputs and config — there is no implicit fallback. Mirrors
// `RecallIntakeBodySchema` from `../loa-dixie/app/src/routes/recall-intake.ts`.
export function buildLiveDixieRecallRequestPlan(
  input: LiveRecallInput,
  config: LiveDixieClientConfig,
): LiveDixieRequestPlan {
  assertConfigInvariants(config);
  assertOperatorIdentityConsistency(config);

  if (!isNonEmptyString(input.recallRequestId)) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      "input.recallRequestId is required",
    );
  }
  if (!isNonEmptyString(input.task)) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      "input.task is required",
    );
  }
  if (
    (LIVE_DIXIE_DISALLOWED_ENVIRONMENT_FRAMES as readonly string[]).includes(
      input.environmentFrame as string,
    )
  ) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.environmentFrame "${String(input.environmentFrame)}" is a Phase 37C non-goal; live client has no positive support for it`,
    );
  }
  if (
    !(ALLOWED_ENVIRONMENT_FRAMES as readonly string[]).includes(
      input.environmentFrame,
    )
  ) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.environmentFrame must be one of ${ALLOWED_ENVIRONMENT_FRAMES.join("|")}`,
    );
  }
  if (!(ALLOWED_RISK_LEVELS as readonly string[]).includes(input.riskProfile)) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.riskProfile must be one of ${ALLOWED_RISK_LEVELS.join("|")}`,
    );
  }
  if (
    !(ALLOWED_DETAIL_LEVELS as readonly string[]).includes(input.detailLevel)
  ) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.detailLevel must be one of ${ALLOWED_DETAIL_LEVELS.join("|")}`,
    );
  }
  if (
    !(ALLOWED_DETAIL_LEVELS as readonly string[]).includes(input.receiptDetail)
  ) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.receiptDetail must be one of ${ALLOWED_DETAIL_LEVELS.join("|")}`,
    );
  }
  if (
    input.hostFrame !== undefined &&
    !(ALLOWED_HOST_FRAMES as readonly string[]).includes(input.hostFrame)
  ) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `input.hostFrame must be one of ${ALLOWED_HOST_FRAMES.join("|")} or undefined`,
    );
  }
  if (!isNonEmptyString(input.createdAt)) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      "input.createdAt is required",
    );
  }

  const wallet = config.tenantId;
  const requestBody: Record<string, unknown> = {
    request: {
      recall_request_id: input.recallRequestId,
      actor_id: wallet,
      estate_id: wallet,
      requested_by: wallet,
      task: input.task,
      ...(input.intent !== undefined ? { intent: input.intent } : {}),
      environment_frame: input.environmentFrame,
      risk_profile: input.riskProfile,
      include_receipt_detail: input.receiptDetail,
      signature: {
        signature_id: input.signature.signature_id,
        signer_id: input.signature.signer_id,
        signer_type: input.signature.signer_type,
        signature_type: input.signature.signature_type,
        signed_payload_hash: input.signature.signed_payload_hash,
        signature: input.signature.signature,
        signed_at: input.signature.signed_at,
        key_ref: input.signature.key_ref,
      },
      created_at: input.createdAt,
    },
    detail_level: input.detailLevel,
    caller: {
      tenant_id: wallet,
      actor_id: wallet,
      ...(input.hostFrame !== undefined ? { frame: input.hostFrame } : {}),
    },
  };

  const idempotencyKey =
    input.idempotencyKey !== undefined && input.idempotencyKey.length > 0
      ? input.idempotencyKey
      : generateIdempotencyKey(config.requestKeyPrefix);

  if (idempotencyKey.length === 0) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      "Idempotency-Key is required (1-256 chars) per Dixie Phase 32E §2.3",
    );
  }
  if (idempotencyKey.length > LIVE_DIXIE_CLIENT_MAX_REQUEST_KEY_LEN) {
    throw new LiveDixieClientConfigError(
      "invalid_config",
      `Idempotency-Key length ${idempotencyKey.length} exceeds Dixie's ${LIVE_DIXIE_CLIENT_MAX_REQUEST_KEY_LEN}-char ceiling`,
    );
  }

  const url = `${config.baseUrl}${LIVE_DIXIE_CLIENT_INTAKE_PATH}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${config.serviceToken}`,
    "idempotency-key": idempotencyKey,
  };

  return {
    url,
    method: "POST",
    headers,
    body: requestBody,
    idempotencyKey,
    fingerprint: fingerprintForBody(requestBody),
  };
}

// -- result types ----------------------------------------------------------

export interface LiveDixieRecallPublicSummary {
  readonly outcome:
    | "served"
    | "denied"
    | "needs_review"
    | "ingress_refused"
    | "service_unauthorized"
    | "rate_limited"
    | "upstream_unavailable"
    | "network_error"
    | "unsupported_response_shape"
    | "config_error"
    | "unsafe_idempotency_key_reuse";
  readonly classification: LiveDixieRecallClassification;
  readonly stable_reason_code: string;
}

export interface LiveDixieRecallInternalDiagnostic {
  readonly http_status?: number;
  readonly observed_outcome?: string;
  readonly observed_error_class?: string;
  readonly idempotency_key_present: boolean;
  readonly fingerprint?: string;
  readonly missing_env?: string;
  readonly network_error_kind?:
    | "timeout"
    | "abort"
    | "fetch_threw"
    | "non_response";
}

export interface LiveDixieRecallResult {
  readonly classification: LiveDixieRecallClassification;
  readonly public_summary: LiveDixieRecallPublicSummary;
  readonly internal_diagnostic: LiveDixieRecallInternalDiagnostic;
}

// -- response classification ----------------------------------------------

const KNOWN_INGRESS_ERRORS = new Set<string>([
  "ingress.invalid_request",
  "ingress.payload_too_large",
  "ingress.missing_idempotency_key",
]);

const KNOWN_TENANT_OR_SESSION_ERRORS = new Set<string>([
  "ingress.cross_tenant_body_mismatch",
  "seam.cross_tenant_recall_refused",
  "seam.tenant_resolution_failed",
]);

const KNOWN_USER_FORBIDDEN_ERRORS = new Set<string>([
  "seam.privacy_scope_refusal",
  "seam.signer_not_competent",
  "seam.blocked_by_policy",
]);

const KNOWN_INVALID_REQUEST_SEAM_ERRORS = new Set<string>([
  "seam.frame_unsupported",
  "seam.class_validation_failed",
]);

const KNOWN_UPSTREAM_UNAVAILABLE_ERRORS = new Set<string>([
  "seam.storage_unavailable",
  "seam.capability_unrecognized",
  "seam.proof_invalid",
  "seam.capability_missing_env_key",
]);

// Phase 37B classification guidance places per-tenant cap / byte-budget
// refusals under rate-limited / cap-limited behavior (gate §I, line 424).
// The current classification vocabulary has `rate_limited` but no
// `cap_limited`, so guard cap refusals collapse into `rate_limited` —
// the least speculative mapping that preserves Dixie's "deliberately
// bypasses cache" semantic. Dixie's source (`refusal-mapping.ts`,
// `guardRefusal`) emits these classes with `http_status: 503`, but the
// classifier keys on the documented refusal class first regardless of
// the status carrier so future Dixie status-code adjustments do not
// silently downgrade to `upstream_unavailable`.
const KNOWN_GUARD_CAP_ERRORS = new Set<string>([
  "guard.tenant_assertion_cap",
  "guard.tenant_byte_budget",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ClassifierInput {
  readonly status: number;
  readonly body: unknown;
}

function classifyDixieResponse(
  res: ClassifierInput,
): { classification: LiveDixieRecallClassification; reason_code: string } {
  const { status } = res;
  const body = res.body;

  if (!isPlainObject(body)) {
    return {
      classification: "unsupported_response_shape",
      reason_code: "non_object_response_body",
    };
  }

  const outcome = body.outcome;
  const errorCls =
    typeof body.error === "string" ? (body.error as string) : undefined;

  // Guard cap refusals (per-tenant assertion cap / byte-budget) are
  // classified as `rate_limited` regardless of the carrier HTTP status,
  // because Dixie's documented behavior treats them as cap-limited. The
  // class match takes priority over status-based mappings.
  if (errorCls && KNOWN_GUARD_CAP_ERRORS.has(errorCls)) {
    return { classification: "rate_limited", reason_code: errorCls };
  }

  if (status === 200) {
    if (outcome === "served") {
      return { classification: "served", reason_code: "served" };
    }
    return {
      classification: "unsupported_response_shape",
      reason_code: "200_without_served_outcome",
    };
  }

  if (status === 401) {
    return {
      classification: "service_unauthorized",
      reason_code: "service_unauthorized",
    };
  }

  if (status === 403) {
    if (errorCls && KNOWN_TENANT_OR_SESSION_ERRORS.has(errorCls)) {
      return {
        classification: "tenant_or_session_mismatch",
        reason_code: errorCls,
      };
    }
    if (errorCls && KNOWN_USER_FORBIDDEN_ERRORS.has(errorCls)) {
      return {
        classification: "denied_or_forbidden",
        reason_code: errorCls,
      };
    }
    // Empty / incomplete / unknown body shape on a 403 is not safely
    // classifiable as denied_or_forbidden — Dixie's documented refusal
    // envelopes always carry a known refusal class. Fail closed.
    return {
      classification: "unsupported_response_shape",
      reason_code: "unknown_403_body_shape",
    };
  }

  if (status === 400 || status === 413) {
    if (errorCls && KNOWN_INGRESS_ERRORS.has(errorCls)) {
      return {
        classification: "ingress_invalid_request",
        reason_code: errorCls,
      };
    }
    if (errorCls && KNOWN_INVALID_REQUEST_SEAM_ERRORS.has(errorCls)) {
      return {
        classification: "ingress_invalid_request",
        reason_code: errorCls,
      };
    }
    // Empty / incomplete / unknown body shape on a 400/413 is not safely
    // classifiable as ingress_invalid_request without a documented refusal
    // class. Fail closed.
    return {
      classification: "unsupported_response_shape",
      reason_code: `unknown_${status}_body_shape`,
    };
  }

  if (status === 429) {
    return { classification: "rate_limited", reason_code: "rate_limited" };
  }

  if (status === 503) {
    if (outcome === "needs_review") {
      return { classification: "needs_review", reason_code: "needs_review" };
    }
    if (errorCls && KNOWN_UPSTREAM_UNAVAILABLE_ERRORS.has(errorCls)) {
      return { classification: "upstream_unavailable", reason_code: errorCls };
    }
    return {
      classification: "upstream_unavailable",
      reason_code: "upstream_unavailable_unspecified",
    };
  }

  if (status >= 500 && status <= 599) {
    return {
      classification: "upstream_unavailable",
      reason_code: `http_${status}`,
    };
  }

  return {
    classification: "unsupported_response_shape",
    reason_code: `unexpected_status_${status}`,
  };
}

// -- live call -------------------------------------------------------------

export type LiveDixieFetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  status: number;
  text(): Promise<string>;
  headers?: Headers;
}>;

export interface LiveRecallViaDixieOptions {
  readonly fetch?: LiveDixieFetchLike;
  readonly idempotencyDetector?: IdempotencyReuseDetector;
  readonly clock?: () => number;
}

function buildPublicSummary(
  classification: LiveDixieRecallClassification,
  reasonCode: string,
): LiveDixieRecallPublicSummary {
  const outcomeMap: Record<
    LiveDixieRecallClassification,
    LiveDixieRecallPublicSummary["outcome"]
  > = {
    served: "served",
    denied_or_forbidden: "denied",
    needs_review: "needs_review",
    ingress_invalid_request: "ingress_refused",
    service_unauthorized: "service_unauthorized",
    tenant_or_session_mismatch: "denied",
    rate_limited: "rate_limited",
    upstream_unavailable: "upstream_unavailable",
    unsupported_response_shape: "unsupported_response_shape",
    network_error: "network_error",
    missing_required_env: "config_error",
    invalid_config: "config_error",
    unsafe_idempotency_key_reuse: "unsafe_idempotency_key_reuse",
  };
  return {
    outcome: outcomeMap[classification],
    classification,
    stable_reason_code: reasonCode,
  };
}

export async function liveRecallViaDixie(
  input: LiveRecallInput,
  config: LiveDixieClientConfig,
  options: LiveRecallViaDixieOptions = {},
): Promise<LiveDixieRecallResult> {
  let plan: LiveDixieRequestPlan;
  try {
    plan = buildLiveDixieRecallRequestPlan(input, config);
  } catch (err) {
    if (err instanceof LiveDixieClientConfigError) {
      const cls = err.code;
      const reason =
        cls === "missing_required_env"
          ? `missing:${err.missingEnv ?? "unknown"}`
          : "invalid_config";
      const diag: LiveDixieRecallInternalDiagnostic = {
        idempotency_key_present: false,
        ...(cls === "missing_required_env" && err.missingEnv !== undefined
          ? { missing_env: err.missingEnv }
          : {}),
      };
      return {
        classification: cls,
        public_summary: buildPublicSummary(cls, reason),
        internal_diagnostic: diag,
      };
    }
    throw err;
  }

  const detector = options.idempotencyDetector ?? DEFAULT_REUSE_DETECTOR;
  const verdict = detector.observe(
    config.tenantId,
    config.callerActorId,
    plan.idempotencyKey,
    plan.fingerprint,
  );
  if (verdict === "unsafe_reuse") {
    return {
      classification: "unsafe_idempotency_key_reuse",
      public_summary: buildPublicSummary(
        "unsafe_idempotency_key_reuse",
        "idempotency_key_content_mismatch",
      ),
      internal_diagnostic: {
        idempotency_key_present: true,
        fingerprint: plan.fingerprint,
      },
    };
  }

  const fetcher: LiveDixieFetchLike =
    options.fetch ??
    (async (url, init) => {
      const g = globalThis as unknown as {
        fetch?: (url: string, init: unknown) => Promise<Response>;
      };
      if (typeof g.fetch !== "function") {
        throw new Error("globalThis.fetch is not available");
      }
      const r = await g.fetch(url, init);
      return {
        status: r.status,
        text: () => r.text(),
        headers: r.headers,
      };
    });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    config.timeoutMs,
  );

  let status: number;
  let bodyText: string;
  try {
    const res = await fetcher(plan.url, {
      method: plan.method,
      headers: { ...plan.headers },
      body: JSON.stringify(plan.body),
      signal: controller.signal,
    });
    status = res.status;
    bodyText = await res.text();
  } catch (err) {
    clearTimeout(timeoutHandle);
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    const kind: LiveDixieRecallInternalDiagnostic["network_error_kind"] = aborted
      ? "timeout"
      : err instanceof Error
        ? "fetch_threw"
        : "non_response";
    return {
      classification: "network_error",
      public_summary: buildPublicSummary(
        "network_error",
        aborted ? "timeout" : "fetch_threw",
      ),
      internal_diagnostic: {
        idempotency_key_present: true,
        fingerprint: plan.fingerprint,
        ...(kind !== undefined ? { network_error_kind: kind } : {}),
      },
    };
  }
  clearTimeout(timeoutHandle);

  let parsed: unknown = null;
  if (bodyText.length > 0) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }

  if (!isPlainObject(parsed)) {
    return {
      classification: "unsupported_response_shape",
      public_summary: buildPublicSummary(
        "unsupported_response_shape",
        "non_json_body",
      ),
      internal_diagnostic: {
        http_status: status,
        idempotency_key_present: true,
        fingerprint: plan.fingerprint,
      },
    };
  }

  const classified = classifyDixieResponse({ status, body: parsed });

  const observedOutcome =
    typeof parsed.outcome === "string" ? (parsed.outcome as string) : undefined;
  const observedErrorClass =
    typeof parsed.error === "string" ? (parsed.error as string) : undefined;

  return {
    classification: classified.classification,
    public_summary: buildPublicSummary(
      classified.classification,
      classified.reason_code,
    ),
    internal_diagnostic: {
      http_status: status,
      ...(observedOutcome !== undefined
        ? { observed_outcome: observedOutcome }
        : {}),
      ...(observedErrorClass !== undefined
        ? { observed_error_class: observedErrorClass }
        : {}),
      idempotency_key_present: true,
      fingerprint: plan.fingerprint,
    },
  };
}

// -- public-output banned substring guard ---------------------------------

export const LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
  "raw_dixie_debug",
  "raw_session_trace",
  "debug",
  "operator_private",
  "private_assertion",
  "private assertion",
  "private_assertion_id",
  "assertion_id",
  "source_material",
  "hidden estate",
  "full assertion bodies",
  "private identifiers",
  "session_id",
  "message_id",
  "tenant_id",
  "community_id",
  "session_thread_id",
  "continuity_actor_id",
  "actor:",
  "freeside-characters:shared-substrate",
] as const;

// Helper for test / runner consumers — scans an arbitrary
// operator-public-bound payload for banned substrings.
export function findBannedPublicSubstring(value: unknown): string | null {
  if (typeof value === "string") {
    for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
      if (value.includes(banned)) return banned;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findBannedPublicSubstring(v);
      if (hit) return hit;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
        if (k.includes(banned)) return banned;
      }
      const hit = findBannedPublicSubstring(v);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}
