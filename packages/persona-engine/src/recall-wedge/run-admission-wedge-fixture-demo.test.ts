// Phase 44C · Admission Wedge fixture-bound dev/operator reducer runner —
// regression gate.
//
// Authority: docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md (Phase 44B gate
// §7 selects this lane, §8 bounds it, §9 sets these acceptance criteria),
// over the Phase 43C fixtures and the Phase 44A reducer.
//
// These tests prove the runner:
//   1. loads the EXISTING Phase 43C fixtures successfully;
//   2. before-admission summary excludes the candidate;
//   3. accepted/admitted summary includes the admitted assertion only;
//   4. rejected summary excludes the rejected candidate and mints/includes no
//      admitted assertion;
//   5. supersession summary includes the corrected active assertion only and
//      excludes the superseded prior state from ordinary recall;
//   6. the synthetic malformed scenario fails closed;
//   7. output carries no private sentinel, raw candidate payload, long ids,
//      raw fixture bodies, urls, secrets, stack traces, or binary/screenshot
//      references;
//   8. the runner imports + calls the Phase 44A reducer rather than
//      reimplementing its main logic;
//   9. the runner file is not imported from any runtime path
//      (Discord/Dixie/renderer/dispatch/startup/command registration/package
//      exports).
//
// Scope reminder (Phase 44B gate §8.2): this is a fixture-bound dev/operator
// runner. It admits nothing, stores nothing, reaches no network, and is wired
// into no runtime path. It authorizes no live admission.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMISSION_REDUCER_REASON_CODES,
  scanForUnsafeProjection,
} from "./admission-wedge-fixture-reducer.ts";
import {
  ADMISSION_DEMO_SCENARIO_PLANS,
  ADMISSION_FIXTURE_DEMO_REPORT_TITLE,
  MALFORMED_DEMO_LONG_ID,
  MALFORMED_DEMO_SENTINEL,
  NON_GOALS_HEADER,
  SCENARIO_SECTION_HEADER_PREFIX,
  buildAdmissionFixtureDemoReport,
  buildMalformedDemoCandidate,
  extractFormattedScenarioSection,
  formatAdmissionFixtureDemoReport,
  loadAdmissionWedgeFixtures,
  runAdmissionFixtureDemo,
  type AdmissionScenarioSafeSummary,
} from "./run-admission-wedge-fixture-demo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Collect every string emitted anywhere in a value (recursively).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

function summaryByName(
  report: ReturnType<typeof buildAdmissionFixtureDemoReport>,
  name: string,
): AdmissionScenarioSafeSummary {
  const s = report.summaries.find((x) => x.scenario === name);
  if (!s) throw new Error(`missing scenario summary: ${name}`);
  return s;
}

// =========================================================================
// 1. runner loads existing fixtures successfully
// =========================================================================

describe("Phase 44C · 1. loads existing Phase 43C fixtures", () => {
  test("loadAdmissionWedgeFixtures reads every fixture from disk", () => {
    const f = loadAdmissionWedgeFixtures();
    // every fixture parsed to an object (not null / not a parse miss).
    for (const v of Object.values(f)) {
      expect(typeof v).toBe("object");
      expect(v).not.toBeNull();
    }
    // spot-check the candidate id is the real Phase 43C id.
    expect((f.cand001 as Record<string, unknown>).candidate_id).toBe(
      "cand-001",
    );
  });

  test("buildAdmissionFixtureDemoReport produces all five gate scenarios", () => {
    const report = buildAdmissionFixtureDemoReport();
    expect(report.title).toBe(ADMISSION_FIXTURE_DEMO_REPORT_TITLE);
    expect(report.summaries.map((s) => s.scenario)).toEqual([
      "before_admission_excluded",
      "accepted_admitted_included",
      "rejected_excluded",
      "supersession_corrected_only",
      "malformed_fail_closed",
    ]);
    expect(report.counts.total).toBe(5);
    expect(report.counts.all_outcomes_matched_expected).toBe(true);
  });

  test("report is deterministic across invocations", () => {
    const a = formatAdmissionFixtureDemoReport(buildAdmissionFixtureDemoReport());
    const b = formatAdmissionFixtureDemoReport(buildAdmissionFixtureDemoReport());
    expect(a).toBe(b);
  });
});

// =========================================================================
// 2. before-admission summary excludes the candidate
// =========================================================================

describe("Phase 44C · 2. before-admission excludes candidate", () => {
  const report = buildAdmissionFixtureDemoReport();
  const s = summaryByName(report, "before_admission_excluded");

  test("outcome is excluded with candidate_not_admitted", () => {
    expect(s.outcome).toBe("excluded");
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_not_admitted,
    );
  });

  test("the candidate is in excludedIds and never in includedAssertionIds", () => {
    expect(s.excludedIds).toContain("cand-001");
    expect(s.includedAssertionIds).toEqual([]);
  });
});

// =========================================================================
// 3. accepted/admitted summary includes the admitted assertion only
// =========================================================================

describe("Phase 44C · 3. accepted includes admitted assertion only", () => {
  const report = buildAdmissionFixtureDemoReport();
  const s = summaryByName(report, "accepted_admitted_included");

  test("outcome is included with admitted_active_assertion", () => {
    expect(s.outcome).toBe("included");
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.admitted_active_assertion,
    );
  });

  test("includes exactly the admitted assertion assn-001 and no candidate id", () => {
    expect(s.includedAssertionIds).toEqual(["assn-001"]);
    expect(s.includedAssertionIds).not.toContain("cand-001");
  });

  test("audit-link presence is reported without the raw audit body", () => {
    expect(s.auditLinkPresent).toBe(true);
    // no raw audit fields are exposed on the summary object.
    expect("audit" in s).toBe(false);
  });
});

// =========================================================================
// 4. rejected summary excludes the rejected candidate; mints no assertion
// =========================================================================

describe("Phase 44C · 4. rejected excludes candidate, mints nothing", () => {
  const report = buildAdmissionFixtureDemoReport();
  const s = summaryByName(report, "rejected_excluded");

  test("outcome is excluded with candidate_rejected", () => {
    expect(s.outcome).toBe("excluded");
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.candidate_rejected,
    );
  });

  test("excludes cand-002 and includes / mints no admitted assertion", () => {
    expect(s.excludedIds).toContain("cand-002");
    expect(s.includedAssertionIds).toEqual([]);
  });
});

// =========================================================================
// 5. supersession includes corrected active only; excludes superseded prior
// =========================================================================

describe("Phase 44C · 5. supersession corrected-only", () => {
  const report = buildAdmissionFixtureDemoReport();
  const s = summaryByName(report, "supersession_corrected_only");

  test("outcome is included with corrected_active_assertion", () => {
    expect(s.outcome).toBe("included");
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES.corrected_active_assertion,
    );
  });

  test("includes only the corrected active assn-011, excludes the prior assn-010", () => {
    expect(s.includedAssertionIds).toEqual(["assn-011"]);
    expect(s.includedAssertionIds).not.toContain("assn-010");
    expect(s.excludedIds).toContain("assn-010");
  });
});

// =========================================================================
// 6. synthetic malformed scenario fails closed
// =========================================================================

describe("Phase 44C · 6. malformed scenario fails closed", () => {
  const report = buildAdmissionFixtureDemoReport();
  const s = summaryByName(report, "malformed_fail_closed");

  test("outcome is fail_closed with a stable reason code", () => {
    expect(s.outcome).toBe("fail_closed");
    expect(s.reasonCode).toBe(
      ADMISSION_REDUCER_REASON_CODES
        .candidate_recall_eligible_before_admission,
    );
    expect(s.includedAssertionIds).toEqual([]);
    expect(s.excludedIds).toEqual([]);
  });

  test("the synthetic malformed candidate is non-vacuous (genuinely carries unsafe input)", () => {
    const raw = JSON.stringify(buildMalformedDemoCandidate());
    expect(raw).toContain(MALFORMED_DEMO_SENTINEL);
    expect(raw).toContain(MALFORMED_DEMO_LONG_ID);
    // and the reducer's own scan flags it — proving the fail-closed path is real.
    expect(scanForUnsafeProjection(buildMalformedDemoCandidate())).not.toBeNull();
  });

  test("the malformed summary leaks neither the sentinel nor the long id", () => {
    const out = JSON.stringify(s);
    expect(out).not.toContain(MALFORMED_DEMO_SENTINEL);
    expect(out).not.toContain(MALFORMED_DEMO_LONG_ID);
    expect(out).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
    expect(scanForUnsafeProjection(s)).toBeNull();
  });
});

// =========================================================================
// 7. no-leak posture — output carries no unsafe material
// =========================================================================

describe("Phase 44C · 7. safe-output / no-leak posture", () => {
  const report = buildAdmissionFixtureDemoReport();
  const formatted = formatAdmissionFixtureDemoReport(report);

  test("the structured report scans clean (reducer no-leak seal)", () => {
    expect(scanForUnsafeProjection(report)).toBeNull();
  });

  test("no string anywhere in the report contains a private body sentinel", () => {
    for (const s of collectStrings(report)) {
      expect(s).not.toContain("CANDIDATE_PRIVATE_SENTINEL");
      expect(s).not.toContain("SOURCE_SENTINEL");
      expect(s).not.toContain("ADMITTED_PRIVATE_SENTINEL");
      expect(s).not.toContain("SUPERSEDED_PRIVATE_SENTINEL");
    }
  });

  test("no raw candidate / admitted body text reaches the output", () => {
    // these phrases live only inside the never-rendered fixture bodies.
    expect(formatted).not.toContain("held for review");
    expect(formatted).not.toContain("never rendered");
    expect(formatted).not.toContain("body_private");
    expect(formatted).not.toContain("source_material");
    expect(formatted).not.toContain("candidate_payload");
  });

  test("no long ids, hex addresses, urls, jwts, or pem keys appear", () => {
    expect(formatted).not.toMatch(/\d{17,}/);
    expect(formatted).not.toMatch(/0x[a-fA-F0-9]{40,}/);
    expect(formatted).not.toMatch(/https?:\/\//i);
    expect(formatted).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}/); // JWT-ish
    expect(formatted).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
  });

  test("no stack-trace or operational-id markers appear", () => {
    expect(formatted).not.toContain("at Object.");
    expect(formatted).not.toMatch(/\n\s+at\s+\S+\s+\(/); // node stack frame
    expect(formatted).not.toContain("Error:");
  });

  test("no screenshot / binary / image evidence references appear", () => {
    expect(formatted).not.toMatch(/\.(png|jpg|jpeg|gif|webp|pdf|mp4|bin)\b/i);
    expect(formatted).not.toContain("data:image");
    expect(formatted).not.toContain("base64");
  });

  test("each scenario section body scans clean and stays short-id-only", () => {
    for (const plan of ADMISSION_DEMO_SCENARIO_PLANS) {
      const section = extractFormattedScenarioSection(formatted, plan.name);
      expect(scanForUnsafeProjection(section.body)).toBeNull();
      expect(section.body).not.toMatch(/\d{17,}/);
    }
  });
});

// =========================================================================
// 8. runner imports + calls the Phase 44A reducer (does not reimplement it)
// =========================================================================

describe("Phase 44C · 8. composes the Phase 44A reducer", () => {
  const moduleSource = readFileSync(
    resolve(__dirname, "run-admission-wedge-fixture-demo.ts"),
    "utf8",
  );

  test("imports the Phase 44A reducer entry point", () => {
    expect(moduleSource).toMatch(
      /from\s+["']\.\/admission-wedge-fixture-reducer\.ts["']/,
    );
    expect(moduleSource).toContain("reduceAdmissionFixtureScenario");
  });

  test("calls reduceAdmissionFixtureScenario for every scenario plan", () => {
    // one call per the five scenarios, all routed through the reducer.
    const calls = (
      moduleSource.match(/reduceAdmissionFixtureScenario\s*\(/g) ?? []
    ).length;
    expect(calls).toBe(ADMISSION_DEMO_SCENARIO_PLANS.length);
  });

  test("does not reimplement the reducer's core decision logic locally", () => {
    // the runner must not redefine the reducer's primitive functions — those
    // belong to the Phase 44A module. (It legitimately imports the reason
    // codes + scan; it must not declare its own copies.)
    expect(moduleSource).not.toMatch(
      /function\s+classifyAdmissionCandidate\b/,
    );
    expect(moduleSource).not.toMatch(/function\s+applyAdmissionTransition\b/);
    expect(moduleSource).not.toMatch(
      /function\s+projectAdmissionRecallProof\b/,
    );
    expect(moduleSource).not.toMatch(
      /function\s+reduceAdmissionFixtureScenario\b/,
    );
    // and it does not re-declare the reason-code table.
    expect(moduleSource).not.toMatch(
      /const\s+ADMISSION_REDUCER_REASON_CODES\s*=/,
    );
  });

  test("the runner's outcomes match the reducer's results directly", () => {
    // call the reducer the same way the plans do and confirm parity — proves
    // the runner is a projection of the reducer, not an independent oracle.
    const report = buildAdmissionFixtureDemoReport();
    for (const plan of ADMISSION_DEMO_SCENARIO_PLANS) {
      const proof = plan.reduce(loadAdmissionWedgeFixtures());
      const summary = report.summaries.find((s) => s.scenario === plan.name)!;
      if (proof.ok) {
        const expectedOutcome =
          proof.recall.recallResult === "excluded" ? "excluded" : "included";
        expect(summary.outcome).toBe(expectedOutcome);
        expect(summary.reasonCode).toBe(proof.recall.reasonCode);
      } else {
        expect(summary.outcome).toBe("fail_closed");
        expect(summary.reasonCode).toBe(proof.reasonCode);
      }
    }
  });
});

// =========================================================================
// 9. runner is not imported from any runtime path
// =========================================================================

describe("Phase 44C · 9. not wired into any runtime path", () => {
  const moduleSource = readFileSync(
    resolve(__dirname, "run-admission-wedge-fixture-demo.ts"),
    "utf8",
  );

  test("runner imports no Discord client / dispatch / interactions", () => {
    expect(moduleSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*dispatch[^"']*["']/);
  });

  test("runner imports no Dixie / Straylight / Finn / live client", () => {
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
  });

  test("runner imports no public renderer / adapter", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
  });

  test("runner imports no LLM SDK / production storage", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']openai["']/);
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
  });

  test("runner does not register or dispatch Discord commands", () => {
    expect(moduleSource).not.toMatch(/registerCommand\s*\(/);
    expect(moduleSource).not.toMatch(/applicationCommands/);
    expect(moduleSource).not.toMatch(/createWebhook\s*\(/);
  });

  test("runner reaches no network / clock / env", () => {
    expect(moduleSource).not.toMatch(/\bfetch\s*\(/);
    expect(moduleSource).not.toMatch(/process\.env/);
    expect(moduleSource).not.toMatch(/Date\.now/);
    expect(moduleSource).not.toMatch(/Math\.random/);
  });

  test("no other source file imports this runner (not wired into runtime)", () => {
    // sweep the whole repo (excluding node_modules / .git) for any importer
    // of this module other than its own test. The runner must be reachable
    // only by its test and the local CLI guard.
    const repoRoot = resolve(__dirname, "../../../..");
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const raw = execSync(
      "grep -rl --include='*.ts' --include='*.tsx' " +
        "'run-admission-wedge-fixture-demo' . " +
        "|| true",
      { cwd: repoRoot, encoding: "utf8" },
    );
    const importers = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      // normalize to basenames for comparison.
      .map((l) => l.replace(/^\.\//, ""));
    // only the runner itself and its test may reference the module name.
    const allowed = new Set([
      "packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts",
      "packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.test.ts",
    ]);
    for (const f of importers) {
      expect(allowed.has(f)).toBe(true);
    }
  });

  test("the runner is not listed in the package.json exports map", () => {
    const repoRoot = resolve(__dirname, "../../../..");
    const pkg = readFileSync(
      resolve(repoRoot, "packages/persona-engine/package.json"),
      "utf8",
    );
    const parsed = JSON.parse(pkg) as { exports?: Record<string, unknown> };
    const exportTargets = Object.values(parsed.exports ?? {}).map(String);
    for (const target of exportTargets) {
      expect(target).not.toContain("run-admission-wedge-fixture-demo");
    }
  });
});

// =========================================================================
// 10. invocation surface
// =========================================================================

describe("Phase 44C · 10. runner invocation surface", () => {
  test("runAdmissionFixtureDemo returns report + formatted, prints when asked", () => {
    const printed: string[] = [];
    const result = runAdmissionFixtureDemo({ print: (l) => printed.push(l) });
    expect(result.report.title).toBe(ADMISSION_FIXTURE_DEMO_REPORT_TITLE);
    expect(result.formatted.length).toBeGreaterThan(0);
    expect(printed.length).toBe(1);
    expect(printed[0]).toBe(result.formatted);
  });

  test("does not print when no print sink is provided", () => {
    const result = runAdmissionFixtureDemo();
    expect(result.formatted).toContain(
      `# ${ADMISSION_FIXTURE_DEMO_REPORT_TITLE}`,
    );
  });

  test("formatted report enumerates the non-goals (no live surface claims)", () => {
    const { formatted } = runAdmissionFixtureDemo();
    expect(formatted).toContain(`## ${NON_GOALS_HEADER}`);
    expect(formatted).toContain("no live Dixie admission route");
    expect(formatted).toContain("no production admission");
    expect(formatted).toContain("no package export");
    expect(formatted).toContain("no /remember-this");
  });

  test("accepts injected fixtures for deterministic test composition", () => {
    const injected = buildAdmissionFixtureDemoReport({
      fixtures: loadAdmissionWedgeFixtures(),
    });
    expect(injected.counts.all_outcomes_matched_expected).toBe(true);
  });
});

// =========================================================================
// 11. scenario section headers + structure
// =========================================================================

describe("Phase 44C · 11. report structure", () => {
  const formatted = formatAdmissionFixtureDemoReport(
    buildAdmissionFixtureDemoReport(),
  );

  for (const plan of ADMISSION_DEMO_SCENARIO_PLANS) {
    test(`includes a scenario section header for ${plan.name}`, () => {
      expect(formatted).toContain(
        `## ${SCENARIO_SECTION_HEADER_PREFIX}${plan.name}`,
      );
    });
  }

  test("scope banner precedes the first scenario section", () => {
    const bannerIdx = formatted.indexOf("> scope (read me first):");
    const firstScenarioIdx = formatted.indexOf(
      `## ${SCENARIO_SECTION_HEADER_PREFIX}before_admission_excluded`,
    );
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(firstScenarioIdx).toBeGreaterThan(bannerIdx);
  });
});
