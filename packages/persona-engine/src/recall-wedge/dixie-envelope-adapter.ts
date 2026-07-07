// Phase 35D · pure adapter from a recorded Dixie-safe recall envelope to the
// local Recall Wedge projected DTO consumed by the Phase 33C public-safe
// renderer.
//
// Boundary (per docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md §9, §9a, and the
// Phase 35D brief):
//   - the adapter is the ONLY narrowing boundary from a Dixie-shaped envelope
//     to a local projected DTO; renderers, runners, and surface frames never
//     read Dixie envelopes directly;
//   - only known recorded envelope versions are accepted; unknown / missing /
//     malformed versions fail closed with a stable error code;
//   - raw / private / debug Dixie material (raw_dixie_debug, raw_reasons,
//     raw_session_trace, source_material, PRIVATE_SENTINEL_*, operator
//     diagnostics, hidden estate, full assertion bodies) is NEVER passed
//     through to the projected DTO;
//   - operational/session identifiers (session_id, message_id,
//     continuity_actor_id) are NEVER emitted on the projected DTO; the §9
//     allowlist excludes them from the public surface and the adapter is
//     responsible for stripping them before any rendering occurs;
//   - authorized_private_session is gated on the §5a authorized-private DTO
//     gate and is not authorized by this phase; the adapter fails closed on
//     that target with a stable error code rather than inventing a private
//     renderer;
//   - the adapter does NOT call the network, Discord, Telegram, Dixie, Finn,
//     Straylight, storage, or any LLM. It is a pure synchronous function over
//     in-memory envelope data.
//
// This adapter is fixture-only for Phase 35D. It is not wired to any live
// Discord command path, any live Telegram path, any live Dixie client, or any
// memory admission path.

const SUPPORTED_DIXIE_ENVELOPE_VERSIONS = [
  "recall_wedge.dixie_envelope.v0",
] as const;

const SUPPORTED_PUBLIC_RECALL_INTERFACE = "public_discord" as const;
const SUPPORTED_PUBLIC_RENDER_SURFACE = "discord_public_character" as const;

const ALLOWED_PUBLIC_OUTCOMES = ["ok", "referral"] as const;
type AllowedPublicOutcome = (typeof ALLOWED_PUBLIC_OUTCOMES)[number];

// Adapter-level fail-closed scan. The adapter is the narrowing boundary —
// even though it only reads named allowlist fields out of public_recall_payload
// and target_projection, an allowed field's STRING VALUE could still carry
// banned material (e.g. a malicious public_summary that embeds
// PRIVATE_SENTINEL, or a public_reason_label that smuggles raw_reasons). The
// adapter must reject before returning, not delegate that responsibility to
// the renderer's defense-in-depth scan.
const ADAPTER_BANNED_PROJECTION_SUBSTRINGS = [
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
  "continuity_actor_id",
  "actor:",
  "freeside-characters:shared-substrate",
] as const;

export type DixieEnvelopeAdapterTarget =
  | "public_discord"
  | "public_telegram"
  | "authorized_private_session";

export interface DixieEnvelopeAdapterOptions {
  readonly target?: DixieEnvelopeAdapterTarget;
}

export class DixieEnvelopeAdapterError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DixieEnvelopeAdapterError";
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Walk every key and every string value in a reconstructed projection and
// report the first banned substring encountered, or null if clean. Cycle-safe
// via a visited set. Numbers / booleans / nulls cannot leak text.
function findBannedProjectionMaterial(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): string | null {
  if (typeof value === "string") {
    for (const banned of ADAPTER_BANNED_PROJECTION_SUBSTRINGS) {
      if (value.includes(banned)) return banned;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const item of value) {
      const hit = findBannedProjectionMaterial(item, visited);
      if (hit) return hit;
    }
    return null;
  }
  if (isPlainObject(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const [key, sub] of Object.entries(value)) {
      for (const banned of ADAPTER_BANNED_PROJECTION_SUBSTRINGS) {
        if (key.includes(banned)) return banned;
      }
      const hit = findBannedProjectionMaterial(sub, visited);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

function assertProjectionIsClean(projection: unknown): void {
  const hit = findBannedProjectionMaterial(projection);
  if (hit !== null) {
    throw new DixieEnvelopeAdapterError(
      "banned_private_material_in_projection",
      `reconstructed projected DTO contained banned private material ("${hit}"); refusing to return adapter output`,
    );
  }
}

// Pre-normalization scan of every RAW allowlisted source field the adapter is
// about to read out of the envelope. This must run BEFORE any filtering /
// type-coercion (e.g. public_reason_counts entries being filtered to finite
// non-negative numbers, public_summary being dropped if not a non-empty
// string), otherwise contaminated string values inside otherwise-allowed
// fields could be silently erased instead of triggering a fail-closed throw.
//
// The scan is deliberately scoped to the allowlisted source fields only —
// raw_dixie_debug, raw_session_trace, source_material, session_id,
// message_id, and continuity_actor_id intentionally exist elsewhere in the
// envelope and must be stripped by selective field-reading, not make every
// fixture fail.
function assertAllowedSourceFieldsAreClean(
  targetProjection: Record<string, unknown>,
  payload: Record<string, unknown>,
): void {
  const allowedSourceView = {
    character_frame: targetProjection.character_frame,
    outcome: payload.outcome,
    public_summary: payload.public_summary,
    included_count: payload.included_count,
    marked_count: payload.marked_count,
    redacted_count: payload.redacted_count,
    excluded_count: payload.excluded_count,
    public_reason_labels: payload.public_reason_labels,
    public_reason_counts: payload.public_reason_counts,
    denied_or_refused: payload.denied_or_refused,
    safe_referral_target: payload.safe_referral_target,
    public_referral_message: payload.public_referral_message,
  };
  const hit = findBannedProjectionMaterial(allowedSourceView);
  if (hit !== null) {
    throw new DixieEnvelopeAdapterError(
      "banned_private_material_in_projection",
      `dixie envelope's allowlisted source fields contained banned private material ("${hit}") before normalization; refusing to project`,
    );
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function asAllowedPublicOutcome(value: unknown): AllowedPublicOutcome | null {
  return typeof value === "string" &&
    (ALLOWED_PUBLIC_OUTCOMES as readonly string[]).includes(value)
    ? (value as AllowedPublicOutcome)
    : null;
}

export function isSupportedDixieEnvelopeVersion(envelope: unknown): boolean {
  if (!isPlainObject(envelope)) return false;
  const v = envelope.envelope_version;
  return (
    typeof v === "string" &&
    (SUPPORTED_DIXIE_ENVELOPE_VERSIONS as readonly string[]).includes(v)
  );
}

interface AdaptedPublicRecallProjection {
  readonly recall_interface: typeof SUPPORTED_PUBLIC_RECALL_INTERFACE;
  readonly render_surface: typeof SUPPORTED_PUBLIC_RENDER_SURFACE;
  readonly outcome: AllowedPublicOutcome;
  readonly character_frame?: string;
  readonly public_summary?: string;
  readonly included_count?: number;
  readonly marked_count?: number;
  readonly redacted_count?: number;
  readonly excluded_count?: number;
  readonly public_reason_labels?: readonly string[];
  readonly public_reason_counts?: Readonly<Record<string, number>>;
  readonly denied_or_refused?: boolean;
  readonly safe_referral_target?: string;
  readonly public_referral_message?: string;
}

function requireEnvelope(envelope: unknown): Record<string, unknown> {
  if (!isPlainObject(envelope)) {
    throw new DixieEnvelopeAdapterError(
      "not_object",
      "dixie envelope must be a plain object",
    );
  }
  return envelope;
}

function requireSupportedVersion(envelope: Record<string, unknown>): void {
  const v = envelope.envelope_version;
  if (typeof v !== "string" || v.length === 0) {
    throw new DixieEnvelopeAdapterError(
      "missing_dixie_envelope_version",
      "dixie envelope must declare an envelope_version",
    );
  }
  if (!(SUPPORTED_DIXIE_ENVELOPE_VERSIONS as readonly string[]).includes(v)) {
    throw new DixieEnvelopeAdapterError(
      "unsupported_dixie_envelope_version",
      `dixie envelope_version "${v}" is not supported by this adapter; refusing to project`,
    );
  }
}

function requireRecordedRecallKind(envelope: Record<string, unknown>): void {
  if (envelope.input_envelope_kind !== "recorded_dixie_recall_envelope") {
    throw new DixieEnvelopeAdapterError(
      "wrong_input_envelope_kind",
      "adapter expects input_envelope_kind=recorded_dixie_recall_envelope",
    );
  }
}

function pickTarget(
  envelope: Record<string, unknown>,
  options: DixieEnvelopeAdapterOptions | undefined,
): DixieEnvelopeAdapterTarget {
  if (options?.target) return options.target;
  const tp = envelope.target_projection;
  if (isPlainObject(tp)) {
    const ri = tp.recall_interface;
    if (ri === "public_discord") return "public_discord";
    if (ri === "public_telegram") return "public_telegram";
    if (ri === "authorized_private_session") {
      return "authorized_private_session";
    }
  }
  throw new DixieEnvelopeAdapterError(
    "unknown_target_projection",
    "dixie envelope target_projection.recall_interface is missing or unknown; refusing to project",
  );
}

function projectPublicDiscord(
  envelope: Record<string, unknown>,
): AdaptedPublicRecallProjection {
  const tp = envelope.target_projection;
  if (!isPlainObject(tp)) {
    throw new DixieEnvelopeAdapterError(
      "missing_target_projection",
      "dixie envelope is missing target_projection",
    );
  }
  if (tp.recall_interface !== SUPPORTED_PUBLIC_RECALL_INTERFACE) {
    throw new DixieEnvelopeAdapterError(
      "wrong_recall_interface_for_target",
      `public_discord adapter expected target_projection.recall_interface=${SUPPORTED_PUBLIC_RECALL_INTERFACE}, got "${String(tp.recall_interface)}"`,
    );
  }
  if (tp.render_surface !== SUPPORTED_PUBLIC_RENDER_SURFACE) {
    throw new DixieEnvelopeAdapterError(
      "wrong_render_surface_for_target",
      `public_discord adapter expected target_projection.render_surface=${SUPPORTED_PUBLIC_RENDER_SURFACE}, got "${String(tp.render_surface)}"`,
    );
  }

  const payload = envelope.public_recall_payload;
  if (!isPlainObject(payload)) {
    throw new DixieEnvelopeAdapterError(
      "missing_public_recall_payload",
      "dixie envelope is missing public_recall_payload",
    );
  }

  const outcome = asAllowedPublicOutcome(payload.outcome);
  if (outcome === null) {
    throw new DixieEnvelopeAdapterError(
      "unknown_outcome",
      `public_recall_payload.outcome must be one of ${ALLOWED_PUBLIC_OUTCOMES.join("|")}`,
    );
  }

  if (outcome === "referral") {
    if (!isNonEmptyString(payload.safe_referral_target)) {
      throw new DixieEnvelopeAdapterError(
        "missing_referral_target",
        "referral outcome requires public_recall_payload.safe_referral_target",
      );
    }
    if (!isNonEmptyString(payload.public_referral_message)) {
      throw new DixieEnvelopeAdapterError(
        "missing_referral_message",
        "referral outcome requires public_recall_payload.public_referral_message",
      );
    }
  }

  // Fail closed BEFORE filtering / type coercion. If we filtered first, a
  // contaminated string value in public_reason_counts (e.g.
  // { redacted_for_public_surface: "source_material" }) would be silently
  // dropped by the finite-non-negative-int filter, masking the contamination
  // instead of surfacing it. Running the scan here forces the throw.
  assertAllowedSourceFieldsAreClean(tp, payload);

  // Reconstructed allowlist projection. Every renderer-bound field is
  // explicitly read from the envelope's public_recall_payload and the
  // target_projection.character_frame; nothing else from the envelope is
  // forwarded. raw_dixie_debug, raw_session_trace, source_material,
  // operator diagnostics, session_id, message_id, and continuity_actor_id
  // are intentionally not read here so they cannot leak into the DTO even
  // by accident.
  const projection: AdaptedPublicRecallProjection = {
    recall_interface: SUPPORTED_PUBLIC_RECALL_INTERFACE,
    render_surface: SUPPORTED_PUBLIC_RENDER_SURFACE,
    outcome,
    character_frame: isNonEmptyString(tp.character_frame)
      ? tp.character_frame
      : undefined,
    public_summary: isNonEmptyString(payload.public_summary)
      ? payload.public_summary
      : undefined,
    included_count: isFiniteNonNegativeInt(payload.included_count)
      ? payload.included_count
      : undefined,
    marked_count: isFiniteNonNegativeInt(payload.marked_count)
      ? payload.marked_count
      : undefined,
    redacted_count: isFiniteNonNegativeInt(payload.redacted_count)
      ? payload.redacted_count
      : undefined,
    excluded_count: isFiniteNonNegativeInt(payload.excluded_count)
      ? payload.excluded_count
      : undefined,
    public_reason_labels: isStringArray(payload.public_reason_labels)
      ? [...payload.public_reason_labels]
      : undefined,
    public_reason_counts: isPlainObject(payload.public_reason_counts)
      ? Object.fromEntries(
          Object.entries(payload.public_reason_counts).filter(
            (entry): entry is [string, number] =>
              isFiniteNonNegativeInt(entry[1]),
          ),
        )
      : undefined,
    denied_or_refused:
      typeof payload.denied_or_refused === "boolean"
        ? payload.denied_or_refused
        : false,
    safe_referral_target: isNonEmptyString(payload.safe_referral_target)
      ? payload.safe_referral_target
      : undefined,
    public_referral_message: isNonEmptyString(payload.public_referral_message)
      ? payload.public_referral_message
      : undefined,
  };

  return projection;
}

export function adaptDixieEnvelopeToPublicRecallProjection(
  envelope: unknown,
): unknown {
  const obj = requireEnvelope(envelope);
  requireSupportedVersion(obj);
  requireRecordedRecallKind(obj);
  const projection = projectPublicDiscord(obj);
  assertProjectionIsClean(projection);
  return projection;
}

export function adaptDixieEnvelopeToRecallProjection(
  envelope: unknown,
  options?: DixieEnvelopeAdapterOptions,
): unknown {
  const obj = requireEnvelope(envelope);
  requireSupportedVersion(obj);
  requireRecordedRecallKind(obj);

  const target = pickTarget(obj, options);

  if (target === "authorized_private_session") {
    throw new DixieEnvelopeAdapterError(
      "authorized_private_projection_not_implemented",
      "authorized_private_session target is gated on the §5a authorized-private DTO gate; no private renderer is authorized in Phase 35D",
    );
  }

  if (target === "public_telegram") {
    throw new DixieEnvelopeAdapterError(
      "public_telegram_projection_not_implemented",
      "public_telegram target has no shipped renderer in Phase 35D; refusing to project to a renderer that does not exist",
    );
  }

  const projection = projectPublicDiscord(obj);
  assertProjectionIsClean(projection);
  return projection;
}
