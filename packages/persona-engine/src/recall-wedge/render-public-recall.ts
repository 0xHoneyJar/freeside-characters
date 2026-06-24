// Phase 33C · public-safe Recall Wedge renderer.
//
// Pure deterministic projection of a public-safe Recall Wedge DTO into
// voiceless / public-safe billboard text. Consumes the projected-DTO shape
// shipped in Phase 33B (docs/recall-wedge/fixtures/projected-dto/*.dto.json).
//
// Boundary (per docs/RECALL-WEDGE-MEMORY-MVP.md §9, §11, §12):
//   - accepts only recall_interface=public_discord +
//     render_surface=discord_public_character;
//   - rejects operator_private / operator_debug and any unknown frame;
//   - emits no character voice, calls no LLM, infers no field that is not
//     directly present in the DTO;
//   - fails closed on contaminated input: operator-private / debug fields
//     anywhere in a public-framed DTO cause the renderer to reject the
//     projection rather than silently strip them, so private material can
//     never smuggle through "ignored" fields;
//   - rendered public output is restricted to the §9 allowlist —
//     summary, counts, public reason labels/counts, refusal text, safe
//     referral target/message — and emits no continuity actor identifier.
//
// This renderer is fixture/test-only for Phase 33C. It is not wired to any
// live Discord command path.

const PUBLIC_RECALL_INTERFACE = "public_discord" as const;
const PUBLIC_RENDER_SURFACE = "discord_public_character" as const;

const ALLOWED_OUTCOMES = ["ok", "referral"] as const;
type AllowedOutcome = (typeof ALLOWED_OUTCOMES)[number];

// Strings that must never appear anywhere in a public-framed input DTO — keys
// or string values, at any depth. Fail-closed: a contaminated public-framed DTO
// is rejected before any allowlist projection happens, so private material
// cannot smuggle through "ignored" fields.
const BANNED_INPUT_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
  "raw_reasons_for_operator_review",
  "debug",
  "operator_private",
  "operator_private_diagnostics",
  "operator_private_note",
  "private_assertion",
  "private assertion",
  "private_assertion_id",
  "assertion_id",
  "source_material",
  "hidden estate",
  "full assertion bodies",
  "private identifiers",
] as const;

// Strings that must never appear in rendered public output. Defense-in-depth:
// the renderer only reads a small allowlist of safe fields, so these would not
// normally be reachable, but a final scan guarantees no leak even under future
// drift in the DTO shape.
const BANNED_OUTPUT_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
  "debug",
  "private_assertion",
  "private assertion",
  "assertion_id",
  "source_material",
  "hidden estate",
  "full assertion bodies",
  "private identifiers",
] as const;

export class PublicRecallRenderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PublicRecallRenderError";
    this.code = code;
  }
}

interface PublicRecallProjection {
  recall_interface: typeof PUBLIC_RECALL_INTERFACE;
  render_surface: typeof PUBLIC_RENDER_SURFACE;
  outcome: AllowedOutcome;
  character_frame?: string;
  continuity_actor_id?: string;
  public_summary?: string;
  included_count?: number;
  marked_count?: number;
  redacted_count?: number;
  excluded_count?: number;
  public_reason_labels?: readonly string[];
  public_reason_counts?: Readonly<Record<string, number>>;
  denied_or_refused?: boolean;
  safe_referral_target?: string;
  public_referral_message?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function asAllowedOutcome(value: unknown): AllowedOutcome | null {
  return typeof value === "string" && (ALLOWED_OUTCOMES as readonly string[]).includes(value)
    ? (value as AllowedOutcome)
    : null;
}

// Walk every key and every string value in the DTO and report the first
// banned substring encountered, or null if clean. Cycle-safe via a visited set.
// Numbers/booleans/nulls cannot leak text and are skipped.
function findBannedInputMaterial(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): string | null {
  if (typeof value === "string") {
    for (const banned of BANNED_INPUT_SUBSTRINGS) {
      if (value.includes(banned)) return banned;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const item of value) {
      const hit = findBannedInputMaterial(item, visited);
      if (hit) return hit;
    }
    return null;
  }
  if (isPlainObject(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const [key, sub] of Object.entries(value)) {
      for (const banned of BANNED_INPUT_SUBSTRINGS) {
        if (key.includes(banned)) return banned;
      }
      const hit = findBannedInputMaterial(sub, visited);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

export function isPublicRecallProjectionRenderable(dto: unknown): boolean {
  if (!isPlainObject(dto)) return false;
  if (dto.recall_interface !== PUBLIC_RECALL_INTERFACE) return false;
  if (dto.render_surface !== PUBLIC_RENDER_SURFACE) return false;
  if (asAllowedOutcome(dto.outcome) === null) return false;
  if (findBannedInputMaterial(dto) !== null) return false;
  return true;
}

function validateForPublicRender(dto: unknown): PublicRecallProjection {
  if (!isPlainObject(dto)) {
    throw new PublicRecallRenderError(
      "not_object",
      "recall projection must be a plain object",
    );
  }

  const ri = dto.recall_interface;
  if (ri !== PUBLIC_RECALL_INTERFACE) {
    throw new PublicRecallRenderError(
      "wrong_recall_interface",
      `recall_interface must be ${PUBLIC_RECALL_INTERFACE} for public render; refusing to render`,
    );
  }

  const rs = dto.render_surface;
  if (rs !== PUBLIC_RENDER_SURFACE) {
    throw new PublicRecallRenderError(
      "wrong_render_surface",
      `render_surface must be ${PUBLIC_RENDER_SURFACE} for public render; refusing to render`,
    );
  }

  // Fail-closed input deep-scan. A public-framed DTO that contains operator
  // private material — anywhere, including nested keys and values that the
  // safe-output allowlist would otherwise ignore — is rejected before any
  // projection happens. Defense-in-depth alongside the rendered-output scan.
  const bannedHit = findBannedInputMaterial(dto);
  if (bannedHit !== null) {
    throw new PublicRecallRenderError(
      "banned_private_material_in_input",
      `public-framed recall projection contained banned private material in input ("${bannedHit}"); refusing to render`,
    );
  }

  const outcome = asAllowedOutcome(dto.outcome);
  if (outcome === null) {
    throw new PublicRecallRenderError(
      "unknown_outcome",
      `outcome must be one of ${ALLOWED_OUTCOMES.join("|")}`,
    );
  }

  if (outcome === "referral") {
    if (!isNonEmptyString(dto.safe_referral_target)) {
      throw new PublicRecallRenderError(
        "missing_referral_target",
        "referral outcome requires a safe_referral_target",
      );
    }
    if (!isNonEmptyString(dto.public_referral_message)) {
      throw new PublicRecallRenderError(
        "missing_referral_message",
        "referral outcome requires a public_referral_message",
      );
    }
  }

  return {
    recall_interface: PUBLIC_RECALL_INTERFACE,
    render_surface: PUBLIC_RENDER_SURFACE,
    outcome,
    character_frame: isNonEmptyString(dto.character_frame) ? dto.character_frame : undefined,
    continuity_actor_id: isNonEmptyString(dto.continuity_actor_id)
      ? dto.continuity_actor_id
      : undefined,
    public_summary: isNonEmptyString(dto.public_summary) ? dto.public_summary : undefined,
    included_count: isFiniteNonNegativeInt(dto.included_count) ? dto.included_count : undefined,
    marked_count: isFiniteNonNegativeInt(dto.marked_count) ? dto.marked_count : undefined,
    redacted_count: isFiniteNonNegativeInt(dto.redacted_count) ? dto.redacted_count : undefined,
    excluded_count: isFiniteNonNegativeInt(dto.excluded_count) ? dto.excluded_count : undefined,
    public_reason_labels: isStringArray(dto.public_reason_labels)
      ? dto.public_reason_labels
      : undefined,
    public_reason_counts: isPlainObject(dto.public_reason_counts)
      ? Object.fromEntries(
          Object.entries(dto.public_reason_counts).filter(
            (entry): entry is [string, number] => isFiniteNonNegativeInt(entry[1]),
          ),
        )
      : undefined,
    denied_or_refused: typeof dto.denied_or_refused === "boolean" ? dto.denied_or_refused : false,
    safe_referral_target: isNonEmptyString(dto.safe_referral_target)
      ? dto.safe_referral_target
      : undefined,
    public_referral_message: isNonEmptyString(dto.public_referral_message)
      ? dto.public_referral_message
      : undefined,
  };
}

function header(p: PublicRecallProjection): string {
  const tag = p.outcome === "referral"
    ? "referral"
    : p.denied_or_refused
      ? "refused"
      : "ok";
  const frame = p.character_frame ?? "unknown";
  return `[recall · public · ${frame} · ${tag}]`;
}

function countsLine(p: PublicRecallProjection): string | null {
  const parts: string[] = [];
  if (p.included_count !== undefined) parts.push(`included=${p.included_count}`);
  if (p.marked_count !== undefined) parts.push(`marked=${p.marked_count}`);
  if (p.redacted_count !== undefined) parts.push(`redacted=${p.redacted_count}`);
  if (p.excluded_count !== undefined) parts.push(`excluded=${p.excluded_count}`);
  return parts.length === 0 ? null : `counts: ${parts.join(" · ")}`;
}

function labelsLine(p: PublicRecallProjection): string | null {
  if (!p.public_reason_labels || p.public_reason_labels.length === 0) return null;
  return `labels: ${p.public_reason_labels.join(", ")}`;
}

function reasonCountsLine(p: PublicRecallProjection): string | null {
  if (!p.public_reason_counts) return null;
  const entries = Object.entries(p.public_reason_counts);
  if (entries.length === 0) return null;
  const parts = entries.map(([k, v]) => `${k}=${v}`);
  return `reason counts: ${parts.join(" · ")}`;
}

function buildLines(p: PublicRecallProjection): string[] {
  const lines: string[] = [header(p)];

  // continuity_actor_id is intentionally NOT emitted on the public surface —
  // §9 allowlist restricts public output to summary / counts / labels /
  // refusal / referral. The id is retained on the projection only for
  // upstream DTO validation and is never rendered.
  if (p.public_summary) lines.push(`summary: ${p.public_summary}`);

  if (p.outcome === "referral") {
    lines.push(`referral target: ${p.safe_referral_target}`);
    lines.push(`referral message: ${p.public_referral_message}`);
  } else if (p.denied_or_refused) {
    lines.push("status: this frame cannot answer publicly");
  }

  const c = countsLine(p);
  if (c) lines.push(c);
  const rc = reasonCountsLine(p);
  if (rc) lines.push(rc);
  const lab = labelsLine(p);
  if (lab) lines.push(lab);

  return lines;
}

function assertNoLeak(text: string): void {
  for (const banned of BANNED_OUTPUT_SUBSTRINGS) {
    if (text.includes(banned)) {
      throw new PublicRecallRenderError(
        "banned_substring_in_output",
        `rendered public output contained a banned substring; refusing to emit`,
      );
    }
  }
}

export function renderPublicRecallProjectionLines(dto: unknown): string[] {
  const projection = validateForPublicRender(dto);
  const lines = buildLines(projection);
  for (const line of lines) assertNoLeak(line);
  return lines;
}

export function renderPublicRecallProjection(dto: unknown): string {
  return renderPublicRecallProjectionLines(dto).join("\n");
}
