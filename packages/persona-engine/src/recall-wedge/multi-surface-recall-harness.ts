// Phase 38A · multi-surface Recall Wedge projection harness.
//
// Authority: docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md (Phase 37D
// gate). Phase 37D accepted Phase 37C as the operator/dev-only live Dixie
// seam and redirected the next MVP proof toward this fixture/injected-result
// multi-surface boundary harness.
//
// What this harness proves (Phase 37D §C):
//   - one shared continuity-actor binding / one shared recall-result id is
//     evaluated across multiple surface frames;
//   - each frame has its own deterministic projection or refusal contract;
//   - operator_dev may render operator-safe classification + an
//     operator-only diagnostic, with no raw / private / debug / source
//     material in any operator-public field;
//   - public_discord_simulated emits deterministic public-safe output (or a
//     stable refusal) and never carries operational IDs or banned material;
//   - public_telegram_simulated and authorized_private_session_simulated
//     fail closed with stable refusal codes — no positive renderer;
//   - private_chat_simulated is taxonomy-only / unimplemented;
//   - character_frame_public emits deterministic referral-style output only;
//     no LLM, no character voice, no persona-styled generated prose;
//   - identical output across all surfaces is itself a failure (the matrix
//     is non-degenerate);
//   - operational identifiers (session_id, message_id, tenant_id,
//     community_id, session_thread_id, continuity_actor_id, and camelCase
//     aliases) are NOT memory identity and never appear in any public-bound
//     output.
//
// What this harness does NOT do (Phase 37D §G.3, §I — non-goals):
//   - it does NOT call live Dixie. It does not import the Phase 37C live
//     Dixie client (./live-dixie-client.ts) or the Phase 37C runner
//     (./run-live-dixie-recall-demo.ts). It is a fixture/injected-result
//     harness;
//   - it does NOT touch real Discord, Telegram, private-chat, or any other
//     surface transport. No discord.js / telegraf / grammy / Telegram /
//     private-chat client is imported. No webhook send, no command
//     registration, no message dispatch;
//   - it does NOT touch storage / admission / memory promotion. No pg /
//     redis / object-store / vector-index import. No candidate-memory or
//     admitted-memory write happens here;
//   - it does NOT invoke any LLM. No @anthropic-ai/* / openai / Claude
//     Agent SDK import. No persona-styled prose. No character voice;
//   - it does NOT touch Finn / @loa/dixie / @loa/straylight. No
//     identity-binding, no consent capture, no signer authority;
//   - it does NOT re-use ./dixie-envelope-adapter.ts (recorded fixtures
//     only) or ./render-public-recall.ts (Discord-public renderer) — both
//     are deliberately not imported here so the harness is self-contained
//     and the boundary is reviewable in isolation;
//   - it does NOT treat recorded_dixie_recall_envelope as live traffic.
//     The string is referenced only in this comment, naming the gate that
//     forbids it;
//   - nothing rendered here claims production readiness. Phase 38A is a
//     boundary harness, not a public/private surface integration.
//
// If a future phase reaches for any disallowed item above, re-open the
// Phase 37D gate (docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md) before
// expanding scope.

// -- surface frame taxonomy -----------------------------------------------

export const MULTI_SURFACE_RECALL_FRAMES = [
  "operator_dev",
  "public_discord_simulated",
  "public_telegram_simulated",
  "authorized_private_session_simulated",
  "private_chat_simulated",
  "character_frame_public",
] as const;

export type MultiSurfaceRecallFrame =
  (typeof MULTI_SURFACE_RECALL_FRAMES)[number];

// Stable refusal codes. Each is named and exported so tests, runners, and
// future audits can pin against the names instead of free text.
export const MULTI_SURFACE_REFUSAL_CODES = {
  public_telegram_projection_not_implemented:
    "public_telegram_projection_not_implemented",
  authorized_private_projection_not_implemented:
    "authorized_private_projection_not_implemented",
  private_chat_projection_unimplemented:
    "private_chat_projection_unimplemented",
  service_unauthorized_projection_refused:
    "service_unauthorized_projection_refused",
  unsupported_response_shape_projection_refused:
    "unsupported_response_shape_projection_refused",
  needs_review_projection_refused_publicly:
    "needs_review_projection_refused_publicly",
  denied_or_forbidden_projection_refused_publicly:
    "denied_or_forbidden_projection_refused_publicly",
  character_frame_refused_publicly: "character_frame_refused_publicly",
} as const;

export type MultiSurfaceRefusalCode =
  (typeof MULTI_SURFACE_REFUSAL_CODES)[keyof typeof MULTI_SURFACE_REFUSAL_CODES];

// -- harness input shape --------------------------------------------------

// Classification vocabulary the harness understands. This is shaped after
// Phase 37C's LiveDixieRecallResult.classification for ergonomic reasons,
// but the live client itself is NOT imported here. The harness has its own
// local vocabulary on purpose so a future Dixie classification change does
// not silently re-shape the multi-surface boundary proof.
export const MULTI_SURFACE_RECALL_CLASSIFICATIONS = [
  "served",
  "denied_or_forbidden",
  "needs_review",
  "service_unauthorized",
  "unsupported_response_shape",
] as const;

export type MultiSurfaceRecallClassification =
  (typeof MULTI_SURFACE_RECALL_CLASSIFICATIONS)[number];

// Operational-ID record. Every key in this record is operational, NOT
// governed memory identity. The harness threads it into the input only so
// tests can prove the boundary: no public-bound frame ever leaks any of
// these values (or their camelCase aliases).
export interface MultiSurfaceOperationalIds {
  readonly session_id?: string;
  readonly message_id?: string;
  readonly tenant_id?: string;
  readonly community_id?: string;
  readonly session_thread_id?: string;
  readonly sessionId?: string;
  readonly messageId?: string;
  readonly tenantId?: string;
  readonly communityId?: string;
  readonly sessionThreadId?: string;
  readonly continuityActorId?: string;
}

export interface MultiSurfaceRecallInput {
  // Safe public binding marker. Opaque to the outside world; not the raw
  // continuity actor identity. The harness threads the binding through the
  // matrix metadata (so tests can pair (binding, recall_result_id, frame))
  // but never emits it on any public-bound frame.
  readonly continuity_actor_binding: string;

  // Raw / private continuity actor identifier. Operational, NOT public.
  // The harness must NEVER place this on any public-bound frame's output.
  readonly raw_continuity_actor_id?: string;

  // Operator-safe recall-result id. Stable across surfaces. Not public.
  readonly recall_result_id: string;

  readonly classification: MultiSurfaceRecallClassification;

  // Public-safe summary text. May be emitted on public-bound frames that
  // are authorized to render output. Must already be public-safe at the
  // input boundary; the harness still scans for banned substrings before
  // emitting.
  readonly safe_public_summary?: string;

  // Public-safe reason labels (e.g. ["redacted-by-policy"]). Same posture
  // as safe_public_summary.
  readonly safe_public_reason_labels?: readonly string[];

  // Public-safe reason counts (e.g. {redacted: 2}). Same posture.
  readonly safe_public_reason_counts?: Readonly<Record<string, number>>;

  // Optional operator/internal diagnostic label. Visible to operator_dev
  // only; never reaches public-bound frames.
  readonly operator_diagnostic_label?: string;

  // Intentionally contaminated raw/private/debug/source material. The
  // harness MUST NOT propagate any of this into any frame's output. Tests
  // assert these inputs exist (non-vacuous) and never appear in outputs.
  readonly contaminated_internal?: Readonly<Record<string, unknown>>;

  // Operational identifiers — operational only, NOT memory identity.
  // The harness MUST NOT propagate these into any public-bound frame.
  readonly operational_ids?: MultiSurfaceOperationalIds;
}

// -- harness output shape -------------------------------------------------

export type MultiSurfaceFrameOutcome = "rendered" | "refused" | "unimplemented";

export interface MultiSurfaceLeakScan {
  readonly clean: boolean;
  readonly first_hit: string | null;
}

export interface MultiSurfaceFrameResult {
  readonly frame: MultiSurfaceRecallFrame;
  readonly outcome: MultiSurfaceFrameOutcome;
  // Public-bound rendered text, where applicable. Operator_dev does NOT
  // populate this (operator output is partitioned into operator_only_*).
  readonly public_text?: string;
  // Short safe summary, where applicable. Public-safe.
  readonly safe_summary?: string;
  // Stable refusal code, where applicable. Pinned to
  // MULTI_SURFACE_REFUSAL_CODES.
  readonly refusal_code?: string;
  // Operator-only diagnostic. Populated only on operator_dev. Marked
  // INTERNAL/operator-only by construction.
  readonly operator_only_diagnostic?: string;
  // Result of scanning every emitted string field of this frame against
  // the harness's banned-substring posture. `clean: true` is the bound
  // tests rely on for public-bound frames; operator_dev's
  // operator_only_diagnostic is also scanned because operator-public
  // fields must not contain raw/private/debug/source material either.
  readonly leak_scan: MultiSurfaceLeakScan;
}

export interface MultiSurfaceRecallProjectionMatrix {
  readonly continuity_actor_binding: string;
  readonly recall_result_id: string;
  readonly classification: MultiSurfaceRecallClassification;
  readonly frames: Readonly<
    Record<MultiSurfaceRecallFrame, MultiSurfaceFrameResult>
  >;
}

// -- banned-substring posture --------------------------------------------

// Unified banned-substring posture used by the harness. Aligned with
// dixie-envelope-adapter's ADAPTER_BANNED_PROJECTION_SUBSTRINGS and
// live-dixie-client's LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS, plus
// camelCase operational aliases the multi-surface contract calls out
// (Phase 37D §H, §F.6).
export const MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS = [
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
  "sessionId",
  "messageId",
  "tenantId",
  "communityId",
  "sessionThreadId",
  "continuityActorId",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Walk every string value AND every key in `value` and return the first
// banned substring encountered, or null. Cycle-safe via a visited set.
// Numbers / booleans / nulls cannot leak text.
export function findMultiSurfaceBannedSubstring(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): string | null {
  if (typeof value === "string") {
    for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
      if (value.includes(banned)) return banned;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const item of value) {
      const hit = findMultiSurfaceBannedSubstring(item, visited);
      if (hit) return hit;
    }
    return null;
  }
  if (isPlainObject(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const [key, sub] of Object.entries(value)) {
      for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
        if (key.includes(banned)) return banned;
      }
      const hit = findMultiSurfaceBannedSubstring(sub, visited);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

// -- per-frame projection logic -------------------------------------------

interface FrameDraft {
  readonly outcome: MultiSurfaceFrameOutcome;
  readonly public_text?: string;
  readonly safe_summary?: string;
  readonly refusal_code?: string;
  readonly operator_only_diagnostic?: string;
}

function finalizeFrameResult(
  frame: MultiSurfaceRecallFrame,
  draft: FrameDraft,
): MultiSurfaceFrameResult {
  // Scan only the emitted fields. The leak_scan field itself is excluded
  // from the scan to avoid self-reference.
  const scanTarget: Record<string, unknown> = {};
  if (draft.public_text !== undefined) scanTarget.public_text = draft.public_text;
  if (draft.safe_summary !== undefined) scanTarget.safe_summary = draft.safe_summary;
  if (draft.refusal_code !== undefined) scanTarget.refusal_code = draft.refusal_code;
  if (draft.operator_only_diagnostic !== undefined) {
    scanTarget.operator_only_diagnostic = draft.operator_only_diagnostic;
  }
  const firstHit = findMultiSurfaceBannedSubstring(scanTarget);

  const result: Record<string, unknown> = {
    frame,
    outcome: draft.outcome,
  };
  if (draft.public_text !== undefined) result.public_text = draft.public_text;
  if (draft.safe_summary !== undefined) result.safe_summary = draft.safe_summary;
  if (draft.refusal_code !== undefined) result.refusal_code = draft.refusal_code;
  if (draft.operator_only_diagnostic !== undefined) {
    result.operator_only_diagnostic = draft.operator_only_diagnostic;
  }
  result.leak_scan = { clean: firstHit === null, first_hit: firstHit };
  return result as unknown as MultiSurfaceFrameResult;
}

function projectOperatorDev(
  input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Operator_dev partitions output the same way Phase 37C's runner
  // partitions LiveDixieRecallResult: a public_summary-shaped section
  // (here, safe_summary) and an operator-only diagnostic section. No
  // raw/private/debug/source material is reproduced; only operator-safe
  // labels are echoed.
  const safeSummary =
    `[recall · operator_dev · ${input.classification}] ` +
    `recall-result=${input.recall_result_id}`;
  const label = input.operator_diagnostic_label ?? "no_label";
  const operatorOnly =
    `INTERNAL/operator-only · classification=${input.classification}` +
    ` · recall-result=${input.recall_result_id} · label=${label}`;
  return finalizeFrameResult("operator_dev", {
    outcome: "rendered",
    safe_summary: safeSummary,
    operator_only_diagnostic: operatorOnly,
  });
}

function projectPublicDiscordSimulated(
  input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Deterministic public-safe billboard / refusal. No operational IDs.
  // No private/debug/source material. Inline allowlist: classification
  // header + safe_public_summary (if served), or a stable refusal.
  if (input.classification === "served") {
    const summaryLine = input.safe_public_summary
      ? `\nsummary: ${input.safe_public_summary}`
      : "";
    return finalizeFrameResult("public_discord_simulated", {
      outcome: "rendered",
      public_text:
        `[recall · public_discord_simulated · served]${summaryLine}`,
      safe_summary: input.safe_public_summary,
    });
  }
  const refusal = refusalCodeForPublicSurface(input.classification);
  return finalizeFrameResult("public_discord_simulated", {
    outcome: "refused",
    public_text:
      `[recall · public_discord_simulated · refused]\nstatus: this frame cannot answer publicly`,
    refusal_code: refusal,
  });
}

function projectPublicTelegramSimulated(
  _input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Phase 37D §F.3 / §H: must fail closed. No positive billboard. No
  // Telegram-specific renderer. Stable refusal code only.
  return finalizeFrameResult("public_telegram_simulated", {
    outcome: "refused",
    public_text:
      `[recall · public_telegram_simulated · refused]\nstatus: ${MULTI_SURFACE_REFUSAL_CODES.public_telegram_projection_not_implemented}`,
    refusal_code:
      MULTI_SURFACE_REFUSAL_CODES.public_telegram_projection_not_implemented,
  });
}

function projectAuthorizedPrivateSessionSimulated(
  _input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Phase 37D §F.4 / §H: must fail closed until the §5a authorized-private
  // DTO gate is satisfied. No positive private DTO. No production private
  // renderer. Stable refusal code only.
  return finalizeFrameResult("authorized_private_session_simulated", {
    outcome: "refused",
    public_text:
      `[recall · authorized_private_session_simulated · refused]\nstatus: ${MULTI_SURFACE_REFUSAL_CODES.authorized_private_projection_not_implemented}`,
    refusal_code:
      MULTI_SURFACE_REFUSAL_CODES.authorized_private_projection_not_implemented,
  });
}

function projectPrivateChatSimulated(
  _input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Phase 37D §F.5: taxonomy-only. No private chat transport, no
  // identity binding, no consent capture. Marked unimplemented.
  return finalizeFrameResult("private_chat_simulated", {
    outcome: "unimplemented",
    public_text:
      `[recall · private_chat_simulated · unimplemented]\nstatus: ${MULTI_SURFACE_REFUSAL_CODES.private_chat_projection_unimplemented}`,
    refusal_code:
      MULTI_SURFACE_REFUSAL_CODES.private_chat_projection_unimplemented,
  });
}

function projectCharacterFramePublic(
  input: MultiSurfaceRecallInput,
): MultiSurfaceFrameResult {
  // Phase 37D §F.6: no LLM, no character voice, no persona-styled prose.
  // Either deterministic referral-style output or a public-safe refusal.
  if (input.classification === "served") {
    return finalizeFrameResult("character_frame_public", {
      outcome: "rendered",
      public_text:
        `[recall · character_frame_public · referral]\n` +
        `referral target: public-recall-billboard\n` +
        `referral message: this character cannot answer privately; see the public-recall billboard`,
      safe_summary: "public-recall-billboard referral",
    });
  }
  return finalizeFrameResult("character_frame_public", {
    outcome: "refused",
    public_text:
      `[recall · character_frame_public · refused]\nstatus: ${MULTI_SURFACE_REFUSAL_CODES.character_frame_refused_publicly}`,
    refusal_code:
      MULTI_SURFACE_REFUSAL_CODES.character_frame_refused_publicly,
  });
}

function refusalCodeForPublicSurface(
  classification: MultiSurfaceRecallClassification,
): MultiSurfaceRefusalCode {
  switch (classification) {
    case "denied_or_forbidden":
      return MULTI_SURFACE_REFUSAL_CODES.denied_or_forbidden_projection_refused_publicly;
    case "needs_review":
      return MULTI_SURFACE_REFUSAL_CODES.needs_review_projection_refused_publicly;
    case "service_unauthorized":
      return MULTI_SURFACE_REFUSAL_CODES.service_unauthorized_projection_refused;
    case "unsupported_response_shape":
      return MULTI_SURFACE_REFUSAL_CODES.unsupported_response_shape_projection_refused;
    case "served":
      // Unreachable under projectPublicDiscordSimulated's guard; preserved
      // for exhaustiveness so the switch is total.
      return MULTI_SURFACE_REFUSAL_CODES.character_frame_refused_publicly;
    default: {
      const exhaustive: never = classification;
      void exhaustive;
      return MULTI_SURFACE_REFUSAL_CODES.unsupported_response_shape_projection_refused;
    }
  }
}

// -- main API -------------------------------------------------------------

export function projectAcrossMultiSurfaceFrames(
  input: MultiSurfaceRecallInput,
): MultiSurfaceRecallProjectionMatrix {
  if (
    !(MULTI_SURFACE_RECALL_CLASSIFICATIONS as readonly string[]).includes(
      input.classification,
    )
  ) {
    throw new Error(
      `multi-surface harness: unknown classification "${String(input.classification)}"`,
    );
  }

  const frames: Record<MultiSurfaceRecallFrame, MultiSurfaceFrameResult> = {
    operator_dev: projectOperatorDev(input),
    public_discord_simulated: projectPublicDiscordSimulated(input),
    public_telegram_simulated: projectPublicTelegramSimulated(input),
    authorized_private_session_simulated:
      projectAuthorizedPrivateSessionSimulated(input),
    private_chat_simulated: projectPrivateChatSimulated(input),
    character_frame_public: projectCharacterFramePublic(input),
  };

  return {
    continuity_actor_binding: input.continuity_actor_binding,
    recall_result_id: input.recall_result_id,
    classification: input.classification,
    frames,
  };
}

// -- non-degenerate matrix proof -----------------------------------------

// Stable signature for one frame, used to detect "every frame returned the
// same thing" — a degenerate matrix that fails the multi-surface proof.
function frameSignature(r: MultiSurfaceFrameResult): string {
  return JSON.stringify({
    outcome: r.outcome,
    public_text: r.public_text ?? null,
    safe_summary: r.safe_summary ?? null,
    refusal_code: r.refusal_code ?? null,
    // operator_only_diagnostic is intentionally excluded — operator_dev
    // is allowed to differ from public surfaces by virtue of having an
    // operator-only field, but the public-bound differentiation between
    // public_discord_simulated and the failing-closed surfaces must not
    // collapse to a single signature.
  });
}

export function isMultiSurfaceMatrixNonDegenerate(
  matrix: MultiSurfaceRecallProjectionMatrix,
): boolean {
  const signatures = new Set<string>();
  for (const frame of MULTI_SURFACE_RECALL_FRAMES) {
    signatures.add(frameSignature(matrix.frames[frame]));
  }
  // At least two distinguishably different per-frame signatures must be
  // present for the matrix to be non-degenerate.
  return signatures.size >= 2;
}

export function multiSurfaceMatrixDistinctSignatureCount(
  matrix: MultiSurfaceRecallProjectionMatrix,
): number {
  const signatures = new Set<string>();
  for (const frame of MULTI_SURFACE_RECALL_FRAMES) {
    signatures.add(frameSignature(matrix.frames[frame]));
  }
  return signatures.size;
}
