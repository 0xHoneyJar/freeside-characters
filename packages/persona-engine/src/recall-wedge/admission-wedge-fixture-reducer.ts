// Phase 44A · Admission Wedge fixture-bound reducer / adapter.
//
// Authority: docs/ADMISSION-WEDGE-MVP-DESIGN.md (Phase 43B design) and the
// Phase 43C fixture / operator-contract under docs/admission-wedge/fixtures/
// (PR #155). Phase 44A turns that fixture contract into a pure, local,
// dependency-free reducer that proves the §D invariant *in code* — over
// already-loaded fixture-like objects.
//
// What this reducer proves (docs/ADMISSION-WEDGE-MVP-DESIGN.md §D):
//   1. candidate memory is not admitted memory;
//   2. candidate memory is not recallable as governed continuity before
//      admission;
//   3. an accepted admission transition mints an admitted assertion;
//   4. a rejected candidate never mints an admitted assertion and never
//      becomes recallable;
//   5. supersession/correction recalls only the corrected active assertion
//      while preserving audit/provenance links to the superseded prior state;
//   6. raw candidate / private payload is never treated as ordinary recall
//      material;
//   7. unsupported or malformed fixture inputs fail closed.
//
// What this reducer is NOT (carried verbatim from Phase 43B §M / 43C scope):
//   - it is NOT a live admission implementation. It admits nothing, stores
//     nothing, and reaches no network. It is pure over already-parsed
//     fixture-like objects;
//   - it is NOT wired into Discord, Dixie, the public renderer, the live
//     client, dispatch, startup, command registration, or any package
//     export. It is imported only by its own test file;
//   - it does NOT authorize production admission, production storage,
//     production auth / consent, public remember-this, Discord history
//     ingestion, user chat becoming memory, a live Dixie admission route, or
//     a Finn production wiring. All of those remain blocked.
//
// Determinism: this module reads no clock, no env, no filesystem, and no
// network. It is a pure function of its inputs. Its test loads the Phase 43C
// fixtures from disk and feeds them in.

// -- stable reason codes ---------------------------------------------------
//
// Every reducer outcome carries a stable reason code rather than a raw
// error. The first five are SUCCESS classifications; the rest are
// FAIL-CLOSED codes. Tests and future audits pin against these names.
export const ADMISSION_REDUCER_REASON_CODES = {
  // success classifications
  candidate_not_admitted: "candidate_not_admitted",
  admitted_active_assertion: "admitted_active_assertion",
  candidate_rejected: "candidate_rejected",
  corrected_active_assertion: "corrected_active_assertion",
  superseded_not_ordinary_recallable: "superseded_not_ordinary_recallable",
  // fail-closed codes
  unsupported_fixture_shape: "unsupported_fixture_shape",
  mismatched_candidate_transition: "mismatched_candidate_transition",
  mismatched_candidate_assertion: "mismatched_candidate_assertion",
  mismatched_transition_assertion: "mismatched_transition_assertion",
  accepted_transition_missing_assertion: "accepted_transition_missing_assertion",
  rejected_transition_minted_assertion: "rejected_transition_minted_assertion",
  admitted_assertion_missing_provenance: "admitted_assertion_missing_provenance",
  candidate_recall_eligible_before_admission:
    "candidate_recall_eligible_before_admission",
  candidate_included_in_ordinary_recall: "candidate_included_in_ordinary_recall",
  superseded_included_as_active_recall: "superseded_included_as_active_recall",
  unsafe_candidate_payload_projection: "unsafe_candidate_payload_projection",
  unsafe_private_sentinel_projection: "unsafe_private_sentinel_projection",
} as const;

export type AdmissionReducerReasonCode =
  (typeof ADMISSION_REDUCER_REASON_CODES)[keyof typeof ADMISSION_REDUCER_REASON_CODES];

const ADMISSION_REDUCER_REASON_CODE_SET = new Set<string>(
  Object.values(ADMISSION_REDUCER_REASON_CODES),
);

// -- private-body sentinels (no-leak gate) ---------------------------------
//
// The Phase 43C candidate / admitted / superseded private bodies and source
// material carry these sentinel prefixes. Ordinary recall material — and the
// reducer's own safe projection output — must contain NONE of them. Mirrors
// the validator's PRIVATE_BODY_SENTINELS (docs/admission-wedge/fixtures/
// validate-fixtures.mjs); the reducer does not widen the boundary.
export const ADMISSION_PRIVATE_BODY_SENTINELS = [
  "CANDIDATE_PRIVATE_SENTINEL",
  "SOURCE_SENTINEL",
  "ADMITTED_PRIVATE_SENTINEL",
  "SUPERSEDED_PRIVATE_SENTINEL",
] as const;

// -- supported fixture vocabulary ------------------------------------------

const SUPPORTED_FIXTURE_VERSION_PREFIX = "phase-43c";

const FIXTURE_KIND = {
  candidate: "candidate_memory_packet",
  transition: "admission_transition",
  admitted: "admitted_memory_packet",
  recallProof: "admission_recall_proof",
} as const;

// -- output shapes ---------------------------------------------------------

export interface AdmissionFailClosed {
  readonly ok: false;
  readonly reasonCode: AdmissionReducerReasonCode;
  // Generic diagnostic selected only from the stable reason code. It carries
  // no raw private body, candidate / fixture value, operational id, long id,
  // secret, url, stack trace, or json fragment. The stable `reasonCode` is the
  // machine-readable outcome; `detail` is a sealed human breadcrumb.
  readonly detail: string;
}

export interface CandidateClassificationOk {
  readonly ok: true;
  readonly kind: "candidate";
  readonly candidateId: string;
  readonly admitted: false;
  readonly recallEligible: false;
  readonly ordinaryRecallMaterial: false;
  readonly proposedSupersedesAssertionId: string | null;
  readonly reasonCode: "candidate_not_admitted";
}
export type CandidateClassification =
  | CandidateClassificationOk
  | AdmissionFailClosed;

export interface AdmittedAssertionProjection {
  readonly assertionId: string;
  readonly admitted: true;
  readonly active: true;
  readonly recallEligible: true;
  // the single public-safe summary string (boundary = public_safe). It is
  // scanned for sentinels before being emitted.
  readonly publicSummary: string;
  // source candidate / transition / receipt preserved as audit / provenance
  // links ONLY — short ids, never raw bodies.
  readonly audit: {
    readonly sourceCandidateId: string;
    readonly admissionTransitionId: string;
    readonly admissionReceiptRef: string | null;
    readonly supersedesAssertionId: string | null;
  };
}

export interface AdmissionTransitionAcceptedOk {
  readonly ok: true;
  readonly decision: "accepted";
  readonly candidateId: string;
  readonly transitionId: string;
  readonly admittedAssertion: AdmittedAssertionProjection;
  readonly supersededAssertionId: string | null;
  readonly reasonCode: "admitted_active_assertion" | "corrected_active_assertion";
}
export interface AdmissionTransitionRejectedOk {
  readonly ok: true;
  readonly decision: "rejected";
  readonly candidateId: string;
  readonly transitionId: string;
  readonly admittedAssertion: null;
  readonly reasonCode: "candidate_rejected";
}
export type AdmissionTransitionResult =
  | AdmissionTransitionAcceptedOk
  | AdmissionTransitionRejectedOk
  | AdmissionFailClosed;

export interface RecallProofExcludedOk {
  readonly ok: true;
  readonly phase: string;
  readonly recallResult: "excluded";
  readonly recallEligible: false;
  readonly includedAssertionIds: readonly string[]; // always empty / candidate-free
  readonly excludedCandidateIds: readonly string[];
  readonly renderedCandidatePayload: false;
  readonly publicSummary: string;
  readonly reasonCode: "candidate_not_admitted" | "candidate_rejected";
  readonly recallRoute: string;
}
export interface RecallProofIncludedOk {
  readonly ok: true;
  readonly phase: string;
  readonly recallResult: "included";
  readonly recallEligible: true;
  readonly includedAssertionIds: readonly string[]; // admitted assertion ids only
  readonly excludedAssertionIds: readonly string[]; // superseded prior state, if any
  readonly renderedCandidatePayload: false;
  readonly renderedPriorState: false;
  readonly publicSummary: string;
  readonly reasonCode: "admitted_active_assertion" | "corrected_active_assertion";
  readonly supersededReasonCode: "superseded_not_ordinary_recallable" | null;
  readonly audit: {
    readonly sourceCandidateId: string | null;
    readonly admissionTransitionId: string | null;
    readonly admissionReceiptRef: string | null;
    readonly supersedesAssertionId: string | null;
  };
  readonly recallRoute: string;
}
export type RecallProofProjection =
  | RecallProofExcludedOk
  | RecallProofIncludedOk
  | AdmissionFailClosed;

export type AdmissionScenarioKind =
  | "before_admission"
  | "accepted"
  | "rejected"
  | "supersession";

export interface AdmissionScenarioProofOk {
  readonly ok: true;
  readonly scenario: AdmissionScenarioKind;
  readonly reasonCode: AdmissionReducerReasonCode;
  readonly candidate: CandidateClassificationOk;
  readonly transition:
    | AdmissionTransitionAcceptedOk
    | AdmissionTransitionRejectedOk
    | null;
  readonly recall: RecallProofExcludedOk | RecallProofIncludedOk;
  readonly invariantsHeld: readonly string[];
}
export type AdmissionScenarioProof =
  | AdmissionScenarioProofOk
  | AdmissionFailClosed;

export type AdmissionFixtureScenario =
  | { readonly kind: "before_admission"; readonly candidate: unknown; readonly recallProof: unknown }
  | {
      readonly kind: "accepted";
      readonly candidate: unknown;
      readonly transition: unknown;
      readonly admittedAssertion: unknown;
      readonly recallProof: unknown;
    }
  | {
      readonly kind: "rejected";
      readonly candidate: unknown;
      readonly transition: unknown;
      readonly recallProof: unknown;
    }
  | {
      readonly kind: "supersession";
      readonly correctionCandidate: unknown;
      readonly supersedeTransition: unknown;
      readonly correctedAssertion: unknown;
      readonly supersededAssertion: unknown;
      readonly recallProof: unknown;
    };

// -- safe field readers ----------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}
function getString(rec: Record<string, unknown>, key: string): string | null {
  const v = rec[key];
  return typeof v === "string" ? v : null;
}
function getStringArray(
  rec: Record<string, unknown>,
  key: string,
): readonly string[] | null {
  const v = rec[key];
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => typeof x === "string")) return null;
  return v as string[];
}

// Fail-closed details are always sealed by reason code. The local detail passed
// by each branch is intentionally ignored at the emission boundary so no raw
// input value, fixture value, id, url, secret, stack trace, or json fragment can
// leave the reducer through `detail`.
export function safeDetailForReason(
  reasonCode: AdmissionReducerReasonCode,
): string {
  const safeReasonCode = ADMISSION_REDUCER_REASON_CODE_SET.has(reasonCode)
    ? reasonCode
    : ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape;
  return `fail-closed: ${safeReasonCode}`;
}

export function safeDetail(
  reasonCode: AdmissionReducerReasonCode,
  detail: string,
): string {
  void detail;
  return safeDetailForReason(reasonCode);
}

function fail(
  reasonCode: AdmissionReducerReasonCode,
  detail: string,
): AdmissionFailClosed {
  return { ok: false, reasonCode, detail: safeDetail(reasonCode, detail) };
}

// -- no-leak / unsafe-projection scan --------------------------------------
//
// Walks every string value AND every key in `value` and returns a stable
// category label for the first unsafe substring encountered, or null. It
// returns a CATEGORY, never the raw matched value, so a fail-closed detail
// built from it can never itself carry the banned material.
function classifyUnsafeString(s: string): string | null {
  for (const sentinel of ADMISSION_PRIVATE_BODY_SENTINELS) {
    if (s.includes(sentinel)) return "private_body_sentinel";
  }
  if (/\d{17,}/.test(s)) return "long_id_run";
  if (/0x[a-fA-F0-9]{40,}/.test(s)) return "hex_address";
  if (/https?:\/\//i.test(s)) return "url";
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) return "pem_private_key";
  return null;
}

export function scanForUnsafeProjection(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): string | null {
  if (typeof value === "string") return classifyUnsafeString(value);
  if (Array.isArray(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const item of value) {
      const hit = scanForUnsafeProjection(item, visited);
      if (hit) return hit;
    }
    return null;
  }
  if (isPlainObject(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    for (const [key, sub] of Object.entries(value)) {
      const keyHit = classifyUnsafeString(key);
      if (keyHit) return keyHit;
      const hit = scanForUnsafeProjection(sub, visited);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

// Final output gate. Every successful projection is sealed: its entire
// output object is scanned, and if any unsafe material slipped through it is
// replaced with a fail-closed result. This guarantees the reducer never
// emits a raw candidate / private body, long id, secret, or url in a
// safe-projection field — even if a future fixture or refactor regresses.
function sealAdmissionProjection<T extends object>(
  result: T,
): T | AdmissionFailClosed {
  const hit = scanForUnsafeProjection(result);
  if (hit) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
      `blocked: unsafe material (${hit}) in safe projection output`,
    );
  }
  return result;
}

function isSupportedVersion(version: string | null): boolean {
  if (version === null) return false;
  return version.startsWith(SUPPORTED_FIXTURE_VERSION_PREFIX + ".");
}

// =========================================================================
// 1. classifyAdmissionCandidate
// =========================================================================
//
// A candidate is a proposal, not governed continuity. Classify it and prove
// it is not admitted, not recall-eligible, and not ordinary recall material.
// Fails closed on a malformed candidate, an unknown kind/version, a missing
// id, or a candidate that claims recall-eligibility before admission.
export function classifyAdmissionCandidate(
  candidate: unknown,
): CandidateClassification {
  const rec = asRecord(candidate);
  if (!rec) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "candidate: not an object",
    );
  }
  const fixtureKind = getString(rec, "fixture_kind");
  if (fixtureKind !== FIXTURE_KIND.candidate) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "candidate: unknown fixture_kind",
    );
  }
  if (!isSupportedVersion(getString(rec, "fixture_version"))) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "candidate: unsupported fixture_version",
    );
  }
  const candidateId = getString(rec, "candidate_id");
  if (!candidateId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'candidate: required field "candidate_id" missing',
    );
  }
  // a candidate that already claims recall-eligibility before admission is a
  // direct violation of the invariant — fail closed (not merely malformed).
  const recallEligibility = getString(rec, "recall_eligibility");
  if (recallEligibility === "eligible") {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.candidate_recall_eligible_before_admission,
      'candidate: recall_eligibility is "eligible" before admission',
    );
  }
  if (recallEligibility !== "ineligible") {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'candidate: recall_eligibility must be "ineligible"',
    );
  }
  const admissionState = getString(rec, "admission_state");
  if (admissionState !== "candidate_pending") {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'candidate: admission_state must be "candidate_pending"',
    );
  }

  const result: CandidateClassificationOk = {
    ok: true,
    kind: "candidate",
    candidateId,
    admitted: false,
    recallEligible: false,
    ordinaryRecallMaterial: false,
    proposedSupersedesAssertionId:
      getString(rec, "proposed_supersedes_assertion_id"),
    reasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
  };
  // candidate payload (summary_public / body_private / source_material) is
  // deliberately NOT carried into the classification — a candidate is
  // never_rendered. Seal anyway to keep the contract uniform.
  return sealAdmissionProjection(result);
}

// =========================================================================
// 2. applyAdmissionTransition
// =========================================================================
//
// The single explicit door: candidate -> admitted (accept / supersede) or
// candidate -> rejected. Verifies the candidate<->transition<->assertion
// linkage and mints (or refuses) the admitted assertion projection. Fails
// closed on every linkage break, on an accept with no minted assertion, and
// on a reject that mints one.
export function applyAdmissionTransition(args: {
  readonly candidate: unknown;
  readonly transition: unknown;
  readonly admittedAssertion?: unknown;
  readonly supersededAssertion?: unknown;
}): AdmissionTransitionResult {
  const candidate = classifyAdmissionCandidate(args.candidate);
  if (!candidate.ok) return candidate;

  const tRec = asRecord(args.transition);
  if (!tRec) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "transition: not an object",
    );
  }
  if (getString(tRec, "fixture_kind") !== FIXTURE_KIND.transition) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "transition: unknown fixture_kind",
    );
  }
  if (!isSupportedVersion(getString(tRec, "transition_version"))) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "transition: unsupported transition_version",
    );
  }
  const transitionId = getString(tRec, "transition_id");
  if (!transitionId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'transition: required field "transition_id" missing',
    );
  }
  const transitionCandidateId = getString(tRec, "candidate_id");
  if (!transitionCandidateId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'transition: required field "candidate_id" missing',
    );
  }
  if (transitionCandidateId !== candidate.candidateId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_transition,
      "transition: candidate_id does not match the candidate",
    );
  }

  const decision = getString(tRec, "admission_decision");
  const mintedId = "admitted_assertion_id" in tRec ? tRec.admitted_assertion_id : undefined;

  if (decision === "rejected") {
    // a rejected transition must mint nothing.
    if (mintedId !== null) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.rejected_transition_minted_assertion,
        "transition: rejected but admitted_assertion_id is not null",
      );
    }
    if (args.admittedAssertion != null) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.rejected_transition_minted_assertion,
        "transition: rejected but an admitted assertion was supplied",
      );
    }
    const rejected: AdmissionTransitionRejectedOk = {
      ok: true,
      decision: "rejected",
      candidateId: candidate.candidateId,
      transitionId,
      admittedAssertion: null,
      reasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
    };
    return sealAdmissionProjection(rejected);
  }

  if (decision !== "accepted") {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "transition: unknown admission_decision",
    );
  }

  // -- accepted (and possibly supersede) --
  if (typeof mintedId !== "string" || mintedId.length === 0) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.accepted_transition_missing_assertion,
      "transition: accepted but admitted_assertion_id is missing/null",
    );
  }
  const aRec = asRecord(args.admittedAssertion);
  if (!aRec) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.accepted_transition_missing_assertion,
      "transition: accepted but no admitted assertion supplied",
    );
  }
  if (getString(aRec, "fixture_kind") !== FIXTURE_KIND.admitted) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "admitted assertion: unknown fixture_kind",
    );
  }
  if (!isSupportedVersion(getString(aRec, "fixture_version"))) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "admitted assertion: unsupported fixture_version",
    );
  }
  const assertionId = getString(aRec, "assertion_id");
  if (!assertionId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      'admitted assertion: required field "assertion_id" missing',
    );
  }
  if (assertionId !== mintedId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
      "transition: minted assertion id does not match the supplied admitted assertion",
    );
  }
  // provenance: the admitted assertion must reference its source candidate
  // and its admitting transition.
  const sourceCandidateId = getString(aRec, "source_candidate_id");
  if (!sourceCandidateId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.admitted_assertion_missing_provenance,
      "admitted assertion: source_candidate_id missing",
    );
  }
  const admissionTransitionId = getString(aRec, "admission_transition_id");
  if (!admissionTransitionId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.admitted_assertion_missing_provenance,
      "admitted assertion: admission_transition_id missing",
    );
  }
  if (sourceCandidateId !== candidate.candidateId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_assertion,
      "admitted assertion: source_candidate_id does not match the candidate",
    );
  }
  if (admissionTransitionId !== transitionId) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
      "admitted assertion: admission_transition_id does not match the transition",
    );
  }
  // the freshly admitted assertion must be admitted / active / eligible.
  if (
    getString(aRec, "admission_state") !== "admitted" ||
    getString(aRec, "assertion_status") !== "active" ||
    getString(aRec, "recall_eligibility") !== "eligible"
  ) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "admitted assertion: must be admitted/active/eligible",
    );
  }
  const publicSummary = getString(aRec, "summary_public");
  if (publicSummary === null) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "admitted assertion: summary_public missing",
    );
  }

  // -- supersession sub-decision --
  const supersedesId =
    "supersedes_assertion_id" in tRec ? tRec.supersedes_assertion_id : null;
  let reasonCode: "admitted_active_assertion" | "corrected_active_assertion" =
    ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion;
  let supersededAssertionId: string | null = null;

  if (typeof supersedesId === "string" && supersedesId.length > 0) {
    reasonCode = ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion;
    supersededAssertionId = supersedesId;
    // the corrected assertion must record the supersedes link.
    if (getString(aRec, "supersedes_assertion_id") !== supersedesId) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
        "admitted assertion: supersedes_assertion_id does not match the transition's",
      );
    }
    // if the prior state was supplied, prove it was correctly retired.
    if (args.supersededAssertion != null) {
      const pRec = asRecord(args.supersededAssertion);
      if (!pRec) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "superseded assertion: not an object",
        );
      }
      const priorId = getString(pRec, "assertion_id");
      if (priorId !== supersedesId) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
          "superseded assertion: id does not match supersedes_assertion_id",
        );
      }
      if (
        getString(pRec, "admission_state") !== "superseded" ||
        getString(pRec, "assertion_status") !== "superseded" ||
        getString(pRec, "recall_eligibility") !== "ineligible"
      ) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "superseded assertion: must be superseded/ineligible",
        );
      }
      if (getString(pRec, "superseded_by_assertion_id") !== assertionId) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
          "superseded assertion: superseded_by_assertion_id does not reference the corrected assertion",
        );
      }
    }
  } else if (supersedesId !== null && supersedesId !== undefined) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "transition: supersedes_assertion_id has unexpected shape",
    );
  }

  const admittedAssertion: AdmittedAssertionProjection = {
    assertionId,
    admitted: true,
    active: true,
    recallEligible: true,
    publicSummary,
    audit: {
      sourceCandidateId,
      admissionTransitionId,
      admissionReceiptRef: getString(aRec, "admission_receipt_ref"),
      supersedesAssertionId: supersededAssertionId,
    },
  };
  const accepted: AdmissionTransitionAcceptedOk = {
    ok: true,
    decision: "accepted",
    candidateId: candidate.candidateId,
    transitionId,
    admittedAssertion,
    supersededAssertionId,
    reasonCode,
  };
  return sealAdmissionProjection(accepted);
}

// =========================================================================
// 3. projectAdmissionRecallProof
// =========================================================================
//
// Project the recall-proof fixture into a small, safe recall result. The
// ordinary-recall portion of the proof (public_recall_output +
// included_assertion_ids) is scanned for private sentinels and candidate
// material; the candidate / receipt / supersedes links live only under
// audit. Fails closed if a candidate is treated as ordinary recall material,
// if the superseded prior state surfaces as active, if a candidate payload
// is rendered, or if a private sentinel reaches ordinary recall output.
export function projectAdmissionRecallProof(args: {
  readonly recallProof: unknown;
  readonly candidateId?: string;
  readonly admittedAssertionId?: string;
  readonly supersededAssertionId?: string;
}): RecallProofProjection {
  const rec = asRecord(args.recallProof);
  if (!rec) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "recall proof: not an object",
    );
  }
  if (getString(rec, "fixture_kind") !== FIXTURE_KIND.recallProof) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "recall proof: unknown fixture_kind",
    );
  }
  if (!isSupportedVersion(getString(rec, "fixture_version"))) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "recall proof: unsupported fixture_version",
    );
  }
  const proofId = getString(rec, "proof_id");
  const phase = getString(rec, "proof_phase");
  const recallRoute = getString(rec, "recall_route");
  if (!proofId || !phase || !recallRoute) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      "recall proof: required field (proof_id / proof_phase / recall_route) missing",
    );
  }

  // -- no-leak gate over the ORDINARY-RECALL portion of the proof only --
  // audit_links (which legitimately carry the source candidate / receipt /
  // supersedes ids) are excluded from this scan.
  const publicOutput = asRecord(rec.public_recall_output);
  const ordinaryRecallMaterial = {
    public_recall_output: rec.public_recall_output,
    included_assertion_ids: rec.included_assertion_ids,
  };
  const leak = scanForUnsafeProjection(ordinaryRecallMaterial);
  if (leak === "private_body_sentinel") {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
      "recall proof: private sentinel in ordinary recall output",
    );
  }
  if (leak) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
      `recall proof: unsafe material (${leak}) in ordinary recall output`,
    );
  }

  // a rendered candidate payload is never permitted on the recall surface.
  if (publicOutput && publicOutput.rendered_candidate_payload !== false) {
    return fail(
      ADMISSION_REDUCER_REASON_CODES.unsafe_candidate_payload_projection,
      "recall proof: rendered_candidate_payload must be false",
    );
  }

  const recallResult = getString(rec, "recall_result");
  const classification = getString(rec, "recall_classification");
  const included = getStringArray(rec, "included_assertion_ids") ?? [];
  const publicSummary = publicOutput
    ? getString(publicOutput, "public_summary") ?? ""
    : "";

  if (recallResult === "excluded") {
    // before-admission and rejected both fail closed to the not-found family.
    if (classification === "served") {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
        'recall proof: excluded result must not classify "served"',
      );
    }
    // the candidate must not appear as ordinary recall material.
    const consideredCandidate =
      args.candidateId ?? getString(rec, "considered_candidate_id");
    if (consideredCandidate && included.includes(consideredCandidate)) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.candidate_included_in_ordinary_recall,
        "recall proof: candidate present in included_assertion_ids",
      );
    }
    if (included.length !== 0) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.candidate_included_in_ordinary_recall,
        "recall proof: excluded result must have empty included_assertion_ids",
      );
    }
    const exclusionReason = getString(rec, "exclusion_reason");
    let reasonCode: "candidate_not_admitted" | "candidate_rejected";
    if (exclusionReason === "candidate_not_admitted") {
      reasonCode = ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted;
    } else if (exclusionReason === "candidate_rejected") {
      reasonCode = ADMISSION_REDUCER_REASON_CODES.candidate_rejected;
    } else {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
        "recall proof: unknown exclusion_reason",
      );
    }
    const excludedCandidateIds =
      getStringArray(rec, "excluded_candidate_ids") ?? [];
    const result: RecallProofExcludedOk = {
      ok: true,
      phase,
      recallResult: "excluded",
      recallEligible: false,
      includedAssertionIds: [],
      excludedCandidateIds,
      renderedCandidatePayload: false,
      publicSummary,
      reasonCode,
      recallRoute,
    };
    return sealAdmissionProjection(result);
  }

  if (recallResult === "included") {
    if (classification !== "served") {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
        'recall proof: included result must classify "served"',
      );
    }
    if (included.length === 0) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
        "recall proof: included result must have a non-empty included_assertion_ids",
      );
    }
    // a candidate id must never be treated as ordinary recall material.
    const candidateId =
      args.candidateId ?? getString(rec, "considered_candidate_id");
    if (candidateId && included.includes(candidateId)) {
      return fail(
        ADMISSION_REDUCER_REASON_CODES.candidate_included_in_ordinary_recall,
        "recall proof: raw candidate present in included_assertion_ids",
      );
    }
    if (args.admittedAssertionId) {
      if (
        included.length !== 1 ||
        included[0] !== args.admittedAssertionId
      ) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
          "recall proof: included_assertion_ids must be exactly the admitted assertion id",
        );
      }
    }

    // supersession: detect from the proof or the supplied context.
    const proofSupersededId = getString(rec, "superseded_assertion_id");
    const supersededId = args.supersededAssertionId ?? proofSupersededId;
    const excludedAssertionIds =
      getStringArray(rec, "excluded_assertion_ids") ?? [];
    let reasonCode: "admitted_active_assertion" | "corrected_active_assertion" =
      ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion;
    let supersededReasonCode:
      | "superseded_not_ordinary_recallable"
      | null = null;

    if (supersededId) {
      reasonCode = ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion;
      supersededReasonCode =
        ADMISSION_REDUCER_REASON_CODES.superseded_not_ordinary_recallable;
      // the wrong prior state must NOT surface as active ordinary recall.
      if (included.includes(supersededId)) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.superseded_included_as_active_recall,
          "recall proof: superseded prior present in included_assertion_ids",
        );
      }
      if (!excludedAssertionIds.includes(supersededId)) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.superseded_included_as_active_recall,
          "recall proof: superseded prior not recorded in excluded_assertion_ids",
        );
      }
      if (publicOutput && publicOutput.rendered_prior_state !== false) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.superseded_included_as_active_recall,
          "recall proof: rendered_prior_state must be false",
        );
      }
    }

    const auditRec = asRecord(rec.audit_links);
    const result: RecallProofIncludedOk = {
      ok: true,
      phase,
      recallResult: "included",
      recallEligible: true,
      includedAssertionIds: included,
      excludedAssertionIds,
      renderedCandidatePayload: false,
      renderedPriorState: false,
      publicSummary,
      reasonCode,
      supersededReasonCode,
      audit: {
        sourceCandidateId: auditRec
          ? getString(auditRec, "source_candidate_id")
          : null,
        admissionTransitionId: auditRec
          ? getString(auditRec, "admission_transition_id")
          : null,
        admissionReceiptRef: auditRec
          ? getString(auditRec, "admission_receipt_ref")
          : null,
        supersedesAssertionId: auditRec
          ? getString(auditRec, "supersedes_assertion_id")
          : null,
      },
      recallRoute,
    };
    return sealAdmissionProjection(result);
  }

  return fail(
    ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    "recall proof: unknown recall_result",
  );
}

// =========================================================================
// 4. reduceAdmissionFixtureScenario
// =========================================================================
//
// Compose the three reducers over one of the four Phase 43C scenarios and
// cross-check the pieces against each other. Returns a single small proof
// object, or fails closed at the first violation.
export function reduceAdmissionFixtureScenario(
  scenario: AdmissionFixtureScenario,
): AdmissionScenarioProof {
  switch (scenario.kind) {
    case "before_admission": {
      const candidate = classifyAdmissionCandidate(scenario.candidate);
      if (!candidate.ok) return candidate;
      const recall = projectAdmissionRecallProof({
        recallProof: scenario.recallProof,
        candidateId: candidate.candidateId,
      });
      if (!recall.ok) return recall;
      if (recall.recallResult !== "excluded") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "before_admission: recall proof must be excluded",
        );
      }
      if (recall.reasonCode !== ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          `before_admission: expected candidate_not_admitted, got ${recall.reasonCode}`,
        );
      }
      const proof: AdmissionScenarioProofOk = {
        ok: true,
        scenario: "before_admission",
        reasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
        candidate,
        transition: null,
        recall,
        invariantsHeld: [
          "candidate_is_not_admitted",
          "candidate_not_recallable_before_admission",
          "candidate_payload_not_rendered",
        ],
      };
      return sealAdmissionProjection(proof);
    }

    case "accepted": {
      const candidate = classifyAdmissionCandidate(scenario.candidate);
      if (!candidate.ok) return candidate;
      const transition = applyAdmissionTransition({
        candidate: scenario.candidate,
        transition: scenario.transition,
        admittedAssertion: scenario.admittedAssertion,
      });
      if (!transition.ok) return transition;
      if (transition.decision !== "accepted") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "accepted: transition must be an accept",
        );
      }
      const recall = projectAdmissionRecallProof({
        recallProof: scenario.recallProof,
        candidateId: candidate.candidateId,
        admittedAssertionId: transition.admittedAssertion.assertionId,
      });
      if (!recall.ok) return recall;
      if (recall.recallResult !== "included") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "accepted: recall proof must be included",
        );
      }
      // cross-check: the served assertion is exactly the one the transition
      // minted; its source candidate matches under audit.
      if (recall.includedAssertionIds[0] !== transition.admittedAssertion.assertionId) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
          "accepted: recall included id does not match the minted assertion",
        );
      }
      if (
        recall.audit.sourceCandidateId !== null &&
        recall.audit.sourceCandidateId !== candidate.candidateId
      ) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_assertion,
          "accepted: recall audit source candidate does not match",
        );
      }
      const proof: AdmissionScenarioProofOk = {
        ok: true,
        scenario: "accepted",
        reasonCode: ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
        candidate,
        transition,
        recall,
        invariantsHeld: [
          "accept_mints_admitted_assertion",
          "admitted_assertion_references_candidate_and_transition",
          "admitted_assertion_recall_eligible",
          "raw_candidate_not_ordinary_recall_material",
        ],
      };
      return sealAdmissionProjection(proof);
    }

    case "rejected": {
      const candidate = classifyAdmissionCandidate(scenario.candidate);
      if (!candidate.ok) return candidate;
      const transition = applyAdmissionTransition({
        candidate: scenario.candidate,
        transition: scenario.transition,
        admittedAssertion: null,
      });
      if (!transition.ok) return transition;
      if (transition.decision !== "rejected") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "rejected: transition must be a reject",
        );
      }
      const recall = projectAdmissionRecallProof({
        recallProof: scenario.recallProof,
        candidateId: candidate.candidateId,
      });
      if (!recall.ok) return recall;
      if (recall.recallResult !== "excluded") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "rejected: recall proof must be excluded",
        );
      }
      if (recall.reasonCode !== ADMISSION_REDUCER_REASON_CODES.candidate_rejected) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          `rejected: expected candidate_rejected, got ${recall.reasonCode}`,
        );
      }
      const proof: AdmissionScenarioProofOk = {
        ok: true,
        scenario: "rejected",
        reasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
        candidate,
        transition,
        recall,
        invariantsHeld: [
          "rejected_mints_no_assertion",
          "rejected_never_recallable",
          "rejection_is_terminal",
        ],
      };
      return sealAdmissionProjection(proof);
    }

    case "supersession": {
      const candidate = classifyAdmissionCandidate(scenario.correctionCandidate);
      if (!candidate.ok) return candidate;
      const transition = applyAdmissionTransition({
        candidate: scenario.correctionCandidate,
        transition: scenario.supersedeTransition,
        admittedAssertion: scenario.correctedAssertion,
        supersededAssertion: scenario.supersededAssertion,
      });
      if (!transition.ok) return transition;
      if (transition.decision !== "accepted") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "supersession: transition must be an accept",
        );
      }
      if (transition.reasonCode !== ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "supersession: transition must be a supersede (corrected_active_assertion)",
        );
      }
      const recall = projectAdmissionRecallProof({
        recallProof: scenario.recallProof,
        candidateId: candidate.candidateId,
        admittedAssertionId: transition.admittedAssertion.assertionId,
        supersededAssertionId: transition.supersededAssertionId ?? undefined,
      });
      if (!recall.ok) return recall;
      if (recall.recallResult !== "included") {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
          "supersession: recall proof must be included",
        );
      }
      // cross-check: corrected active included; superseded prior excluded.
      if (recall.includedAssertionIds[0] !== transition.admittedAssertion.assertionId) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
          "supersession: recall included id does not match the corrected assertion",
        );
      }
      if (
        transition.supersededAssertionId &&
        !recall.excludedAssertionIds.includes(transition.supersededAssertionId)
      ) {
        return fail(
          ADMISSION_REDUCER_REASON_CODES.superseded_included_as_active_recall,
          "supersession: superseded prior not recorded as excluded in recall",
        );
      }
      const proof: AdmissionScenarioProofOk = {
        ok: true,
        scenario: "supersession",
        reasonCode: ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion,
        candidate,
        transition,
        recall,
        invariantsHeld: [
          "supersede_mints_corrected_active_assertion",
          "corrected_state_recalled_not_prior",
          "superseded_prior_excluded_from_ordinary_recall",
          "supersedes_link_preserved_for_audit",
        ],
      };
      return sealAdmissionProjection(proof);
    }

    default: {
      // exhaustiveness guard — any unknown scenario kind fails closed.
      const exhaustive: never = scenario;
      void exhaustive;
      return fail(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
        "scenario: unknown kind",
      );
    }
  }
}
