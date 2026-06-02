// Phase 44C · Admission Wedge fixture-bound dev/operator reducer runner.
//
// Authority: docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md (Phase 44B gate,
// §7 selects this lane, §8 bounds it), over the Phase 43C fixtures
// (docs/admission-wedge/fixtures/) and the Phase 44A reducer
// (./admission-wedge-fixture-reducer.ts). It is the analogue of the accepted
// Recall Wedge Phase 35B dev/operator runner (./run-demo.ts): operator
// ergonomics over an already-accepted, fixture-bound, pure proof.
//
// What this runner does:
//   1. reads the EXISTING Phase 43C admission-wedge fixture JSON from disk
//      (Node built-ins only — it adds, mutates, and regenerates nothing);
//   2. calls the EXISTING Phase 44A reducer (`reduceAdmissionFixtureScenario`)
//      — it does NOT reimplement reducer semantics;
//   3. projects each reducer result into a small, safe, operator-readable
//      scenario summary (stable reason codes + short fixture ids only);
//   4. covers the five gate §8.1 scenarios:
//        - before_admission_excluded   — candidate excluded before admission;
//        - accepted_admitted_included  — admitted assertion included;
//        - rejected_excluded           — rejected candidate excluded;
//        - supersession_corrected_only — corrected included, prior excluded;
//        - malformed_fail_closed       — synthetic malformed input fails closed;
//   5. seals every summary against private sentinels / long ids / urls / pem
//      keys via the reducer's own `scanForUnsafeProjection` no-leak scan.
//
// What this runner is NOT (carried verbatim from the Phase 44B gate §8.2):
//   - it is NOT a live admission implementation. It admits nothing, stores
//     nothing, reaches no network, and reads no clock / env;
//   - it is NOT wired into Discord, Dixie, the public renderer, the live
//     client, dispatch, startup, command registration, or any package
//     export. It is imported only by its own test (and, behind an
//     `import.meta.main` guard, runnable as a local dev/operator CLI);
//   - it authorizes NO production admission, production storage, production
//     auth / consent, public remember-this, Discord history ingestion, user
//     chat becoming memory, a live Dixie admission route, a dev/operator
//     candidate command, or any Finn production wiring. All remain blocked.
//
// Determinism: this module's only side input is the static Phase 43C fixture
// JSON on disk; given those bytes it is a pure function. No clock, no env,
// no network, no random.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMISSION_REDUCER_REASON_CODES,
  reduceAdmissionFixtureScenario,
  scanForUnsafeProjection,
  type AdmissionReducerReasonCode,
  type AdmissionScenarioProof,
} from "./admission-wedge-fixture-reducer.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/admission-wedge/fixtures",
);

// -- report constants -------------------------------------------------------

export const ADMISSION_FIXTURE_DEMO_REPORT_TITLE =
  "Admission Wedge fixture-bound dev/operator reducer demo" as const;

export const SCENARIO_SECTION_HEADER_PREFIX = "Scenario summary: " as const;

export const SCOPE_BANNER_HEADER = "scope (read me first)" as const;

export const INTERNAL_PROOF_HEADER =
  "Run proof summary [INTERNAL / operator-only]" as const;

export const NON_GOALS_HEADER =
  "Non-goals / not authorized by this runner" as const;

// Read-me-first scope banner. Mirrors the Recall Wedge runners' banner so an
// operator can see, before reading any summary, exactly how bounded this is.
export const SCOPE_BANNER_LINES = [
  "fixture-bound: reads the existing Phase 43C admission-wedge fixtures only; mutates none of them",
  "reducer-bound: calls the Phase 44A reducer; does not reimplement reducer semantics",
  "dev/operator only: a callable runner plus an optional local CLI; not wired into any runtime path",
  "not live admission: admits nothing, stores nothing, reaches no network, reads no clock / env",
  "safe output: stable reason codes and short fixture ids only — no raw bodies, payloads, or private text",
] as const;

// What this runner is explicitly NOT, per the Phase 44B gate §8.2.
const NON_GOALS = [
  "no Discord command / dispatch / startup / command registration",
  "no /remember-this (public or dev-only) and no public remember-this",
  "no Discord history ingestion / no user chat becoming memory",
  "no live Dixie admission route / no live network call",
  "no production admission / production storage / production auth / consent",
  "no package export — this runner is not exported from the package surface",
  "no public renderer change / no live Dixie client",
  "no LLM rewriting / no character voice",
  "no forget / revoke / correction UI",
  "no Finn production wiring",
  "no mutation of the Phase 43C fixture JSON",
] as const;

// -- safe summary shape -----------------------------------------------------
//
// The single per-scenario object an operator (and the tests) read. Every
// field is intentionally safe: a canned scenario name, an enum outcome, a
// STABLE reducer reason code, short fixture ids only, an audit-link PRESENCE
// boolean (never the raw audit body), and a canned one-line summary.
export type AdmissionScenarioOutcome = "excluded" | "included" | "fail_closed";

export interface AdmissionScenarioSafeSummary {
  readonly scenario: string;
  readonly outcome: AdmissionScenarioOutcome;
  readonly reasonCode: AdmissionReducerReasonCode;
  // short fixture ids only (e.g. "assn-001"); empty unless this scenario
  // includes an admitted assertion in ordinary recall.
  readonly includedAssertionIds: readonly string[];
  // short fixture ids only — excluded candidate ids (before / rejected) or
  // the superseded prior assertion id (supersession).
  readonly excludedIds: readonly string[];
  // provenance / audit-link PRESENCE only; never the raw audit body.
  readonly auditLinkPresent: boolean;
  // canned, operator-safe one-liner describing the scenario.
  readonly safeSummary: string;
}

export interface AdmissionFixtureDemoCounts {
  readonly total: number;
  readonly excluded: number;
  readonly included: number;
  readonly fail_closed: number;
  // every scenario resolved to the outcome the gate §8.1 expects.
  readonly all_outcomes_matched_expected: boolean;
}

export interface AdmissionFixtureDemoReport {
  readonly title: string;
  readonly scope_banner: readonly string[];
  readonly summaries: readonly AdmissionScenarioSafeSummary[];
  readonly counts: AdmissionFixtureDemoCounts;
  readonly non_goals: readonly string[];
}

// -- fixture loading --------------------------------------------------------

export interface AdmissionWedgeFixtureBundle {
  readonly cand001: unknown;
  readonly cand002: unknown;
  readonly cand010: unknown;
  readonly cand011: unknown;
  readonly trans001: unknown;
  readonly trans002: unknown;
  readonly trans010: unknown;
  readonly trans011: unknown;
  readonly assn001: unknown;
  readonly assn010: unknown;
  readonly assn011: unknown;
  readonly proof001: unknown;
  readonly proof002: unknown;
  readonly proof003: unknown;
  readonly proof004: unknown;
}

function loadFixture(relPath: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, relPath), "utf8"));
}

// Read the EXISTING Phase 43C fixture graph from disk. Read-only: this never
// writes, mutates, or regenerates a fixture.
export function loadAdmissionWedgeFixtures(): AdmissionWedgeFixtureBundle {
  return {
    cand001: loadFixture("candidates/cand-001-accepted-pending.json"),
    cand002: loadFixture("candidates/cand-002-rejected-pending.json"),
    cand010: loadFixture("candidates/cand-010-original-pending.json"),
    cand011: loadFixture("candidates/cand-011-correction-pending.json"),
    trans001: loadFixture("transitions/trans-001-accept.json"),
    trans002: loadFixture("transitions/trans-002-reject.json"),
    trans010: loadFixture("transitions/trans-010-accept-original.json"),
    trans011: loadFixture("transitions/trans-011-supersede.json"),
    assn001: loadFixture("admitted/assn-001-active.json"),
    assn010: loadFixture("admitted/assn-010-superseded.json"),
    assn011: loadFixture("admitted/assn-011-active-correction.json"),
    proof001: loadFixture(
      "recall-proofs/proof-001-before-admission-excluded.json",
    ),
    proof002: loadFixture(
      "recall-proofs/proof-002-after-admission-included.json",
    ),
    proof003: loadFixture("recall-proofs/proof-003-rejected-excluded.json"),
    proof004: loadFixture(
      "recall-proofs/proof-004-supersession-corrected.json",
    ),
  };
}

// -- the synthetic malformed scenario (proves fail-closed) ------------------
//
// An IN-MEMORY malformed candidate that deliberately carries a private-body
// sentinel AND a long-id run, and claims recall-eligibility before admission
// — a direct invariant violation. It is constructed here at runtime and is
// NEVER written to fixture JSON. Routed through the SAME reducer entry point
// as the real scenarios, it must resolve to a stable fail-closed reason code
// and leak none of its unsafe input into the printed output.
//
// The unsafe tokens below exist only so the reducer's no-leak seal and this
// runner's output seal are exercised non-vacuously; they are synthetic and
// match the reducer's banned categories (sentinel prefix + 17+ digit run).
export const MALFORMED_DEMO_SENTINEL = "CANDIDATE_PRIVATE_SENTINEL_DEMO" as const;
export const MALFORMED_DEMO_LONG_ID = "99999999999999999999" as const;

export function buildMalformedDemoCandidate(): Record<string, unknown> {
  return {
    fixture_kind: "candidate_memory_packet",
    fixture_version: "phase-43c.0",
    // a long-id run + private sentinel buried in the id — must never surface.
    candidate_id: `cand-malformed-${MALFORMED_DEMO_LONG_ID}-${MALFORMED_DEMO_SENTINEL}`,
    actor_id: "freeside-characters:shared-substrate",
    // the invariant violation that trips the fail-closed gate:
    recall_eligibility: "eligible",
    admission_state: "candidate_pending",
    candidate_payload: {
      boundary: "public_safe",
      body_private: `synthetic malformed body — ${MALFORMED_DEMO_SENTINEL} — never rendered`,
    },
  };
}

// -- scenario plans ---------------------------------------------------------
//
// Each plan names a scenario, its expected outcome (per gate §8.1), a canned
// safe one-liner, and a `reduce` that calls the EXISTING Phase 44A reducer.
// The runner reimplements no reducer logic; it only routes fixtures in and
// projects safe summaries out.
interface ScenarioPlan {
  readonly name: string;
  readonly expectedOutcome: AdmissionScenarioOutcome;
  readonly safeSummary: string;
  readonly reduce: (f: AdmissionWedgeFixtureBundle) => AdmissionScenarioProof;
}

export const ADMISSION_DEMO_SCENARIO_PLANS: readonly ScenarioPlan[] = [
  {
    name: "before_admission_excluded",
    expectedOutcome: "excluded",
    safeSummary: "pending candidate excluded before admission",
    reduce: (f) =>
      reduceAdmissionFixtureScenario({
        kind: "before_admission",
        candidate: f.cand001,
        recallProof: f.proof001,
      }),
  },
  {
    name: "accepted_admitted_included",
    expectedOutcome: "included",
    safeSummary: "admitted assertion included after an explicit accept",
    reduce: (f) =>
      reduceAdmissionFixtureScenario({
        kind: "accepted",
        candidate: f.cand001,
        transition: f.trans001,
        admittedAssertion: f.assn001,
        recallProof: f.proof002,
      }),
  },
  {
    name: "rejected_excluded",
    expectedOutcome: "excluded",
    safeSummary: "rejected candidate excluded; no admitted assertion minted",
    reduce: (f) =>
      reduceAdmissionFixtureScenario({
        kind: "rejected",
        candidate: f.cand002,
        transition: f.trans002,
        recallProof: f.proof003,
      }),
  },
  {
    name: "supersession_corrected_only",
    expectedOutcome: "included",
    safeSummary:
      "corrected active assertion included; superseded prior excluded from ordinary recall",
    reduce: (f) =>
      reduceAdmissionFixtureScenario({
        kind: "supersession",
        correctionCandidate: f.cand011,
        supersedeTransition: f.trans011,
        correctedAssertion: f.assn011,
        supersededAssertion: f.assn010,
        recallProof: f.proof004,
      }),
  },
  {
    name: "malformed_fail_closed",
    expectedOutcome: "fail_closed",
    safeSummary: "malformed fixture input rejected fail-closed",
    reduce: (f) =>
      // synthetic malformed candidate routed through the SAME reducer entry
      // point; the recall proof is never reached (classify fails first).
      reduceAdmissionFixtureScenario({
        kind: "before_admission",
        candidate: buildMalformedDemoCandidate(),
        recallProof: f.proof001,
      }),
  },
] as const;

// -- safe projection --------------------------------------------------------

// Final output seal: scan a built summary for any unsafe material. If the
// scan ever trips (it must not for the real fixtures), replace the summary
// with a sealed fail-closed shell so nothing unsafe can reach the operator.
function sealSummary(
  summary: AdmissionScenarioSafeSummary,
): AdmissionScenarioSafeSummary {
  const hit = scanForUnsafeProjection(summary);
  if (!hit) return summary;
  return {
    scenario: summary.scenario,
    outcome: "fail_closed",
    reasonCode:
      ADMISSION_REDUCER_REASON_CODES.unsafe_private_sentinel_projection,
    includedAssertionIds: [],
    excludedIds: [],
    auditLinkPresent: false,
    safeSummary: "summary sealed: unsafe material blocked from operator output",
  };
}

function toSafeSummary(
  plan: ScenarioPlan,
  proof: AdmissionScenarioProof,
): AdmissionScenarioSafeSummary {
  if (!proof.ok) {
    // fail-closed: surface only the stable reason code (the reducer already
    // seals `detail` by reason code; the runner does not even forward it).
    return sealSummary({
      scenario: plan.name,
      outcome: "fail_closed",
      reasonCode: proof.reasonCode,
      includedAssertionIds: [],
      excludedIds: [],
      auditLinkPresent: false,
      safeSummary: plan.safeSummary,
    });
  }

  const recall = proof.recall;
  if (recall.recallResult === "excluded") {
    return sealSummary({
      scenario: plan.name,
      outcome: "excluded",
      reasonCode: recall.reasonCode,
      includedAssertionIds: [],
      excludedIds: recall.excludedCandidateIds,
      auditLinkPresent: false,
      safeSummary: plan.safeSummary,
    });
  }

  // included
  const audit = recall.audit;
  const auditLinkPresent = Boolean(
    audit.sourceCandidateId ||
      audit.admissionTransitionId ||
      audit.admissionReceiptRef ||
      audit.supersedesAssertionId,
  );
  return sealSummary({
    scenario: plan.name,
    outcome: "included",
    reasonCode: recall.reasonCode,
    includedAssertionIds: recall.includedAssertionIds,
    excludedIds: recall.excludedAssertionIds,
    auditLinkPresent,
    safeSummary: plan.safeSummary,
  });
}

// -- report builder ---------------------------------------------------------

export interface BuildAdmissionFixtureDemoReportOptions {
  readonly fixtures?: AdmissionWedgeFixtureBundle;
}

export function buildAdmissionFixtureDemoReport(
  options: BuildAdmissionFixtureDemoReportOptions = {},
): AdmissionFixtureDemoReport {
  const fixtures = options.fixtures ?? loadAdmissionWedgeFixtures();

  const summaries: AdmissionScenarioSafeSummary[] = [];
  let excluded = 0;
  let included = 0;
  let failClosed = 0;
  let allMatched = true;

  for (const plan of ADMISSION_DEMO_SCENARIO_PLANS) {
    const proof = plan.reduce(fixtures);
    const summary = toSafeSummary(plan, proof);
    summaries.push(summary);
    if (summary.outcome === "excluded") excluded += 1;
    else if (summary.outcome === "included") included += 1;
    else failClosed += 1;
    if (summary.outcome !== plan.expectedOutcome) allMatched = false;
  }

  return {
    title: ADMISSION_FIXTURE_DEMO_REPORT_TITLE,
    scope_banner: SCOPE_BANNER_LINES,
    summaries,
    counts: {
      total: ADMISSION_DEMO_SCENARIO_PLANS.length,
      excluded,
      included,
      fail_closed: failClosed,
      all_outcomes_matched_expected: allMatched,
    },
    non_goals: NON_GOALS,
  };
}

// -- formatter --------------------------------------------------------------

function formatScopeBanner(banner: readonly string[]): string {
  const lines: string[] = [`> ${SCOPE_BANNER_HEADER}:`];
  for (const item of banner) lines.push(`> - ${item}`);
  return lines.join("\n");
}

function formatScenarioSection(summary: AdmissionScenarioSafeSummary): string {
  return [
    `## ${SCENARIO_SECTION_HEADER_PREFIX}${summary.scenario}`,
    `outcome:                ${summary.outcome}`,
    `reason code:            ${summary.reasonCode}`,
    `included assertion ids: [${summary.includedAssertionIds.join(", ")}]`,
    `excluded ids:           [${summary.excludedIds.join(", ")}]`,
    `audit link present:     ${String(summary.auditLinkPresent)}`,
    `safe summary:           ${summary.safeSummary}`,
  ].join("\n");
}

function formatInternalProof(counts: AdmissionFixtureDemoCounts): string {
  return [
    `## ${INTERNAL_PROOF_HEADER}`,
    "the counts below are operator-only orientation, derived entirely from",
    "stable reason codes and outcome enums — no raw fixture material",
    "",
    "scenario counts:",
    `  total scenarios:    ${counts.total}`,
    `  excluded:           ${counts.excluded}`,
    `  included:           ${counts.included}`,
    `  fail_closed:        ${counts.fail_closed}`,
    "",
    "proof booleans:",
    `  all_outcomes_matched_expected: ${String(
      counts.all_outcomes_matched_expected,
    )}`,
  ].join("\n");
}

function formatNonGoals(nonGoals: readonly string[]): string {
  const lines: string[] = [`## ${NON_GOALS_HEADER}`];
  for (const item of nonGoals) lines.push(`- ${item}`);
  return lines.join("\n");
}

export function formatAdmissionFixtureDemoReport(
  report: AdmissionFixtureDemoReport,
): string {
  const parts: string[] = [
    `# ${report.title}`,
    formatScopeBanner(report.scope_banner),
  ];
  for (const summary of report.summaries) {
    parts.push(formatScenarioSection(summary));
  }
  parts.push(formatInternalProof(report.counts));
  parts.push(formatNonGoals(report.non_goals));
  return parts.join("\n\n");
}

// -- scenario-section extractor (test helper) -------------------------------

export interface ExtractedScenarioSection {
  readonly header: string;
  readonly body: string;
}

export function extractFormattedScenarioSection(
  formatted: string,
  scenario: string,
): ExtractedScenarioSection {
  const header = `## ${SCENARIO_SECTION_HEADER_PREFIX}${scenario}`;
  const headerIdx = formatted.indexOf(header);
  if (headerIdx < 0) {
    throw new Error(
      `run-admission-wedge-fixture-demo: scenario section not found for ${scenario}`,
    );
  }
  const afterHeader = formatted.slice(headerIdx + header.length);
  const nextHeaderRel = afterHeader.search(/\n## /);
  const body =
    nextHeaderRel < 0
      ? afterHeader.trimStart()
      : afterHeader.slice(0, nextHeaderRel).trimStart();
  return { header, body };
}

// -- runner -----------------------------------------------------------------

export interface RunAdmissionFixtureDemoOptions {
  readonly fixtures?: AdmissionWedgeFixtureBundle;
  readonly print?: (line: string) => void;
}

export function runAdmissionFixtureDemo(
  options: RunAdmissionFixtureDemoOptions = {},
): {
  readonly report: AdmissionFixtureDemoReport;
  readonly formatted: string;
} {
  const report = buildAdmissionFixtureDemoReport({
    fixtures: options.fixtures,
  });
  const formatted = formatAdmissionFixtureDemoReport(report);
  if (options.print) options.print(formatted);
  return { report, formatted };
}

// -- CLI guard --------------------------------------------------------------
//
// Local dev/operator convenience only. The runner is reachable as a CLI ONLY
// when this file is executed directly (`bun run …/run-admission-wedge-fixture-demo.ts`).
// It is never invoked on import — runtime code does not import this module.
const isCli =
  typeof import.meta !== "undefined" &&
  (import.meta as { main?: boolean }).main === true;

if (isCli) {
  runAdmissionFixtureDemo({ print: (line) => console.log(line) });
}
