// Phase 45F · Admission Wedge — Dixie probe no-op adapter / validator regression
// gate.
//
// Authority: docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md (Phase 45E
// §6 / §10 / §11), over the locally MIRRORED Dixie Phase 33C draft v0 probes
// (docs/admission-wedge/dixie-probes/), the Phase 44A reducer, and the Phase
// 44C runner.
//
// These tests prove:
//   1. all five Dixie probes map to the expected local proof scenarios;
//   2. each mapping is semantically equivalent to the CURRENT local proof stack
//      — cross-checked against the Phase 44A reducer's output over the existing
//      Phase 43C fixtures (the same scenario plans the Phase 44C runner uses),
//      not a reimplementation;
//   3. the adapter results + formatted summaries leak nothing
//      (raw payload / unsafe marker / private sentinel / raw fixture body /
//      source material / stack trace / urls / jwt / pem / Bearer / sk- / long
//      ids / 0x hex / audit-only keys / operational ids);
//   4. synthetic malformed input (with unsafe strings + long ids) fails closed
//      with a stable reason and no echo of the raw input;
//   5. the adapter is wired into no runtime path and is not exported from the
//      package surface;
//   6. the adapter itself reads no file / network / env / clock and imports only
//      the pure Phase 44A reducer.
//
// The adapter is a pure mapping layer: this test reads the mirrored probe JSON
// from disk with node:fs and passes the parsed objects in. The adapter never
// reads a file.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMISSION_REDUCER_REASON_CODES,
  reduceAdmissionFixtureScenario,
  scanForUnsafeProjection,
  type AdmissionReducerReasonCode,
} from "./admission-wedge-fixture-reducer.ts";
import {
  DIXIE_PROBE_ADAPTER_REASON_CODES,
  DIXIE_PROBE_SCENARIO_IDS,
  DIXIE_TO_LOCAL_SCENARIO,
  LOCAL_ADMISSION_SCENARIOS,
  SUPPORTED_DIXIE_PROBE_VERSION,
  mapDixieProbe,
  mapDixieProbes,
  safeDixieProbeDetail,
  type DixieProbeAlignment,
  type DixieProbeAlignmentOk,
} from "./admission-wedge-dixie-probe-adapter.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBES_DIR = resolve(
  __dirname,
  "../../../../docs/admission-wedge/dixie-probes",
);
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/admission-wedge/fixtures",
);
function loadFixture(relPath: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, relPath), "utf8"));
}

// scenario_id -> mirrored probe filename.
const PROBE_FILES: Record<string, string> = {
  candidate_pending_not_recallable: "candidate-pending-not-recallable.json",
  accept_candidate_to_admitted_assertion:
    "accept-candidate-to-admitted-assertion.json",
  reject_candidate_no_assertion: "reject-candidate-no-assertion.json",
  supersede_with_corrected_assertion: "supersede-with-corrected-assertion.json",
  malformed_or_unsafe_payload_fail_closed:
    "malformed-or-unsafe-payload-fail-closed.json",
};

function loadProbeRaw(scenarioId: string): string {
  return readFileSync(resolve(PROBES_DIR, PROBE_FILES[scenarioId]), "utf8");
}
function loadProbe(scenarioId: string): unknown {
  return JSON.parse(loadProbeRaw(scenarioId));
}

// Every string emitted anywhere in a value (recursively).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

// A flat "formatted summary" of an alignment result, the kind a human / future
// runner would print. Built in the TEST (the adapter stays a pure mapping
// layer). Scanned for leaks alongside the serialized result.
function formatAlignment(a: DixieProbeAlignment): string {
  const lines: string[] = [`alignmentStatus: ${a.alignmentStatus}`];
  if (a.ok) {
    lines.push(
      `dixieScenario: ${a.dixieScenario}`,
      `localScenario: ${a.localScenario}`,
      `dixieProbeVersion: ${a.dixieProbeVersion}`,
      `outcomeClassification: ${a.outcomeClassification}`,
      `localReasonCode: ${a.localReasonCode}`,
      `semanticAssertions:\n${a.semanticAssertions.map((s) => `  - ${s}`).join("\n")}`,
      `notes:\n${a.notes.map((s) => `  - ${s}`).join("\n")}`,
      `publicSafe: ${String(a.publicSafe)}`,
    );
  } else {
    lines.push(
      `reasonCode: ${a.reasonCode}`,
      `detail: ${a.detail}`,
      `publicSafe: ${String(a.publicSafe)}`,
    );
  }
  return lines.join("\n");
}

const LOCAL_REASON_CODE_SET = new Set<string>(
  Object.values(ADMISSION_REDUCER_REASON_CODES),
);

// The CURRENT local proof stack: the existing Phase 44A reducer over the
// existing Phase 43C fixtures, exercised with the SAME scenario plans the Phase
// 44C runner uses. We call the reducer directly (no reimplementation, no runner
// import) and project a small summary the same way the runner does, so the
// adapter's mapping is cross-checked against real local proof output.
interface LocalProofSummary {
  readonly outcome: "excluded" | "included" | "fail_closed";
  readonly reasonCode: AdmissionReducerReasonCode;
  readonly includedAssertionIds: readonly string[];
  readonly excludedIds: readonly string[];
}

// the Phase 44C runner's synthetic in-memory malformed candidate (replicated
// here so the local malformed proof is exercised without importing the runner).
function buildMalformedCandidate(): Record<string, unknown> {
  return {
    fixture_kind: "candidate_memory_packet",
    fixture_version: "phase-43c.0",
    candidate_id: "cand-malformed-99999999999999999999-CANDIDATE_PRIVATE_SENTINEL_DEMO",
    actor_id: "freeside-characters:shared-substrate",
    recall_eligibility: "eligible",
    admission_state: "candidate_pending",
    candidate_payload: { boundary: "public_safe", body_private: "never rendered" },
  };
}

function localProof(name: string): LocalProofSummary {
  let proof;
  switch (name) {
    case "before_admission_excluded":
      proof = reduceAdmissionFixtureScenario({
        kind: "before_admission",
        candidate: loadFixture("candidates/cand-001-accepted-pending.json"),
        recallProof: loadFixture(
          "recall-proofs/proof-001-before-admission-excluded.json",
        ),
      });
      break;
    case "accepted_admitted_included":
      proof = reduceAdmissionFixtureScenario({
        kind: "accepted",
        candidate: loadFixture("candidates/cand-001-accepted-pending.json"),
        transition: loadFixture("transitions/trans-001-accept.json"),
        admittedAssertion: loadFixture("admitted/assn-001-active.json"),
        recallProof: loadFixture(
          "recall-proofs/proof-002-after-admission-included.json",
        ),
      });
      break;
    case "rejected_excluded":
      proof = reduceAdmissionFixtureScenario({
        kind: "rejected",
        candidate: loadFixture("candidates/cand-002-rejected-pending.json"),
        transition: loadFixture("transitions/trans-002-reject.json"),
        recallProof: loadFixture(
          "recall-proofs/proof-003-rejected-excluded.json",
        ),
      });
      break;
    case "supersession_corrected_only":
      proof = reduceAdmissionFixtureScenario({
        kind: "supersession",
        correctionCandidate: loadFixture(
          "candidates/cand-011-correction-pending.json",
        ),
        supersedeTransition: loadFixture("transitions/trans-011-supersede.json"),
        correctedAssertion: loadFixture(
          "admitted/assn-011-active-correction.json",
        ),
        supersededAssertion: loadFixture("admitted/assn-010-superseded.json"),
        recallProof: loadFixture(
          "recall-proofs/proof-004-supersession-corrected.json",
        ),
      });
      break;
    case "malformed_fail_closed":
      proof = reduceAdmissionFixtureScenario({
        kind: "before_admission",
        candidate: buildMalformedCandidate(),
        recallProof: loadFixture(
          "recall-proofs/proof-001-before-admission-excluded.json",
        ),
      });
      break;
    default:
      throw new Error(`unknown local scenario: ${name}`);
  }

  if (!proof.ok) {
    return {
      outcome: "fail_closed",
      reasonCode: proof.reasonCode,
      includedAssertionIds: [],
      excludedIds: [],
    };
  }
  if (proof.recall.recallResult === "excluded") {
    return {
      outcome: "excluded",
      reasonCode: proof.recall.reasonCode,
      includedAssertionIds: [],
      excludedIds: proof.recall.excludedCandidateIds,
    };
  }
  return {
    outcome: "included",
    reasonCode: proof.recall.reasonCode,
    includedAssertionIds: proof.recall.includedAssertionIds,
    excludedIds: proof.recall.excludedAssertionIds,
  };
}

// =========================================================================
// 0. mirror sanity — non-vacuous: the mirrored probes carry the unsafe
//    markers / ids we later prove never leak through the adapter.
// =========================================================================

describe("Phase 45F · 0. mirrored probe sanity (non-vacuous)", () => {
  test("every mirrored probe exists, parses, and is a draft-v0 mirror", () => {
    for (const id of DIXIE_PROBE_SCENARIO_IDS) {
      const probe = loadProbe(id) as Record<string, unknown>;
      expect(probe.probe_version).toBe(SUPPORTED_DIXIE_PROBE_VERSION);
      expect(probe.scenario_id).toBe(id);
      expect(probe.schema_final).toBe(false);
      expect(probe.runtime_enabled).toBe(false);
      expect(probe.production_admission).toBe(false);
      expect(probe.public_safe).toBe(true);
      // the local-mirror marker is present and self-describes as non-canonical,
      // non-runtime, draft.
      const marker = probe._local_mirror as Record<string, unknown>;
      expect(marker).toBeTruthy();
      expect(String(marker.canonical_source)).toContain("loa-dixie Phase 33C");
      expect(marker.creates_freeside_runtime_behavior).toBe(false);
    }
  });

  test("the private sections genuinely carry the material the no-leak tests forbid", () => {
    // Non-vacuous: every mirror genuinely carries the Dixie 'unsafe_marker:'
    // token, demo ids, and audit-only keys in its private input / audit
    // sections — exactly the material the §3 no-leak tests prove never reaches
    // the adapter's output. (The Dixie probes deliberately use 'unsafe_marker:'
    // rather than the Freeside sentinel string, so the reducer's
    // scanForUnsafeProjection — which keys off Freeside sentinels / long ids /
    // urls — does NOT flag them; the no-leak proof here is substring-based.)
    for (const id of DIXIE_PROBE_SCENARIO_IDS) {
      const raw = loadProbeRaw(id);
      expect(raw).toContain("unsafe_marker:");
      expect(raw).toContain("_demo");
      expect(raw).toContain("audit");
      expect(raw).toContain("candidate_payload");
    }
  });
});

// =========================================================================
// 1. all five Dixie probes map to the expected local scenarios
// =========================================================================

describe("Phase 45F · 1. five required probe -> local scenario mappings", () => {
  const REQUIRED: ReadonlyArray<[string, string]> = [
    ["candidate_pending_not_recallable", "before_admission_excluded"],
    ["accept_candidate_to_admitted_assertion", "accepted_admitted_included"],
    ["reject_candidate_no_assertion", "rejected_excluded"],
    ["supersede_with_corrected_assertion", "supersession_corrected_only"],
    ["malformed_or_unsafe_payload_fail_closed", "malformed_fail_closed"],
  ];

  for (const [dixieScenario, localScenario] of REQUIRED) {
    test(`${dixieScenario} -> ${localScenario}`, () => {
      const r = mapDixieProbe(loadProbe(dixieScenario));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.dixieScenario).toBe(dixieScenario as never);
      expect(r.localScenario).toBe(localScenario as never);
      expect(r.alignmentStatus).toBe("aligned_semantics");
      expect(r.dixieProbeVersion).toBe(SUPPORTED_DIXIE_PROBE_VERSION);
      expect(r.publicSafe).toBe(true);
    });
  }

  test("the exported flat mapping table matches the required mappings", () => {
    expect(DIXIE_TO_LOCAL_SCENARIO).toEqual({
      candidate_pending_not_recallable: "before_admission_excluded",
      accept_candidate_to_admitted_assertion: "accepted_admitted_included",
      reject_candidate_no_assertion: "rejected_excluded",
      supersede_with_corrected_assertion: "supersession_corrected_only",
      malformed_or_unsafe_payload_fail_closed: "malformed_fail_closed",
    });
  });

  test("mapDixieProbes batch-maps every mirrored probe", () => {
    const probes = DIXIE_PROBE_SCENARIO_IDS.map((id) => loadProbe(id));
    const results = mapDixieProbes(probes);
    expect(results.length).toBe(5);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(
      results.map((r) => (r.ok ? r.localScenario : "fail")),
    ).toEqual([...LOCAL_ADMISSION_SCENARIOS]);
  });
});

// =========================================================================
// 2. semantic equivalence to the CURRENT local proof stack (the Phase 44A
//    reducer over the existing Phase 43C fixtures, same scenario plans the
//    Phase 44C runner uses) — not a reimplementation.
// =========================================================================

describe("Phase 45F · 2. semantic equivalence to the local proof stack", () => {
  // For every Dixie probe, the adapter's mapped local scenario + outcome must
  // match what the Phase 44A reducer actually produces for that local scenario.
  test("adapter outcomeClassification matches the local reducer outcome per scenario", () => {
    for (const id of DIXIE_PROBE_SCENARIO_IDS) {
      const r = mapDixieProbe(loadProbe(id));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const summary = localProof(r.localScenario);
      expect(r.outcomeClassification).toBe(summary.outcome);
    }
  });

  // For the four non-malformed scenarios the local reducer reason code is exact
  // and stable, so the adapter's localReasonCode must equal the reducer's.
  test("adapter localReasonCode matches the local reducer reason code (non-malformed)", () => {
    const exact: ReadonlyArray<[string, string]> = [
      ["candidate_pending_not_recallable", "before_admission_excluded"],
      ["accept_candidate_to_admitted_assertion", "accepted_admitted_included"],
      ["reject_candidate_no_assertion", "rejected_excluded"],
      ["supersede_with_corrected_assertion", "supersession_corrected_only"],
    ];
    for (const [dixieScenario, localScenario] of exact) {
      const r = mapDixieProbe(loadProbe(dixieScenario)) as DixieProbeAlignmentOk;
      expect(r.ok).toBe(true);
      const summary = localProof(localScenario);
      expect(r.localReasonCode).toBe(summary.reasonCode);
    }
  });

  // The malformed local fail-closed family has several stable codes; the local
  // synthetic input trips candidate_recall_eligible_before_admission, while the
  // adapter cites unsupported_fixture_shape as the representative family member.
  // Both must be VALID local reducer codes and both must classify fail_closed.
  test("malformed maps to a valid local fail-closed reducer code (family member)", () => {
    const r = mapDixieProbe(
      loadProbe("malformed_or_unsafe_payload_fail_closed"),
    ) as DixieProbeAlignmentOk;
    expect(r.ok).toBe(true);
    expect(r.outcomeClassification).toBe("fail_closed");
    expect(LOCAL_REASON_CODE_SET.has(r.localReasonCode)).toBe(true);
    const summary = localProof("malformed_fail_closed");
    expect(summary.outcome).toBe("fail_closed");
    expect(LOCAL_REASON_CODE_SET.has(summary.reasonCode)).toBe(true);
  });

  // The aligned local meaning, asserted against the reducer's actual recall
  // material per scenario (the reducer output IS the local proof stack output).
  test("pending candidate is excluded from recall", () => {
    const s = localProof("before_admission_excluded");
    expect(s.outcome).toBe("excluded");
    expect(s.includedAssertionIds).toEqual([]);
    expect(s.excludedIds).toContain("cand-001");
  });

  test("accepted candidate yields an admitted active assertion inclusion", () => {
    const s = localProof("accepted_admitted_included");
    expect(s.outcome).toBe("included");
    expect(s.includedAssertionIds).toEqual(["assn-001"]);
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
    );
  });

  test("rejected candidate yields no admitted assertion and stays excluded", () => {
    const s = localProof("rejected_excluded");
    expect(s.outcome).toBe("excluded");
    expect(s.includedAssertionIds).toEqual([]);
    expect(s.excludedIds).toContain("cand-002");
  });

  test("supersession includes corrected active only, excludes superseded prior", () => {
    const s = localProof("supersession_corrected_only");
    expect(s.outcome).toBe("included");
    expect(s.includedAssertionIds).toEqual(["assn-011"]);
    expect(s.includedAssertionIds).not.toContain("assn-010");
    expect(s.excludedIds).toContain("assn-010");
  });

  test("malformed/unsafe fails closed with empty recall material", () => {
    const s = localProof("malformed_fail_closed");
    expect(s.outcome).toBe("fail_closed");
    expect(s.includedAssertionIds).toEqual([]);
    expect(s.excludedIds).toEqual([]);
  });
});

// =========================================================================
// 3. no-leak posture over adapter results + formatted summaries
// =========================================================================

describe("Phase 45F · 3. no-leak over results + formatted summaries", () => {
  const RESULTS = DIXIE_PROBE_SCENARIO_IDS.map((id) =>
    mapDixieProbe(loadProbe(id)),
  );
  const SERIALIZED = RESULTS.map((r) => JSON.stringify(r));
  const FORMATTED = RESULTS.map((r) => formatAlignment(r));
  const ALL_OUTPUT = [...SERIALIZED, ...FORMATTED].join("\n\n");

  test("the reducer no-leak scan passes on every adapter result", () => {
    for (const r of RESULTS) expect(scanForUnsafeProjection(r)).toBeNull();
  });

  test("no unsafe marker / raw payload / source material anywhere in output", () => {
    expect(ALL_OUTPUT).not.toContain("unsafe_marker");
    expect(ALL_OUTPUT).not.toContain("candidate-body-demo");
    expect(ALL_OUTPUT).not.toContain("source-ref-demo");
    expect(ALL_OUTPUT).not.toContain("prior-body-demo");
    expect(ALL_OUTPUT).not.toContain("candidate_payload");
    expect(ALL_OUTPUT).not.toContain("source_ref");
    expect(ALL_OUTPUT).not.toContain("source_material");
    expect(ALL_OUTPUT).not.toContain("raw_reasons");
  });

  test("no private sentinels anywhere in output", () => {
    for (const sentinel of [
      "CANDIDATE_PRIVATE_SENTINEL",
      "SOURCE_SENTINEL",
      "ADMITTED_PRIVATE_SENTINEL",
      "SUPERSEDED_PRIVATE_SENTINEL",
    ]) {
      expect(ALL_OUTPUT).not.toContain(sentinel);
    }
  });

  test("no raw probe ids / tenant / estate / actor / receipt material in output", () => {
    for (const needle of [
      "cand_demo",
      "assn_demo",
      "trans_demo",
      "rcpt_demo",
      "tenant_demo",
      "estate_demo",
      "actor_demo",
      "audit_only",
    ]) {
      expect(ALL_OUTPUT).not.toContain(needle);
    }
  });

  test("no urls / jwt / pem / Bearer / sk- / long ids / 0x hex / stack traces", () => {
    expect(ALL_OUTPUT).not.toMatch(/https?:\/\//i);
    expect(ALL_OUTPUT).not.toMatch(/\beyJ[A-Za-z0-9_-]{8,}/); // JWT-ish
    expect(ALL_OUTPUT).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(ALL_OUTPUT).not.toMatch(/\bBearer\s+\S+/);
    expect(ALL_OUTPUT).not.toMatch(/\bsk-[A-Za-z0-9]{12,}/);
    expect(ALL_OUTPUT).not.toMatch(/\d{17,}/); // long id / Discord snowflake run
    expect(ALL_OUTPUT).not.toMatch(/0x[a-fA-F0-9]{40,}/);
    expect(ALL_OUTPUT).not.toContain("at Object.");
    expect(ALL_OUTPUT).not.toMatch(/\n\s+at\s+\S+\s+\(/); // node stack frame
    expect(ALL_OUTPUT).not.toContain("Error:");
  });

  test("success results carry only constant strings (no raw probe value reaches output)", () => {
    for (const r of RESULTS) {
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      for (const s of collectStrings(r)) {
        // every emitted string is short and adapter-owned; in particular it is
        // never a probe id, payload, or marker.
        expect(s).not.toContain("demo");
        expect(s).not.toContain("unsafe_marker");
      }
    }
  });
});

// =========================================================================
// 4. fail-closed on synthetic malformed input (never echoes raw input)
// =========================================================================

describe("Phase 45F · 4. fail-closed on malformed input", () => {
  const LONG_ID = "12345678901234567890"; // 20-digit run
  const UNSAFE = "unsafe_marker:synthetic-injected-body";
  const SENTINEL = "CANDIDATE_PRIVATE_SENTINEL_X";

  function expectSealedFail(r: DixieProbeAlignment, expectedReason: string): void {
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.alignmentStatus).toBe("fail_closed");
    expect(r.reasonCode).toBe(expectedReason as never);
    expect(typeof r.detail).toBe("string");
    expect(r.detail.length).toBeGreaterThan(0);
    expect(scanForUnsafeProjection(r)).toBeNull();
  }

  test("non-object input fails closed", () => {
    for (const bad of [null, undefined, 42, "string", []]) {
      expectSealedFail(
        mapDixieProbe(bad),
        DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape,
      );
    }
  });

  test("wrong probe_version fails closed without echoing injected values", () => {
    const tampered = {
      probe_kind: "admission_wedge_contract_probe",
      probe_version: `${LONG_ID}-${UNSAFE}`,
      scenario_id: "candidate_pending_not_recallable",
      schema_final: false,
      runtime_enabled: false,
      production_admission: false,
      public_safe: true,
      public_response: { rendered_candidate_payload: false, recall_eligible: false },
    };
    // non-vacuous: the input genuinely carries the banned material.
    expect(JSON.stringify(tampered)).toContain(LONG_ID);
    expect(JSON.stringify(tampered)).toContain("unsafe_marker");
    const r = mapDixieProbe(tampered);
    expectSealedFail(r, DIXIE_PROBE_ADAPTER_REASON_CODES.unknown_probe_version);
    const out = JSON.stringify(r);
    expect(out).not.toContain(LONG_ID);
    expect(out).not.toContain("unsafe_marker");
  });

  test("unknown scenario_id fails closed without echoing injected values", () => {
    const tampered = {
      probe_kind: "admission_wedge_contract_probe",
      probe_version: SUPPORTED_DIXIE_PROBE_VERSION,
      scenario_id: `unknown_${SENTINEL}_${LONG_ID}`,
      schema_final: false,
      runtime_enabled: false,
      production_admission: false,
      public_safe: true,
      candidate_payload: UNSAFE,
      public_response: { rendered_candidate_payload: false, recall_eligible: false },
    };
    expect(JSON.stringify(tampered)).toContain(SENTINEL);
    expect(JSON.stringify(tampered)).toContain(LONG_ID);
    const r = mapDixieProbe(tampered);
    expectSealedFail(
      r,
      DIXIE_PROBE_ADAPTER_REASON_CODES.unknown_probe_scenario,
    );
    const out = JSON.stringify(r);
    expect(out).not.toContain(SENTINEL);
    expect(out).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    expect(out).not.toContain(LONG_ID);
    expect(out).not.toContain("unsafe_marker");
  });

  test("a probe claiming runtime_enabled / production_admission fails closed", () => {
    const base = loadProbe("candidate_pending_not_recallable") as Record<
      string,
      unknown
    >;
    for (const claim of [
      { schema_final: true },
      { runtime_enabled: true },
      { production_admission: true },
      { public_safe: false },
    ]) {
      const tampered = { ...base, ...claim };
      const r = mapDixieProbe(tampered);
      expectSealedFail(
        r,
        DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape,
      );
    }
  });

  test("a public-surface that contradicts the mapped scenario fails closed", () => {
    // tamper the pending probe's public surface to claim recall_eligible=true.
    const base = loadProbe("candidate_pending_not_recallable") as Record<
      string,
      unknown
    >;
    const pr = { ...(base.public_response as Record<string, unknown>) };
    pr.recall_eligible = true;
    const tampered = { ...base, public_response: pr };
    const r = mapDixieProbe(tampered);
    expectSealedFail(
      r,
      DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
    );
  });

  test("a probe that renders the candidate payload fails closed", () => {
    const base = loadProbe("accept_candidate_to_admitted_assertion") as Record<
      string,
      unknown
    >;
    const pr = { ...(base.public_response as Record<string, unknown>) };
    pr.rendered_candidate_payload = true;
    const tampered = { ...base, public_response: pr };
    const r = mapDixieProbe(tampered);
    expectSealedFail(
      r,
      DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
    );
  });

  test("safeDixieProbeDetail seals every detail by reason code", () => {
    const code = DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape;
    const sealed = safeDixieProbeDetail(code);
    expect(sealed).toContain(code);
    // an unknown / unsafe reason value still seals to a safe, code-bearing string.
    const unsafe = safeDixieProbeDetail(
      "CANDIDATE_PRIVATE_SENTINEL_X" as typeof code,
    );
    expect(unsafe).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
  });
});

// =========================================================================
// 5. no runtime import / wiring (the adapter reaches nothing live)
// =========================================================================

describe("Phase 45F · 5. not wired into any runtime path", () => {
  const adapterSource = readFileSync(
    resolve(__dirname, "admission-wedge-dixie-probe-adapter.ts"),
    "utf8",
  );

  test("adapter imports only the pure Phase 44A reducer", () => {
    const importLines = adapterSource
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l) || /^\s*}\s+from\s+["']/.test(l));
    // the only module specifier the adapter imports from is the reducer.
    const specifiers = [...adapterSource.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect(specifiers).toEqual(["./admission-wedge-fixture-reducer.ts"]);
    void importLines;
  });

  test("adapter imports no Discord / dispatch / startup / registration", () => {
    expect(adapterSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(adapterSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
    expect(adapterSource).not.toMatch(/from\s+["'][^"']*dispatch[^"']*["']/);
    expect(adapterSource).not.toMatch(/from\s+["'][^"']*startup[^"']*["']/);
    expect(adapterSource).not.toMatch(/registerCommand\s*\(/);
    expect(adapterSource).not.toMatch(/applicationCommands/);
  });

  test("adapter imports no public renderer / live Dixie client / Dixie / Straylight", () => {
    expect(adapterSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
    expect(adapterSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(adapterSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
    expect(adapterSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(adapterSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
  });

  test("adapter imports no LLM SDK / storage and reaches no fs / net / env / clock", () => {
    expect(adapterSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(adapterSource).not.toMatch(/from\s+["']openai["']/);
    expect(adapterSource).not.toMatch(/from\s+["']pg["']/);
    expect(adapterSource).not.toMatch(/from\s+["']postgres["']/);
    expect(adapterSource).not.toMatch(/from\s+["']node:fs["']/);
    expect(adapterSource).not.toMatch(/from\s+["']node:http["']/);
    expect(adapterSource).not.toMatch(/readFileSync/);
    expect(adapterSource).not.toMatch(/\bfetch\s*\(/);
    expect(adapterSource).not.toMatch(/process\.env/);
    expect(adapterSource).not.toMatch(/Date\.now/);
    expect(adapterSource).not.toMatch(/Math\.random/);
  });

  test("no source file other than the adapter + its test references the adapter", () => {
    const repoRoot = resolve(__dirname, "../../../..");
    const { execSync } =
      require("node:child_process") as typeof import("node:child_process");
    const raw = execSync(
      "grep -rl --include='*.ts' --include='*.tsx' " +
        "'admission-wedge-dixie-probe-adapter' . " +
        "|| true",
      { cwd: repoRoot, encoding: "utf8" },
    );
    const importers = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^\.\//, ""));
    const allowed = new Set([
      "packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts",
      "packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.test.ts",
    ]);
    for (const f of importers) {
      expect(allowed.has(f)).toBe(true);
    }
  });

  test("the adapter is not listed in the package.json exports map", () => {
    const repoRoot = resolve(__dirname, "../../../..");
    const pkg = readFileSync(
      resolve(repoRoot, "packages/persona-engine/package.json"),
      "utf8",
    );
    const parsed = JSON.parse(pkg) as { exports?: Record<string, unknown> };
    const exportTargets = Object.values(parsed.exports ?? {}).map(String);
    for (const target of exportTargets) {
      expect(target).not.toContain("admission-wedge-dixie-probe-adapter");
    }
  });

  test("adapter makes no live-admission / production claim (only negated disclaimers)", () => {
    const lc = adapterSource.toLowerCase();
    for (const phrase of [
      "production admission",
      "live dixie",
      "production storage",
      "live admission route",
    ]) {
      for (const line of lc.split("\n").filter((l) => l.includes(phrase))) {
        expect(/\b(no|not|never|nothing|reaches no)\b/.test(line)).toBe(true);
      }
    }
  });
});
