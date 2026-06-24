// Phase 44A · Admission Wedge fixture-bound reducer regression gate.
//
// Authority: docs/ADMISSION-WEDGE-MVP-DESIGN.md (Phase 43B design) and the
// Phase 43C fixture/operator-contract under docs/admission-wedge/fixtures/.
//
// These tests drive the pure reducer in ./admission-wedge-fixture-reducer.ts
// against the Phase 43C fixtures, loaded from disk with node:fs (the same
// pattern dixie-envelope-adapter.test.ts uses to read
// docs/recall-wedge/fixtures). They prove the §D invariant in code:
//
//   1. a pending candidate is not admitted and not recall-eligible;
//   2. before-admission recall excludes the candidate and renders no payload;
//   3. an accepted transition mints exactly the admitted assertion;
//   4. the admitted assertion references its source candidate and transition;
//   5. after-admission recall includes the admitted assertion only;
//   6. a rejected candidate mints no assertion and stays excluded;
//   7. supersession/correction includes the corrected active assertion only;
//   8. the superseded prior is preserved as audit/provenance, not ordinary
//      recall;
//   9. a mismatched candidate/transition fails closed;
//  10. an accepted transition without an admitted assertion fails closed;
//  11. a rejected transition that mints an assertion fails closed;
//  12. a candidate marked recall-eligible before admission fails closed;
//  13. a private sentinel in ordinary recall projection fails closed;
//  14. an unknown/malformed fixture kind/version fails closed;
//  15. reducer output never contains a raw candidate/private payload in any
//      safe projection field.
//
// Scope reminder (Phase 43B §M / 43C): this is a fixture-bound reducer. It
// admits nothing, stores nothing, reaches no network, and is wired into no
// Discord/Dixie/runtime path. It authorizes no live admission.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMISSION_PRIVATE_BODY_SENTINELS,
  ADMISSION_REDUCER_REASON_CODES,
  applyAdmissionTransition,
  classifyAdmissionCandidate,
  projectAdmissionRecallProof,
  reduceAdmissionFixtureScenario,
  safeDetail,
  safeDetailForReason,
  scanForUnsafeProjection,
} from "./admission-wedge-fixture-reducer.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/admission-wedge/fixtures",
);

function loadFixture(relPath: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, relPath), "utf8"));
}

// -- the Phase 43C fixture graph, loaded from disk ------------------------

const CAND_001 = loadFixture("candidates/cand-001-accepted-pending.json");
const CAND_002 = loadFixture("candidates/cand-002-rejected-pending.json");
const CAND_010 = loadFixture("candidates/cand-010-original-pending.json");
const CAND_011 = loadFixture("candidates/cand-011-correction-pending.json");

const TRANS_001 = loadFixture("transitions/trans-001-accept.json");
const TRANS_002 = loadFixture("transitions/trans-002-reject.json");
const TRANS_010 = loadFixture("transitions/trans-010-accept-original.json");
const TRANS_011 = loadFixture("transitions/trans-011-supersede.json");

const ASSN_001 = loadFixture("admitted/assn-001-active.json");
const ASSN_010 = loadFixture("admitted/assn-010-superseded.json");
const ASSN_011 = loadFixture("admitted/assn-011-active-correction.json");

const PROOF_001 = loadFixture(
  "recall-proofs/proof-001-before-admission-excluded.json",
);
const PROOF_002 = loadFixture(
  "recall-proofs/proof-002-after-admission-included.json",
);
const PROOF_003 = loadFixture(
  "recall-proofs/proof-003-rejected-excluded.json",
);
const PROOF_004 = loadFixture(
  "recall-proofs/proof-004-supersession-corrected.json",
);

// Deep-clone helper so a mutated fixture in one test cannot bleed into
// another. Fixtures are plain JSON, so structuredClone is safe.
function clone<T>(o: T): T {
  return structuredClone(o);
}

// Collect every string emitted in a reducer output object (recursively).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

// =========================================================================
// 0. fixture sanity — non-vacuous: the fixtures carry the sentinels and
//    payloads we later assert never leak.
// =========================================================================

describe("Phase 44A · fixture sanity (non-vacuous)", () => {
  test("candidate fixtures carry a private body + source sentinel", () => {
    const raw = readFileSync(
      resolve(FIXTURE_DIR, "candidates/cand-001-accepted-pending.json"),
      "utf8",
    );
    expect(raw).toContain("CANDIDATE_PRIVATE_SENTINEL_001");
    expect(raw).toContain("SOURCE_SENTINEL_001");
  });

  test("admitted fixtures carry a private body sentinel", () => {
    const raw = readFileSync(
      resolve(FIXTURE_DIR, "admitted/assn-001-active.json"),
      "utf8",
    );
    expect(raw).toContain("ADMITTED_PRIVATE_SENTINEL_001");
  });

  test("scanForUnsafeProjection detects each private sentinel", () => {
    for (const sentinel of ADMISSION_PRIVATE_BODY_SENTINELS) {
      expect(scanForUnsafeProjection(sentinel)).toBe("private_body_sentinel");
      expect(scanForUnsafeProjection({ a: { b: [sentinel] } })).toBe(
        "private_body_sentinel",
      );
      // also as a key
      const obj: Record<string, unknown> = {};
      obj[sentinel] = "clean";
      expect(scanForUnsafeProjection(obj)).toBe("private_body_sentinel");
    }
    expect(scanForUnsafeProjection({ ok: "fine" })).toBeNull();
    expect(scanForUnsafeProjection(42)).toBeNull();
    expect(scanForUnsafeProjection(null)).toBeNull();
  });
});

// =========================================================================
// 1. pending candidate is not admitted and not recall-eligible
// =========================================================================

describe("Phase 44A · 1. candidate classification", () => {
  test("a pending candidate is classified candidate / not admitted / not recall-eligible", () => {
    const r = classifyAdmissionCandidate(CAND_001);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kind).toBe("candidate");
    expect(r.candidateId).toBe("cand-001");
    expect(r.admitted).toBe(false);
    expect(r.recallEligible).toBe(false);
    expect(r.ordinaryRecallMaterial).toBe(false);
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
    );
  });

  test("the correction candidate carries its proposed supersedes link", () => {
    const r = classifyAdmissionCandidate(CAND_011);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposedSupersedesAssertionId).toBe("assn-010");
  });

  test("classification carries no candidate body / source material", () => {
    const r = classifyAdmissionCandidate(CAND_001);
    expect(r.ok).toBe(true);
    const strings = collectStrings(r);
    for (const s of strings) {
      expect(s).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
      expect(s).not.toContain("SOURCE_SENTINEL");
      expect(s).not.toContain("body_private");
    }
    expect(scanForUnsafeProjection(r)).toBeNull();
  });
});

// =========================================================================
// 2. before-admission recall excludes candidate; renders no payload
// =========================================================================

describe("Phase 44A · 2. before-admission recall", () => {
  test("before-admission recall is excluded with candidate_not_admitted", () => {
    const r = projectAdmissionRecallProof({
      recallProof: PROOF_001,
      candidateId: "cand-001",
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.recallResult !== "excluded") return;
    expect(r.recallResult).toBe("excluded");
    expect(r.recallEligible).toBe(false);
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
    );
    expect(r.includedAssertionIds).toEqual([]);
    expect(r.renderedCandidatePayload).toBe(false);
    expect(r.excludedCandidateIds).toContain("cand-001");
  });

  test("the before-admission scenario reducer holds the invariant", () => {
    const proof = reduceAdmissionFixtureScenario({
      kind: "before_admission",
      candidate: CAND_001,
      recallProof: PROOF_001,
    });
    expect(proof.ok).toBe(true);
    if (!proof.ok) return;
    expect(proof.scenario).toBe("before_admission");
    expect(proof.recall.recallResult).toBe("excluded");
    expect(proof.invariantsHeld).toContain(
      "candidate_not_recallable_before_admission",
    );
  });
});

// =========================================================================
// 3 + 4. accepted transition mints exactly the admitted assertion, which
//        references its source candidate and transition.
// =========================================================================

describe("Phase 44A · 3+4. accepted transition", () => {
  test("accept mints exactly the admitted assertion assn-001", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision).toBe("accepted");
    expect(r.admittedAssertion).not.toBeNull();
    expect(r.admittedAssertion?.assertionId).toBe("assn-001");
    expect(r.admittedAssertion?.admitted).toBe(true);
    expect(r.admittedAssertion?.recallEligible).toBe(true);
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
    );
  });

  test("the admitted assertion references source candidate + transition under audit", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(true);
    if (!r.ok || !r.admittedAssertion) return;
    expect(r.admittedAssertion.audit.sourceCandidateId).toBe("cand-001");
    expect(r.admittedAssertion.audit.admissionTransitionId).toBe("trans-001");
    expect(r.admittedAssertion.audit.admissionReceiptRef).toBe("rcpt-001");
  });

  test("admitted assertion projection leaks no private body", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(true);
    expect(scanForUnsafeProjection(r)).toBeNull();
    for (const s of collectStrings(r)) {
      expect(s).not.toContain("ADMITTED_PRIVATE_SENTINEL");
      expect(s).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    }
  });
});

// =========================================================================
// 5. after-admission recall includes the admitted assertion only
// =========================================================================

describe("Phase 44A · 5. after-admission recall", () => {
  test("after-admission recall includes only assn-001, served", () => {
    const r = projectAdmissionRecallProof({
      recallProof: PROOF_002,
      candidateId: "cand-001",
      admittedAssertionId: "assn-001",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recallResult).toBe("included");
    expect(r.recallEligible).toBe(true);
    expect(r.includedAssertionIds).toEqual(["assn-001"]);
    expect(r.includedAssertionIds).not.toContain("cand-001");
    expect(r.renderedCandidatePayload).toBe(false);
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
    );
  });

  test("the source candidate is preserved under audit only, not as recall material", () => {
    const r = projectAdmissionRecallProof({
      recallProof: PROOF_002,
      admittedAssertionId: "assn-001",
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.recallResult !== "included") return;
    expect(r.audit.sourceCandidateId).toBe("cand-001");
    expect(r.audit.admissionReceiptRef).toBe("rcpt-001");
    // candidate appears under audit, never in the recall material.
    expect(r.includedAssertionIds).not.toContain("cand-001");
  });

  test("the full accepted scenario reducer holds the invariant", () => {
    const proof = reduceAdmissionFixtureScenario({
      kind: "accepted",
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
      recallProof: PROOF_002,
    });
    expect(proof.ok).toBe(true);
    if (!proof.ok) return;
    expect(proof.scenario).toBe("accepted");
    expect(proof.transition?.admittedAssertion?.assertionId).toBe("assn-001");
    expect(proof.recall.recallResult).toBe("included");
    expect(proof.invariantsHeld).toContain(
      "admitted_assertion_references_candidate_and_transition",
    );
  });
});

// =========================================================================
// 6. rejected candidate mints no assertion and stays excluded
// =========================================================================

describe("Phase 44A · 6. rejection path", () => {
  test("reject mints no admitted assertion", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_002,
      transition: TRANS_002,
      admittedAssertion: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision).toBe("rejected");
    expect(r.admittedAssertion).toBeNull();
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
    );
  });

  test("rejected recall stays excluded with candidate_rejected", () => {
    const r = projectAdmissionRecallProof({
      recallProof: PROOF_003,
      candidateId: "cand-002",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recallResult).toBe("excluded");
    expect(r.includedAssertionIds).toEqual([]);
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
    );
  });

  test("the full rejected scenario reducer holds the invariant", () => {
    const proof = reduceAdmissionFixtureScenario({
      kind: "rejected",
      candidate: CAND_002,
      transition: TRANS_002,
      recallProof: PROOF_003,
    });
    expect(proof.ok).toBe(true);
    if (!proof.ok) return;
    expect(proof.scenario).toBe("rejected");
    expect(proof.transition?.admittedAssertion).toBeNull();
    expect(proof.invariantsHeld).toContain("rejected_never_recallable");
  });
});

// =========================================================================
// 7 + 8. supersession includes corrected active only; superseded prior is
//        audit/provenance, not ordinary recall.
// =========================================================================

describe("Phase 44A · 7+8. supersession / correction", () => {
  test("supersede transition mints the corrected active assertion assn-011", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_011,
      transition: TRANS_011,
      admittedAssertion: ASSN_011,
      supersededAssertion: ASSN_010,
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.decision !== "accepted") return;
    expect(r.decision).toBe("accepted");
    expect(r.admittedAssertion?.assertionId).toBe("assn-011");
    expect(r.supersededAssertionId).toBe("assn-010");
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion,
    );
    expect(r.admittedAssertion?.audit.supersedesAssertionId).toBe("assn-010");
  });

  test("supersession recall includes only corrected active assn-011, excludes prior assn-010", () => {
    const r = projectAdmissionRecallProof({
      recallProof: PROOF_004,
      candidateId: "cand-011",
      admittedAssertionId: "assn-011",
      supersededAssertionId: "assn-010",
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.recallResult !== "included") return;
    expect(r.includedAssertionIds).toEqual(["assn-011"]);
    expect(r.includedAssertionIds).not.toContain("assn-010");
    expect(r.excludedAssertionIds).toContain("assn-010");
    expect(r.renderedPriorState).toBe(false);
    expect(r.supersededReasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.superseded_not_ordinary_recallable,
    );
    // the supersedes link is preserved for audit reconstruction.
    expect(r.audit.supersedesAssertionId).toBe("assn-010");
  });

  test("the full supersession scenario reducer holds the invariant", () => {
    const proof = reduceAdmissionFixtureScenario({
      kind: "supersession",
      correctionCandidate: CAND_011,
      supersedeTransition: TRANS_011,
      correctedAssertion: ASSN_011,
      supersededAssertion: ASSN_010,
      recallProof: PROOF_004,
    });
    expect(proof.ok).toBe(true);
    if (!proof.ok) return;
    expect(proof.scenario).toBe("supersession");
    expect(proof.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion,
    );
    expect(proof.invariantsHeld).toContain(
      "superseded_prior_excluded_from_ordinary_recall",
    );
    expect(proof.invariantsHeld).toContain(
      "supersedes_link_preserved_for_audit",
    );
  });

  test("the superseded prior, on its own, never surfaces as active recall material", () => {
    // assn-010 is superseded/ineligible; if a recall proof tried to serve it
    // as active, the reducer must fail closed. Synthesize that violation.
    const leakyProof = {
      ...(clone(PROOF_004) as Record<string, unknown>),
      included_assertion_ids: ["assn-010"],
    };
    const r = projectAdmissionRecallProof({
      recallProof: leakyProof,
      admittedAssertionId: "assn-011",
      supersededAssertionId: "assn-010",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
    );
  });
});

// =========================================================================
// 9. mismatched candidate / transition fails closed
// =========================================================================

describe("Phase 44A · 9. mismatched candidate/transition fails closed", () => {
  test("a transition pointing at a different candidate is refused", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001, // cand-001
      transition: TRANS_010, // references cand-010
      admittedAssertion: ASSN_010,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_transition,
    );
  });

  test("a transition minting a different assertion id than the supplied admitted packet is refused", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001, // mints assn-001
      admittedAssertion: ASSN_010, // is assn-010
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
    );
  });

  test("an admitted assertion whose source_candidate_id mismatches the candidate is refused", () => {
    // craft a transition that mints assn-001 but for the wrong candidate's
    // assertion provenance: feed cand-001 + trans-001 but an assertion whose
    // source_candidate_id was tampered.
    const tampered = clone(ASSN_001) as Record<string, unknown>;
    tampered.source_candidate_id = "cand-999";
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: tampered,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_assertion,
    );
  });
});

// =========================================================================
// 10. accepted transition without an admitted assertion fails closed
// =========================================================================

describe("Phase 44A · 10. accept without admitted assertion fails closed", () => {
  test("an accept transition with no admitted assertion supplied is refused", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      // admittedAssertion omitted
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.accepted_transition_missing_assertion,
    );
  });

  test("an accept transition whose admitted_assertion_id is null is refused", () => {
    const tampered = clone(TRANS_001) as Record<string, unknown>;
    tampered.admitted_assertion_id = null;
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: tampered,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.accepted_transition_missing_assertion,
    );
  });
});

// =========================================================================
// 11. rejected transition that mints an assertion fails closed
// =========================================================================

describe("Phase 44A · 11. reject that mints an assertion fails closed", () => {
  test("a reject transition with a non-null admitted_assertion_id is refused", () => {
    const tampered = clone(TRANS_002) as Record<string, unknown>;
    tampered.admitted_assertion_id = "assn-002";
    const r = applyAdmissionTransition({
      candidate: CAND_002,
      transition: tampered,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.rejected_transition_minted_assertion,
    );
  });

  test("a reject transition with an admitted assertion supplied is refused", () => {
    const r = applyAdmissionTransition({
      candidate: CAND_002,
      transition: TRANS_002,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.rejected_transition_minted_assertion,
    );
  });
});

// =========================================================================
// 12. candidate marked recall-eligible before admission fails closed
// =========================================================================

describe("Phase 44A · 12. candidate recall-eligible before admission fails closed", () => {
  test("a candidate claiming recall_eligibility=eligible is refused", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.recall_eligibility = "eligible";
    const r = classifyAdmissionCandidate(tampered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_recall_eligible_before_admission,
    );
  });

  test("a candidate whose admission_state is already admitted is refused", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.admission_state = "admitted";
    const r = classifyAdmissionCandidate(tampered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // recall_eligibility is still ineligible, so this trips the state check.
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    );
  });
});

// =========================================================================
// 13. private sentinel in ordinary recall projection fails closed
// =========================================================================

describe("Phase 44A · 13. private sentinel in ordinary recall fails closed", () => {
  test("a recall proof leaking a private sentinel in public_recall_output is refused", () => {
    const leaky = clone(PROOF_002) as Record<string, unknown>;
    (leaky.public_recall_output as Record<string, unknown>).public_summary =
      "leaked ADMITTED_PRIVATE_SENTINEL_001 body";
    const r = projectAdmissionRecallProof({
      recallProof: leaky,
      admittedAssertionId: "assn-001",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
    );
  });

  test("a recall proof that renders the candidate payload is refused", () => {
    const leaky = clone(PROOF_001) as Record<string, unknown>;
    (leaky.public_recall_output as Record<string, unknown>).rendered_candidate_payload =
      true;
    const r = projectAdmissionRecallProof({
      recallProof: leaky,
      candidateId: "cand-001",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsafe_candidate_payload_projection,
    );
  });

  test("a recall proof treating the candidate as ordinary recall material is refused", () => {
    const leaky = clone(PROOF_002) as Record<string, unknown>;
    leaky.included_assertion_ids = ["cand-001"];
    const r = projectAdmissionRecallProof({
      recallProof: leaky,
      candidateId: "cand-001",
      admittedAssertionId: "assn-001",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_included_in_ordinary_recall,
    );
  });
});

// =========================================================================
// 14. unknown / malformed fixture kind/version fails closed
// =========================================================================

describe("Phase 44A · 14. unknown/malformed fixture fails closed", () => {
  test("non-object input is refused", () => {
    for (const bad of [null, undefined, 42, "string", []]) {
      const r = classifyAdmissionCandidate(bad);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.reasonCode).toBe(
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      );
    }
  });

  test("a candidate with the wrong fixture_kind is refused", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.fixture_kind = "admitted_memory_packet";
    const r = classifyAdmissionCandidate(tampered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    );
  });

  test("an unknown fixture_version is refused", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.fixture_version = "phase-99z.0";
    const r = classifyAdmissionCandidate(tampered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    );
  });

  test("a recall proof with the wrong fixture_kind is refused", () => {
    const tampered = clone(PROOF_001) as Record<string, unknown>;
    tampered.fixture_kind = "candidate_memory_packet";
    const r = projectAdmissionRecallProof({ recallProof: tampered });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    );
  });

  test("a transition with an unknown admission_decision is refused", () => {
    const tampered = clone(TRANS_001) as Record<string, unknown>;
    tampered.admission_decision = "maybe";
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: tampered,
      admittedAssertion: ASSN_001,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
    );
  });
});

// =========================================================================
// 15. reducer output never contains raw candidate/private payload in any
//     safe projection field (full graph sweep).
// =========================================================================

describe("Phase 44A · 15. no raw candidate/private payload in safe output", () => {
  const SCENARIOS = [
    reduceAdmissionFixtureScenario({
      kind: "before_admission",
      candidate: CAND_001,
      recallProof: PROOF_001,
    }),
    reduceAdmissionFixtureScenario({
      kind: "accepted",
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
      recallProof: PROOF_002,
    }),
    reduceAdmissionFixtureScenario({
      kind: "rejected",
      candidate: CAND_002,
      transition: TRANS_002,
      recallProof: PROOF_003,
    }),
    reduceAdmissionFixtureScenario({
      kind: "supersession",
      correctionCandidate: CAND_011,
      supersedeTransition: TRANS_011,
      correctedAssertion: ASSN_011,
      supersededAssertion: ASSN_010,
      recallProof: PROOF_004,
    }),
  ];

  test("every scenario succeeds", () => {
    for (const s of SCENARIOS) {
      expect(s.ok).toBe(true);
    }
  });

  test("no scenario output contains a private body sentinel", () => {
    for (const s of SCENARIOS) {
      expect(scanForUnsafeProjection(s)).toBeNull();
      for (const str of collectStrings(s)) {
        for (const sentinel of ADMISSION_PRIVATE_BODY_SENTINELS) {
          expect(str).not.toContain(sentinel);
        }
      }
    }
  });

  test("no scenario output contains body_private / source_material text", () => {
    for (const s of SCENARIOS) {
      for (const str of collectStrings(s)) {
        // the literal candidate/admitted body strings carry the word "body"
        // plus the sentinel; we already check sentinels. Belt-and-suspenders:
        // the raw 'body held for review' phrasing must not appear.
        expect(str).not.toContain("held for review");
        expect(str).not.toContain("never rendered");
      }
    }
  });

  test("the sealing gate replaces a contaminated success with a fail-closed result", () => {
    // Feed a recall proof whose ordinary-recall material is clean but whose
    // public_summary on the included path carries a long-id run (a banned
    // category). The seal must catch it.
    const leaky = clone(PROOF_002) as Record<string, unknown>;
    (leaky.public_recall_output as Record<string, unknown>).public_summary =
      "12345678901234567890";
    const r = projectAdmissionRecallProof({
      recallProof: leaky,
      admittedAssertionId: "assn-001",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
    );
  });
});

// =========================================================================
// 16. static guards — the reducer is fixture-bound and reaches nothing live.
// =========================================================================

describe("Phase 44A · static source guards", () => {
  const reducerSource = readFileSync(
    resolve(__dirname, "admission-wedge-fixture-reducer.ts"),
    "utf8",
  );

  test("reducer imports nothing at all (dependency-free)", () => {
    expect(reducerSource).not.toMatch(/^\s*import\s/m);
  });

  test("reducer contains no network / fs / process primitives", () => {
    expect(reducerSource).not.toMatch(/\bfetch\s*\(/);
    expect(reducerSource).not.toMatch(/globalThis\.fetch/);
    expect(reducerSource).not.toMatch(/from\s+["']node:fs["']/);
    expect(reducerSource).not.toMatch(/from\s+["']node:http["']/);
    expect(reducerSource).not.toMatch(/readFileSync/);
    expect(reducerSource).not.toMatch(/process\.env/);
    expect(reducerSource).not.toMatch(/Date\.now/);
  });

  test("reducer imports no Discord / Dixie / Straylight / LLM dependency", () => {
    expect(reducerSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(reducerSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(reducerSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(reducerSource).not.toMatch(/live-dixie-client/);
    expect(reducerSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
  });

  test("reducer makes no live-admission / production claim", () => {
    const lc = reducerSource.toLowerCase();
    // these phrases appear only inside negated disclaimers in the header.
    for (const phrase of [
      "production admission",
      "live admission route",
      "production storage",
    ]) {
      // every occurrence must be preceded on its line by a negation token.
      const lines = lc.split("\n").filter((l) => l.includes(phrase));
      for (const line of lines) {
        expect(/\b(no|not|never|nothing|reaches no)\b/.test(line)).toBe(true);
      }
    }
  });
});

// =========================================================================
// 17. fail-closed detail sealing — a fail-closed `detail` NEVER echoes a raw
//     input value (private sentinel, long id, secret, url, raw payload).
//     Codex VERDICT: PATCH. Several fail branches historically interpolated
//     raw input into `detail`; these tests pin the value-free behavior and
//     are non-vacuous (the malformed inputs DO carry the banned material).
// =========================================================================

describe("Phase 44A · 17. fail-closed detail never echoes raw input", () => {
  // a 20-digit operational-style id — matches the reducer's long-id-run gate
  // (\d{17,}). Used as a "must not leak" probe.
  const LONG_ID_20 = "12345678901234567890";
  // a private-body sentinel suffix variant — `classifyUnsafeString` matches
  // on the prefix, so this trips the private_body_sentinel category.
  const SENTINEL_X = "CANDIDATE_PRIVATE_SENTINEL_X";

  // Serialize the ENTIRE reducer output (not just top-level fields) so a leak
  // buried in any nested field/key is caught.
  function serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  // Assert a fail-closed output is well-formed, keeps a stable reason code,
  // carries a non-empty string detail, and leaks nothing unsafe anywhere in
  // its full serialized form.
  function expectSealedFail(
    r: { ok: boolean; reasonCode?: unknown; detail?: unknown },
    expectedReason: string,
  ): void {
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasonCode).toBe(expectedReason);
    expect(typeof r.detail).toBe("string");
    expect((r.detail as string).length).toBeGreaterThan(0);
    // full-output scan + recursive sentinel/long-id sweep.
    expect(scanForUnsafeProjection(r)).toBeNull();
  }

  // -- 1. sentinel in a malformed candidate fails closed, never echoed -----

  test("malformed candidate carrying a private sentinel fails closed without echoing it", () => {
    // inject the sentinel into candidate_id and trip the eligible-before-
    // admission gate (old code interpolated candidate_id into detail).
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.candidate_id = SENTINEL_X;
    tampered.recall_eligibility = "eligible";

    // non-vacuous: the input genuinely carries the banned material.
    expect(serialize(tampered)).toContain("CANDIDATE_PRIVATE_SENTINEL");

    const r = classifyAdmissionCandidate(tampered);
    expectSealedFail(
      r,
      ADMISSION_REDUCER_REASON_CODES.candidate_recall_eligible_before_admission,
    );
    // full serialized output — not just top-level fields — is sentinel-free.
    expect(serialize(r)).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    expect(serialize(r)).not.toContain(SENTINEL_X);
  });

  test("sentinel in candidate fixture_kind / fixture_version is not echoed", () => {
    for (const field of ["fixture_kind", "fixture_version"]) {
      const tampered = clone(CAND_001) as Record<string, unknown>;
      tampered[field] = SENTINEL_X;
      expect(serialize(tampered)).toContain(SENTINEL_X);
      const r = classifyAdmissionCandidate(tampered);
      expectSealedFail(
        r,
        ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      );
      expect(serialize(r)).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    }
  });

  // -- 2. long id in malformed input fails closed, never echoed ------------

  test("malformed candidate carrying a 20-digit id fails closed without echoing it", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.candidate_id = LONG_ID_20;
    tampered.recall_eligibility = "eligible";

    // non-vacuous: the input genuinely carries the long id.
    expect(serialize(tampered)).toContain(LONG_ID_20);

    const r = classifyAdmissionCandidate(tampered);
    expectSealedFail(
      r,
      ADMISSION_REDUCER_REASON_CODES.candidate_recall_eligible_before_admission,
    );
    // full serialized output is long-id-free.
    expect(serialize(r)).not.toContain(LONG_ID_20);
  });

  test("long id in a wrong-shaped candidate (bad admission_state) is not echoed", () => {
    const tampered = clone(CAND_001) as Record<string, unknown>;
    tampered.candidate_id = LONG_ID_20;
    tampered.admission_state = "admitted"; // trips the state gate
    const r = classifyAdmissionCandidate(tampered);
    expectSealedFail(r, ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape);
    expect(serialize(r)).not.toContain(LONG_ID_20);
  });

  // -- 3. mismatched ids fail closed with stable codes, no raw ids ---------

  // NB: short, seal-clean ids are used here on purpose. A LONG-id candidate
  // is refused by the projection seal (unsafe_private_sentinel_projection)
  // before the mismatch branch is ever reached — itself a safe outcome, but
  // it would not exercise the mismatch detail strings. These distinctive
  // short ids reach the actual mismatch branches; the old code interpolated
  // them verbatim into `detail`, the patched code must not.
  test("mismatched candidate/transition ids fail closed with no raw ids in detail", () => {
    const cand = clone(CAND_001) as Record<string, unknown>;
    cand.candidate_id = "cand-src-xyz";
    const trans = clone(TRANS_001) as Record<string, unknown>;
    trans.candidate_id = "cand-other-xyz"; // mismatched
    trans.transition_id = "trans-tid-xyz";

    const r = applyAdmissionTransition({
      candidate: cand,
      transition: trans,
      admittedAssertion: ASSN_001,
    });
    expectSealedFail(
      r,
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_transition,
    );
    const out = serialize(r);
    expect(out).not.toContain("cand-src-xyz");
    expect(out).not.toContain("cand-other-xyz");
    expect(out).not.toContain("trans-tid-xyz");
  });

  test("mismatched transition->assertion id fails closed with no raw ids in detail", () => {
    // accept transition mints assn-001 but the supplied admitted packet is a
    // different assertion — old code echoed both ids into detail.
    const assn = clone(ASSN_001) as Record<string, unknown>;
    assn.assertion_id = "assn-weird-xyz";
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001, // mints assn-001
      admittedAssertion: assn,
    });
    expectSealedFail(
      r,
      ADMISSION_REDUCER_REASON_CODES.mismatched_transition_assertion,
    );
    expect(serialize(r)).not.toContain("assn-weird-xyz");
  });

  test("mismatched candidate->assertion provenance fails closed with no raw ids in detail", () => {
    const assn = clone(ASSN_001) as Record<string, unknown>;
    assn.source_candidate_id = "cand-wrong-xyz"; // mismatched provenance
    const r = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: assn,
    });
    expectSealedFail(
      r,
      ADMISSION_REDUCER_REASON_CODES.mismatched_candidate_assertion,
    );
    expect(serialize(r)).not.toContain("cand-wrong-xyz");
  });

  // -- 4. private-sentinel leakage, full serialized output -----------------

  test("no malformed-input fail-closed output leaks a private sentinel (full serialized sweep)", () => {
    // a battery of malformed inputs across all three reducers, each carrying a
    // sentinel in a field the OLD code would have interpolated into detail.
    const fails: Array<{ ok: boolean }> = [];

    {
      const c = clone(CAND_001) as Record<string, unknown>;
      c.fixture_kind = "ADMITTED_PRIVATE_SENTINEL_777";
      fails.push(classifyAdmissionCandidate(c));
    }
    {
      const t = clone(TRANS_001) as Record<string, unknown>;
      t.fixture_kind = "SOURCE_SENTINEL_777";
      fails.push(
        applyAdmissionTransition({
          candidate: CAND_001,
          transition: t,
          admittedAssertion: ASSN_001,
        }),
      );
    }
    {
      const t = clone(TRANS_001) as Record<string, unknown>;
      t.admission_decision = "SUPERSEDED_PRIVATE_SENTINEL_777";
      fails.push(
        applyAdmissionTransition({
          candidate: CAND_001,
          transition: t,
          admittedAssertion: ASSN_001,
        }),
      );
    }
    {
      const p = clone(PROOF_001) as Record<string, unknown>;
      p.fixture_kind = "CANDIDATE_PRIVATE_SENTINEL_777";
      fails.push(projectAdmissionRecallProof({ recallProof: p }));
    }

    for (const r of fails) {
      expect(r.ok).toBe(false);
      // full serialized output carries NONE of the private sentinels.
      const out = serialize(r);
      for (const sentinel of ADMISSION_PRIVATE_BODY_SENTINELS) {
        expect(out).not.toContain(sentinel);
      }
      expect(scanForUnsafeProjection(r)).toBeNull();
    }
  });

  // -- 5. long-id leakage, full serialized output --------------------------

  test("no malformed-input fail-closed output leaks a long id (full serialized sweep)", () => {
    const probes: Array<{ id: string; out: string }> = [];

    {
      const id = "11111111111111111111";
      const t = clone(TRANS_001) as Record<string, unknown>;
      t.transition_id = id;
      t.admission_decision = "maybe"; // unknown decision -> fail
      const r = applyAdmissionTransition({
        candidate: CAND_001,
        transition: t,
        admittedAssertion: ASSN_001,
      });
      expect(r.ok).toBe(false);
      probes.push({ id, out: serialize(r) });
    }
    {
      const id = "22222222222222222222";
      const p = clone(PROOF_002) as Record<string, unknown>;
      p.proof_id = id;
      p.recall_result = "weird"; // unknown result -> fail
      const r = projectAdmissionRecallProof({ recallProof: p });
      expect(r.ok).toBe(false);
      probes.push({ id, out: serialize(r) });
    }
    {
      const id = "33333333333333333333";
      const a = clone(ASSN_001) as Record<string, unknown>;
      a.assertion_id = id; // != the minted assn-001 -> mismatch fail
      const r = applyAdmissionTransition({
        candidate: CAND_001,
        transition: TRANS_001,
        admittedAssertion: a,
      });
      expect(r.ok).toBe(false);
      probes.push({ id, out: serialize(r) });
    }

    for (const { id, out } of probes) {
      expect(out).not.toContain(id);
    }
  });

  // -- 6. success-path outputs remain unchanged / equivalent ---------------

  test("success-path outputs are unchanged and carry no detail field", () => {
    const candidate = classifyAdmissionCandidate(CAND_001);
    expect(candidate.ok).toBe(true);
    if (!candidate.ok) return;
    expect(candidate.candidateId).toBe("cand-001");
    expect(candidate.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
    );
    // a success output never carries a fail-closed `detail` field.
    expect("detail" in candidate).toBe(false);

    const transition = applyAdmissionTransition({
      candidate: CAND_001,
      transition: TRANS_001,
      admittedAssertion: ASSN_001,
    });
    expect(transition.ok).toBe(true);
    if (!transition.ok || transition.decision !== "accepted") return;
    expect(transition.admittedAssertion.assertionId).toBe("assn-001");
    expect(transition.admittedAssertion.audit.sourceCandidateId).toBe(
      "cand-001",
    );
    expect(transition.admittedAssertion.audit.admissionTransitionId).toBe(
      "trans-001",
    );
    expect(transition.admittedAssertion.publicSummary).toBe(
      "operator participates in the admission-wedge fixture proof",
    );
    expect("detail" in transition).toBe(false);

    const recall = projectAdmissionRecallProof({
      recallProof: PROOF_002,
      candidateId: "cand-001",
      admittedAssertionId: "assn-001",
    });
    expect(recall.ok).toBe(true);
    if (!recall.ok || recall.recallResult !== "included") return;
    expect(recall.includedAssertionIds).toEqual(["assn-001"]);
    expect(recall.publicSummary).toBe(
      "operator participates in the admission-wedge fixture proof",
    );
    expect("detail" in recall).toBe(false);
  });

  // -- the backstop helper itself (defense-in-depth) -----------------------

  test("safeDetail seals every detail by reason code, including short raw ids", () => {
    const code = ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape;
    const sealed = safeDetailForReason(code);
    // sentinel
    const a = safeDetail(code, "leak CANDIDATE_PRIVATE_SENTINEL_001 here");
    expect(a).toBe(sealed);
    expect(a).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    expect(a).toContain(code); // stable reason code preserved
    // long id
    const b = safeDetail(code, "id 12345678901234567890 leaked");
    expect(b).toBe(sealed);
    expect(b).not.toContain("12345678901234567890");
    // url
    const c = safeDetail(code, "see https://evil.example/secret");
    expect(c).toBe(sealed);
    expect(c).not.toContain("https://");
    // short ids are raw fixture values even though they are not caught by the
    // long-id/sentinel/url scan.
    const shortId = safeDetail(code, "candidate cand-001 leaked");
    expect(shortId).toBe(sealed);
    expect(shortId).not.toContain("cand-001");
    // a clean detail is still sealed to the stable reason-code detail.
    const clean = "candidate: unknown fixture_kind";
    expect(safeDetail(code, clean)).toBe(sealed);

    const unsafeReason = safeDetail(
      "CANDIDATE_PRIVATE_SENTINEL_X" as typeof code,
      "irrelevant",
    );
    expect(unsafeReason).toBe(sealed);
    expect(unsafeReason).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
  });
});
