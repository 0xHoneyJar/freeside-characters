// Phase 45F · Admission Wedge — Dixie probe no-op adapter / validator.
//
// Authority: docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md (Phase 45E
// §6 probe-to-local mapping, §10 selected lane, §11 boundaries), over the Dixie
// Phase 33C draft v0 contract probes — MIRRORED locally for tests at
// docs/admission-wedge/dixie-probes/ — and the Freeside-local Admission Wedge
// proof stack (Phase 43C fixtures · Phase 44A reducer · Phase 44C runner).
//
// What this adapter does:
//   - It is a pure, local, no-op SEMANTIC MAPPING layer. Given an
//     already-parsed Dixie probe object, it maps the probe's draft-v0 scenario
//     to the current local Admission Wedge proof scenario and emits a small,
//     safe, deterministic alignment result. It proves the two sides agree at
//     the semantic level; it wires nothing.
//   - It maps each of the five Dixie probe scenarios onto the local proof
//     scenario names the Phase 44C runner already uses:
//         candidate_pending_not_recallable        -> before_admission_excluded
//         accept_candidate_to_admitted_assertion  -> accepted_admitted_included
//         reject_candidate_no_assertion            -> rejected_excluded
//         supersede_with_corrected_assertion       -> supersession_corrected_only
//         malformed_or_unsafe_payload_fail_closed  -> malformed_fail_closed
//   - It preserves both label sets: local fixture labels remain local PROOF
//     labels, the local reducer reason codes remain local PROOF codes, and the
//     Dixie probe labels remain Dixie-owned DRAFT v0 labels. It renames
//     nothing, mutates no fixture JSON, and mutates no reducer reason code.
//     Neither label set is a frozen final schema, and Freeside Characters does
//     not own the Dixie / Straylight vocabulary.
//
// What this adapter is NOT (carried from the Phase 45E gate §11 / §12):
//   - it is NOT pure-with-side-effects: it reads no filesystem, no network, no
//     env, no clock, no storage, and no database. It is a pure function of its
//     already-parsed input. (Its test loads the mirrored probe JSON from disk
//     and passes the parsed objects in; the adapter itself never reads a file.)
//   - it imports ONLY the pure, dependency-free Phase 44A reducer
//     (./admission-wedge-fixture-reducer.ts) for the local reason-code table
//     and the shared no-leak scan. It imports no Discord client, no dispatch /
//     startup / command registration, no public renderer, no live Dixie client,
//     and no LLM SDK;
//   - it is NOT exported from the package surface, is NOT a Discord command, and
//     is wired into NO runtime path. It is imported only by its own test;
//   - it does NOT mutate the Phase 44A reducer or the Phase 44C runner, does NOT
//     call live Dixie, does NOT add a live Dixie admission route, and authorizes
//     NO production admission, production storage, production auth / consent,
//     public remember-this, Discord history ingestion, or user chat becoming
//     memory. All of those remain blocked.
//
// No-leak posture: the adapter reads ONLY the probe's public-safe surface
// (top-level metadata booleans + public_response). It NEVER reads the probe's
// private `input` / `audit` sections, candidate payload, source material, or
// `unsafe_marker:` tokens. Every successful alignment result is built entirely
// from adapter-owned CONSTANTS (never echoing a raw probe value), and every
// returned result — success or fail-closed — is sealed through the reducer's
// scanForUnsafeProjection before it is returned.

import {
  ADMISSION_REDUCER_REASON_CODES,
  scanForUnsafeProjection,
  type AdmissionReducerReasonCode,
} from "./admission-wedge-fixture-reducer.ts";

// -- vocabulary (preserved, not renamed) -----------------------------------

// The Dixie draft v0 probe scenario ids (Dixie-owned DRAFT labels — preserved
// verbatim, never coined or renamed here).
export const DIXIE_PROBE_SCENARIO_IDS = [
  "candidate_pending_not_recallable",
  "accept_candidate_to_admitted_assertion",
  "reject_candidate_no_assertion",
  "supersede_with_corrected_assertion",
  "malformed_or_unsafe_payload_fail_closed",
] as const;
export type DixieProbeScenarioId = (typeof DIXIE_PROBE_SCENARIO_IDS)[number];

// The local proof scenario names — exactly the Phase 44C runner's scenario
// labels (local PROOF labels — preserved verbatim, never renamed here).
export const LOCAL_ADMISSION_SCENARIOS = [
  "before_admission_excluded",
  "accepted_admitted_included",
  "rejected_excluded",
  "supersession_corrected_only",
  "malformed_fail_closed",
] as const;
export type LocalAdmissionScenario = (typeof LOCAL_ADMISSION_SCENARIOS)[number];

// The one Dixie draft probe version this adapter understands. A different /
// missing version fails closed (a future probe version reconciles under its own
// gate; this adapter does not silently accept it).
export const SUPPORTED_DIXIE_PROBE_VERSION =
  "dixie_admission_wedge_probe_v0" as const;

const SUPPORTED_PROBE_KIND = "admission_wedge_contract_probe" as const;

// Dixie-owned refusal-family direction for the malformed probe's public path
// (Dixie-local refusal codes, cited as DRAFT direction — not a Freeside code).
const DIXIE_REFUSAL_FAMILY = new Set<string>([
  "ingress.invalid_request",
  "seam.class_validation_failed",
]);

// -- adapter fail-closed reason codes (stable, adapter-local) ---------------

// Stable reason codes for the adapter's own fail-closed path. These are
// adapter-local (they classify why a probe could not be mapped); they are NOT
// the reducer's reason codes and do NOT mutate them.
export const DIXIE_PROBE_ADAPTER_REASON_CODES = {
  unsupported_probe_shape: "unsupported_probe_shape",
  unknown_probe_version: "unknown_probe_version",
  unknown_probe_scenario: "unknown_probe_scenario",
  probe_public_surface_mismatch: "probe_public_surface_mismatch",
  unsafe_probe_projection: "unsafe_probe_projection",
} as const;
export type DixieProbeAdapterReasonCode =
  (typeof DIXIE_PROBE_ADAPTER_REASON_CODES)[keyof typeof DIXIE_PROBE_ADAPTER_REASON_CODES];

const DIXIE_PROBE_ADAPTER_REASON_CODE_SET = new Set<string>(
  Object.values(DIXIE_PROBE_ADAPTER_REASON_CODES),
);

// -- output shapes ----------------------------------------------------------

export type AdmissionOutcomeClassification =
  | "excluded"
  | "included"
  | "fail_closed";

export interface DixieProbeAlignmentOk {
  readonly ok: true;
  // the matched Dixie scenario id — emitted from the adapter's known constant,
  // never echoed from raw input.
  readonly dixieScenario: DixieProbeScenarioId;
  // the local proof scenario this Dixie probe maps onto (Phase 44C runner
  // label — a local PROOF label, preserved).
  readonly localScenario: LocalAdmissionScenario;
  // the Dixie draft probe version (constant); marks this as DRAFT v0, not final.
  readonly dixieProbeVersion: typeof SUPPORTED_DIXIE_PROBE_VERSION;
  // semantics agree on every known probe; the only deltas are naming / shape.
  readonly alignmentStatus: "aligned_semantics";
  // stable outcome classification matching the Phase 44C runner's outcome enum.
  readonly outcomeClassification: AdmissionOutcomeClassification;
  // the LOCAL reducer reason code this scenario reconciles onto — a local PROOF
  // code (preserved, not mutated). Drawn from ADMISSION_REDUCER_REASON_CODES.
  readonly localReasonCode: AdmissionReducerReasonCode;
  // canned, public-safe statements of the aligned local meaning.
  readonly semanticAssertions: readonly string[];
  // canned disclaimers: no rename, draft v0, not final schema, no-op only.
  readonly notes: readonly string[];
  readonly publicSafe: true;
}

export interface DixieProbeAlignmentFailClosed {
  readonly ok: false;
  readonly alignmentStatus: "fail_closed";
  readonly reasonCode: DixieProbeAdapterReasonCode;
  // sealed human breadcrumb built ONLY from the stable reason code — it carries
  // no raw probe value, id, payload, unsafe marker, secret, url, or json body.
  readonly detail: string;
  readonly publicSafe: true;
}

export type DixieProbeAlignment =
  | DixieProbeAlignmentOk
  | DixieProbeAlignmentFailClosed;

// -- shared disclaimer notes (constant, on every success result) ------------

const ALIGNMENT_NOTES: readonly string[] = [
  "no-op alignment only: no runtime wiring, no live Dixie call, no storage, no admission, no Discord behavior",
  "local fixture labels remain local proof labels — this adapter renames nothing",
  "local reducer reason codes remain local proof codes — this adapter mutates none of them",
  "Dixie probe labels remain draft v0 (dixie_admission_wedge_probe_v0) — not final schema",
  "neither label set is a frozen final schema; Freeside Characters does not own the Dixie or Straylight vocabulary",
];

// -- the scenario mapping table (all values are adapter-owned constants) ----

interface ScenarioMapping {
  readonly dixieScenario: DixieProbeScenarioId;
  readonly localScenario: LocalAdmissionScenario;
  readonly outcomeClassification: AdmissionOutcomeClassification;
  readonly localReasonCode: AdmissionReducerReasonCode;
  readonly semanticAssertions: readonly string[];
  // public-surface expectations, checked against the probe's public_response.
  readonly expectRecallEligible: boolean;
  readonly expectOutcomeIsRefused: boolean;
  readonly expectStableRefusalReasonCode: boolean;
}

const SCENARIO_MAPPINGS: Readonly<Record<DixieProbeScenarioId, ScenarioMapping>> =
  {
    candidate_pending_not_recallable: {
      dixieScenario: "candidate_pending_not_recallable",
      localScenario: "before_admission_excluded",
      outcomeClassification: "excluded",
      localReasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
      semanticAssertions: [
        "pending candidate is excluded from ordinary recall before admission",
        "candidate is not admitted memory",
        "candidate payload is not rendered on the public surface",
      ],
      expectRecallEligible: false,
      expectOutcomeIsRefused: false,
      expectStableRefusalReasonCode: false,
    },
    accept_candidate_to_admitted_assertion: {
      dixieScenario: "accept_candidate_to_admitted_assertion",
      localScenario: "accepted_admitted_included",
      outcomeClassification: "included",
      localReasonCode: ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
      semanticAssertions: [
        "accepted candidate yields an admitted active assertion included in ordinary recall",
        "the admitted assertion is recall-eligible under policy",
        "the raw candidate payload is not rendered on the public surface",
      ],
      expectRecallEligible: true,
      expectOutcomeIsRefused: false,
      expectStableRefusalReasonCode: false,
    },
    reject_candidate_no_assertion: {
      dixieScenario: "reject_candidate_no_assertion",
      localScenario: "rejected_excluded",
      outcomeClassification: "excluded",
      localReasonCode: ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
      semanticAssertions: [
        "rejected candidate yields no admitted assertion",
        "rejected candidate remains excluded from ordinary recall",
        "the candidate payload is not rendered on the public surface",
      ],
      expectRecallEligible: false,
      expectOutcomeIsRefused: false,
      expectStableRefusalReasonCode: false,
    },
    supersede_with_corrected_assertion: {
      dixieScenario: "supersede_with_corrected_assertion",
      localScenario: "supersession_corrected_only",
      outcomeClassification: "included",
      localReasonCode: ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion,
      semanticAssertions: [
        "supersession includes the corrected active assertion only",
        "the superseded prior assertion is excluded from ordinary recall",
        "the supersedes link is preserved for audit / provenance, not rendered",
      ],
      expectRecallEligible: true,
      expectOutcomeIsRefused: false,
      expectStableRefusalReasonCode: false,
    },
    malformed_or_unsafe_payload_fail_closed: {
      dixieScenario: "malformed_or_unsafe_payload_fail_closed",
      localScenario: "malformed_fail_closed",
      outcomeClassification: "fail_closed",
      // representative local fail-closed proof code; the local unsafe_* no-leak
      // family (unsafe_candidate_payload_projection /
      // unsafe_private_sentinel_projection) reconciles onto the same Dixie
      // refusal direction — see the semanticAssertions below.
      localReasonCode: ADMISSION_REDUCER_REASON_CODES.unsupported_fixture_shape,
      semanticAssertions: [
        "malformed / unsafe input fails closed with a stable reason code",
        "no admitted assertion is minted on the fail-closed path",
        "the public response leaks no candidate payload, unsafe marker, or source material",
        "Dixie public reason_code direction is the ingress.invalid_request refusal family; the local fail-closed proof code is unsupported_fixture_shape",
      ],
      expectRecallEligible: false,
      expectOutcomeIsRefused: true,
      expectStableRefusalReasonCode: true,
    },
  };

// The required scenario mapping, exported flat so a test / future reader can
// assert the five mappings without reaching into the mapping table.
export const DIXIE_TO_LOCAL_SCENARIO: Readonly<
  Record<DixieProbeScenarioId, LocalAdmissionScenario>
> = {
  candidate_pending_not_recallable: "before_admission_excluded",
  accept_candidate_to_admitted_assertion: "accepted_admitted_included",
  reject_candidate_no_assertion: "rejected_excluded",
  supersede_with_corrected_assertion: "supersession_corrected_only",
  malformed_or_unsafe_payload_fail_closed: "malformed_fail_closed",
};

// -- safe readers -----------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getString(rec: Record<string, unknown>, key: string): string | null {
  const v = rec[key];
  return typeof v === "string" ? v : null;
}

// Fail-closed details are sealed by reason code: the breadcrumb is built ONLY
// from the stable reason code, so no raw probe value can leave via `detail`.
export function safeDixieProbeDetail(
  reasonCode: DixieProbeAdapterReasonCode,
): string {
  const safe = DIXIE_PROBE_ADAPTER_REASON_CODE_SET.has(reasonCode)
    ? reasonCode
    : DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape;
  return `fail-closed: ${safe}`;
}

function failClosed(
  reasonCode: DixieProbeAdapterReasonCode,
): DixieProbeAlignmentFailClosed {
  return {
    ok: false,
    alignmentStatus: "fail_closed",
    reasonCode,
    detail: safeDixieProbeDetail(reasonCode),
    publicSafe: true,
  };
}

// Final output seal. Every returned result is scanned for unsafe material; if
// anything trips (it must not, since success results are built from constants),
// it is replaced with a sealed fail-closed result so nothing unsafe can ever
// leave the adapter — even if a future probe / refactor regresses.
function sealAlignment(result: DixieProbeAlignment): DixieProbeAlignment {
  if (scanForUnsafeProjection(result)) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unsafe_probe_projection);
  }
  return result;
}

// =========================================================================
// mapDixieProbe — the no-op adapter entry point.
// =========================================================================
//
// Accepts an ALREADY-PARSED Dixie probe object (the test reads the mirrored
// probe JSON and passes the parsed object in; the adapter reads no file). Maps
// the probe's draft-v0 scenario to the local proof scenario and returns a safe,
// deterministic alignment result. Fails closed (returns a sealed fail-closed
// result; it does not throw) on any unknown / malformed probe shape, never
// echoing a raw probe value.
export function mapDixieProbe(probe: unknown): DixieProbeAlignment {
  const rec = isPlainObject(probe) ? probe : null;
  if (!rec) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape);
  }

  // probe_kind must be the known kind.
  if (getString(rec, "probe_kind") !== SUPPORTED_PROBE_KIND) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape);
  }

  // probe_version must be the one supported draft v0.
  if (getString(rec, "probe_version") !== SUPPORTED_DIXIE_PROBE_VERSION) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unknown_probe_version);
  }

  // metadata booleans must mark the probe non-runtime / non-production / draft.
  // A probe that claims schema_final / runtime_enabled / production_admission,
  // or that is not public_safe, is refused (the adapter never relaxes these).
  if (
    rec.schema_final !== false ||
    rec.runtime_enabled !== false ||
    rec.production_admission !== false ||
    rec.public_safe !== true
  ) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unsupported_probe_shape);
  }

  // scenario_id must be one of the five known Dixie probe scenarios.
  const scenarioId = getString(rec, "scenario_id");
  if (
    scenarioId === null ||
    !(scenarioId in SCENARIO_MAPPINGS) ||
    !(DIXIE_PROBE_SCENARIO_IDS as readonly string[]).includes(scenarioId)
  ) {
    return failClosed(DIXIE_PROBE_ADAPTER_REASON_CODES.unknown_probe_scenario);
  }
  const mapping = SCENARIO_MAPPINGS[scenarioId as DixieProbeScenarioId];

  // public-surface consistency check — read ONLY public_response. If the
  // probe's public surface contradicts the mapped scenario's semantics, the
  // adapter fails closed rather than asserting a false alignment.
  const publicResponse = isPlainObject(rec.public_response)
    ? rec.public_response
    : null;
  if (!publicResponse) {
    return failClosed(
      DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
    );
  }
  // candidate payload must never be rendered on any probe's public surface.
  if (publicResponse.rendered_candidate_payload !== false) {
    return failClosed(
      DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
    );
  }
  if (publicResponse.recall_eligible !== mapping.expectRecallEligible) {
    return failClosed(
      DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
    );
  }
  if (mapping.expectOutcomeIsRefused) {
    if (getString(publicResponse, "outcome") !== "refused") {
      return failClosed(
        DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
      );
    }
  }
  if (mapping.expectStableRefusalReasonCode) {
    const reasonCode = getString(publicResponse, "reason_code");
    if (reasonCode === null || !DIXIE_REFUSAL_FAMILY.has(reasonCode)) {
      return failClosed(
        DIXIE_PROBE_ADAPTER_REASON_CODES.probe_public_surface_mismatch,
      );
    }
  }

  // Build the alignment result entirely from adapter-owned CONSTANTS — no raw
  // probe value is carried through. (The scenario id is re-emitted from the
  // matched mapping constant, not from the raw input string.)
  const result: DixieProbeAlignmentOk = {
    ok: true,
    dixieScenario: mapping.dixieScenario,
    localScenario: mapping.localScenario,
    dixieProbeVersion: SUPPORTED_DIXIE_PROBE_VERSION,
    alignmentStatus: "aligned_semantics",
    outcomeClassification: mapping.outcomeClassification,
    localReasonCode: mapping.localReasonCode,
    semanticAssertions: mapping.semanticAssertions,
    notes: ALIGNMENT_NOTES,
    publicSafe: true,
  };
  return sealAlignment(result);
}

// Convenience batch mapper over an array of already-parsed probes. Pure; same
// no-leak / fail-closed guarantees per element.
export function mapDixieProbes(
  probes: readonly unknown[],
): readonly DixieProbeAlignment[] {
  return probes.map((p) => mapDixieProbe(p));
}
