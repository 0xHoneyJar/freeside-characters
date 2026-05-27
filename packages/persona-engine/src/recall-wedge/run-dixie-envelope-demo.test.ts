// Phase 36C · regression gate for the dev/operator runner over the
// recorded Dixie envelope corpus.
//
// Proves the runner module:
//   1. processes all nine recorded Dixie envelope fixtures (4 positive +
//      5 negative);
//   2. positive fixtures produce rendered public output sections;
//   3. negative fixtures produce fail-closed summaries with stable
//      expected error codes;
//   4. public rendered sections contain none of the Phase 36C banned
//      substrings (incl. session_id / message_id / tenant_id /
//      community_id / session_thread_id / continuity_actor_id /
//      actor: / freeside-characters:shared-substrate);
//   5. the full formatted report does not place public-sensitive
//      operational identifiers in any public section;
//   6. internal / fail-closed sections are clearly labeled
//      INTERNAL / operator-only;
//   7. fixture-bound / dev-only / non-live scope banner labels are
//      present;
//   8. authorized_private_session and public_telegram remain
//      fail-closed;
//   9. the runner does not import / invoke live / network / Discord /
//      Telegram / Dixie / Straylight / Finn / storage / LLM behavior;
//  10. runDixieEnvelopeDemo is side-effect-free by default and prints
//      only through an injected sink or the CLI guard;
//  11. existing recall-wedge test suite continues to pass (this file
//      adds tests; nothing is removed or weakened).

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIXIE_ENVELOPE_DEMO_REPORT_TITLE,
  DIXIE_ENVELOPE_FIXTURE_CATALOG,
  INTERNAL_PROOF_HEADER,
  NON_GOALS_HEADER,
  PUBLIC_SECTION_HEADER_PREFIX,
  buildDixieEnvelopeDemoReport,
  extractFormattedPublicSection,
  formatDixieEnvelopeDemoReport,
  loadDixieEnvelopeFixtures,
  runDixieEnvelopeDemo,
} from "./run-dixie-envelope-demo.ts";

// Phase 36C banned-substring set, including the Phase 36B session-bearing
// operational identifiers (tenant_id / community_id / session_thread_id).
const PUBLIC_OUTPUT_BANNED_SUBSTRINGS = [
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/recall-wedge/fixtures/dixie-envelope",
);

function loadRawFixture(file: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, file), "utf8"));
}

describe("DIXIE_ENVELOPE_FIXTURE_CATALOG · processes all nine fixtures", () => {
  test("catalog covers exactly the nine recorded Dixie envelope fixtures", () => {
    expect(DIXIE_ENVELOPE_FIXTURE_CATALOG.length).toBe(9);
    const files = DIXIE_ENVELOPE_FIXTURE_CATALOG.map((e) => e.file).sort();
    expect(files).toEqual(
      [
        "recorded-public-discord-recall-envelope.v0.json",
        "recorded-referral-recall-envelope.v0.json",
        "recorded-refusal-unauthorized-envelope.v0.json",
        "recorded-session-bearing-public-recall-envelope.v0.json",
        "recorded-unknown-version-envelope.json",
        "recorded-authorized-private-target-envelope.v0.json",
        "recorded-public-telegram-target-envelope.v0.json",
        "recorded-malformed-missing-payload-envelope.v0.json",
        "recorded-malformed-missing-target-envelope.v0.json",
      ].sort(),
    );
  });

  test("catalog has 4 positive and 5 negative entries", () => {
    const positive = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "positive_renderable",
    );
    const negative = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "negative_fail_closed",
    );
    expect(positive.length).toBe(4);
    expect(negative.length).toBe(5);
  });

  test("every negative entry declares an expected stable error code", () => {
    const negative = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "negative_fail_closed",
    );
    for (const entry of negative) {
      expect(entry.expected_error_code).toBeTruthy();
      expect(typeof entry.expected_error_code).toBe("string");
    }
  });

  test("loadDixieEnvelopeFixtures loads JSON for every catalog file", () => {
    const fixtures = loadDixieEnvelopeFixtures();
    for (const entry of DIXIE_ENVELOPE_FIXTURE_CATALOG) {
      expect(fixtures[entry.file]).toBeDefined();
      expect(typeof fixtures[entry.file]).toBe("object");
    }
  });
});

describe("buildDixieEnvelopeDemoReport · positive renderable handling", () => {
  const report = buildDixieEnvelopeDemoReport();

  test("emits one public section per positive fixture in catalog order", () => {
    expect(report.public_sections.length).toBe(4);
    const orderedPositiveFiles = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "positive_renderable",
    ).map((e) => e.file);
    const reportedFiles = report.public_sections.map((s) => s.fixture_file);
    expect(reportedFiles).toEqual(orderedPositiveFiles);
  });

  test("each positive section carries the catalog description and non-empty rendered text", () => {
    for (const section of report.public_sections) {
      const entry = DIXIE_ENVELOPE_FIXTURE_CATALOG.find(
        (e) => e.file === section.fixture_file,
      );
      expect(entry).toBeDefined();
      expect(section.description).toBe(entry!.description);
      expect(typeof section.rendered_text).toBe("string");
      expect(section.rendered_text.length).toBeGreaterThan(0);
    }
  });

  test("public_discord normal envelope renders the recall billboard header", () => {
    const section = report.public_sections.find(
      (s) =>
        s.fixture_file === "recorded-public-discord-recall-envelope.v0.json",
    );
    expect(section).toBeDefined();
    expect(section!.rendered_text).toContain("[recall · public · ruggy · ok]");
  });

  test("referral envelope renders a referral target / message", () => {
    const section = report.public_sections.find(
      (s) => s.fixture_file === "recorded-referral-recall-envelope.v0.json",
    );
    expect(section).toBeDefined();
    expect(section!.rendered_text).toContain("referral target: satoshi");
  });

  test("refusal/unauthorized envelope renders a public-safe generic refusal billboard", () => {
    const section = report.public_sections.find(
      (s) =>
        s.fixture_file ===
        "recorded-refusal-unauthorized-envelope.v0.json",
    );
    expect(section).toBeDefined();
    expect(section!.rendered_text).toContain("authorized_session");
  });

  test("session-bearing envelope renders without operational identifiers", () => {
    const section = report.public_sections.find(
      (s) =>
        s.fixture_file ===
        "recorded-session-bearing-public-recall-envelope.v0.json",
    );
    expect(section).toBeDefined();
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(section!.rendered_text).not.toContain(banned);
    }
  });

  test("internal proof reports all_positives_rendered_ok=true", () => {
    expect(report.internal_proof.all_positives_rendered_ok).toBe(true);
    expect(report.internal_proof.counts.positive_unexpected_failure).toBe(0);
    expect(report.internal_proof.counts.positive_rendered_ok).toBe(4);
  });
});

describe("buildDixieEnvelopeDemoReport · negative fail-closed handling", () => {
  const report = buildDixieEnvelopeDemoReport();

  test("emits one fail-closed summary per negative fixture", () => {
    expect(report.internal_proof.fail_closed_summaries.length).toBe(5);
  });

  test("every negative fixture matched its expected stable error code", () => {
    expect(report.internal_proof.all_negatives_matched_expected).toBe(true);
    expect(report.internal_proof.counts.negative_unexpected_code_or_pass).toBe(
      0,
    );
    expect(report.internal_proof.counts.negative_matched_expected_code).toBe(5);
    for (const summary of report.internal_proof.fail_closed_summaries) {
      expect(summary.matched_expected).toBe(true);
      expect(summary.observed_error_code).toBe(summary.expected_error_code);
    }
  });

  test("unknown-version envelope surfaces unsupported_dixie_envelope_version", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) => s.fixture_file === "recorded-unknown-version-envelope.json",
    );
    expect(summary?.observed_error_code).toBe(
      "unsupported_dixie_envelope_version",
    );
  });

  test("authorized_private_session target surfaces authorized_private_projection_not_implemented", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file ===
        "recorded-authorized-private-target-envelope.v0.json",
    );
    expect(summary?.observed_error_code).toBe(
      "authorized_private_projection_not_implemented",
    );
  });

  test("public_telegram target surfaces public_telegram_projection_not_implemented", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file === "recorded-public-telegram-target-envelope.v0.json",
    );
    expect(summary?.observed_error_code).toBe(
      "public_telegram_projection_not_implemented",
    );
  });

  test("malformed-missing-payload surfaces missing_public_recall_payload", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file ===
        "recorded-malformed-missing-payload-envelope.v0.json",
    );
    expect(summary?.observed_error_code).toBe("missing_public_recall_payload");
  });

  test("malformed-missing-target surfaces unknown_target_projection (broader entry point)", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file ===
        "recorded-malformed-missing-target-envelope.v0.json",
    );
    expect(summary?.observed_error_code).toBe("unknown_target_projection");
  });

  test("negative fixtures do NOT appear in the public_sections array", () => {
    const negativeFiles = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "negative_fail_closed",
    ).map((e) => e.file);
    const reportedPublicFiles = report.public_sections.map(
      (s) => s.fixture_file,
    );
    for (const f of negativeFiles) {
      expect(reportedPublicFiles).not.toContain(f);
    }
  });
});

describe("formatDixieEnvelopeDemoReport · structural separation", () => {
  const report = buildDixieEnvelopeDemoReport();
  const formatted = formatDixieEnvelopeDemoReport(report);

  test("title section names the fixture-bound dev/operator demo", () => {
    expect(formatted).toContain(`# ${DIXIE_ENVELOPE_DEMO_REPORT_TITLE}`);
  });

  test("scope banner declares fixture-bound, dev/operator, not live, not admission, not schema authority", () => {
    expect(formatted).toContain("fixture-bound");
    expect(formatted).toContain("dev/operator only");
    expect(formatted).toContain("not live Dixie");
    expect(formatted).toContain("not governed memory admission");
    expect(formatted).toContain("not production schema authority");
  });

  test("includes a public section header for each positive fixture", () => {
    for (const section of report.public_sections) {
      expect(formatted).toContain(
        `## ${PUBLIC_SECTION_HEADER_PREFIX}${section.fixture_file}`,
      );
    }
  });

  test("internal proof section is labeled INTERNAL / operator-only", () => {
    expect(formatted).toContain(`## ${INTERNAL_PROOF_HEADER}`);
    expect(formatted).toContain("INTERNAL / operator-only");
  });

  test("fail-closed summaries are labeled INTERNAL / operator-only inside the internal section", () => {
    expect(formatted).toContain(
      "fail-closed summaries [INTERNAL / operator-only]",
    );
  });

  test("non-goals section enumerates the live integrations not present", () => {
    expect(formatted).toContain(`## ${NON_GOALS_HEADER}`);
    expect(formatted).toContain("no Discord");
    expect(formatted).toContain("no Telegram");
    expect(formatted).toContain("no live Dixie client");
    expect(formatted).toContain("no live memory admission");
    expect(formatted).toContain("no LLM / voice rewrite");
    expect(formatted).toContain(
      "recorded fixtures are not production schema authority",
    );
  });

  test("public sections appear before internal proof and non-goals", () => {
    const firstPublicHeader = formatted.indexOf(
      `## ${PUBLIC_SECTION_HEADER_PREFIX}`,
    );
    const internalIdx = formatted.indexOf(`## ${INTERNAL_PROOF_HEADER}`);
    const nonGoalsIdx = formatted.indexOf(`## ${NON_GOALS_HEADER}`);
    expect(firstPublicHeader).toBeGreaterThan(-1);
    expect(internalIdx).toBeGreaterThan(firstPublicHeader);
    expect(nonGoalsIdx).toBeGreaterThan(internalIdx);
  });
});

describe("formatDixieEnvelopeDemoReport · public sections never leak banned material", () => {
  const report = buildDixieEnvelopeDemoReport();
  const formatted = formatDixieEnvelopeDemoReport(report);

  for (const section of report.public_sections) {
    const extracted = extractFormattedPublicSection(
      formatted,
      section.fixture_file,
    );
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      test(`public section for ${section.fixture_file} contains no "${banned}"`, () => {
        expect(extracted.body).not.toContain(banned);
      });
    }

    test(`public section for ${section.fixture_file} has no line starting with actor:`, () => {
      for (const line of extracted.body.split("\n")) {
        expect(line.startsWith("actor:")).toBe(false);
      }
    });
  }
});

describe("formatDixieEnvelopeDemoReport · session-bearing operational ids never appear in any public section", () => {
  // Anti-vacuity: the session-bearing source envelope MUST carry the
  // synthetic identifier values; otherwise the leak claim below could be
  // satisfied by an absent identifier rather than by the adapter actually
  // stripping it.
  const sessionBearing = loadRawFixture(
    "recorded-session-bearing-public-recall-envelope.v0.json",
  ) as Record<string, unknown>;

  test("source envelope ACTUALLY carries operational id values (proof is non-vacuous)", () => {
    for (const key of [
      "session_id",
      "message_id",
      "tenant_id",
      "community_id",
      "session_thread_id",
    ]) {
      const v = sessionBearing[key];
      expect(typeof v).toBe("string");
      expect((v as string).length).toBeGreaterThan(0);
    }
  });

  const formatted = formatDixieEnvelopeDemoReport(
    buildDixieEnvelopeDemoReport(),
  );

  test("synthetic identifier VALUES never appear in any public section", () => {
    const positiveFiles = DIXIE_ENVELOPE_FIXTURE_CATALOG.filter(
      (e) => e.expected_class === "positive_renderable",
    ).map((e) => e.file);
    for (const file of positiveFiles) {
      const extracted = extractFormattedPublicSection(formatted, file);
      for (const key of [
        "session_id",
        "message_id",
        "tenant_id",
        "community_id",
        "session_thread_id",
      ]) {
        const v = sessionBearing[key];
        if (typeof v === "string" && v.length > 0) {
          expect(extracted.body).not.toContain(v);
        }
      }
    }
  });
});

describe("buildDixieEnvelopeDemoReport · accepts injected fixtures", () => {
  test("passes through caller-supplied fixtures for deterministic test composition", () => {
    const fixtures = loadDixieEnvelopeFixtures();
    const report = buildDixieEnvelopeDemoReport({ fixtures });
    expect(report.public_sections.length).toBe(4);
    expect(report.internal_proof.fail_closed_summaries.length).toBe(5);
  });
});

describe("runDixieEnvelopeDemo · invocation surface", () => {
  test("returns the report and formatted text without printing by default", () => {
    const result = runDixieEnvelopeDemo();
    expect(result.report.title).toBe(DIXIE_ENVELOPE_DEMO_REPORT_TITLE);
    expect(typeof result.formatted).toBe("string");
    expect(result.formatted.length).toBeGreaterThan(0);
  });

  test("prints exactly once through an injected sink", () => {
    const printed: string[] = [];
    const result = runDixieEnvelopeDemo({
      print: (line) => printed.push(line),
    });
    expect(printed.length).toBe(1);
    expect(printed[0]).toBe(result.formatted);
  });

  test("formatted output is deterministic across invocations", () => {
    const a = runDixieEnvelopeDemo().formatted;
    const b = runDixieEnvelopeDemo().formatted;
    expect(a).toBe(b);
  });

  test("does not call console.log when no print sink is provided (side-effect-free by default)", () => {
    const original = console.log;
    let calls = 0;
    console.log = () => {
      calls += 1;
    };
    try {
      runDixieEnvelopeDemo();
    } finally {
      console.log = original;
    }
    expect(calls).toBe(0);
  });
});

describe("runDixieEnvelopeDemo · authorized_private_session and public_telegram remain fail-closed", () => {
  const report = buildDixieEnvelopeDemoReport();

  test("authorized_private_session fixture stays in fail-closed summaries with the not-implemented code", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file ===
        "recorded-authorized-private-target-envelope.v0.json",
    );
    expect(summary).toBeDefined();
    expect(summary!.observed_error_code).toBe(
      "authorized_private_projection_not_implemented",
    );
    expect(summary!.matched_expected).toBe(true);
  });

  test("public_telegram fixture stays in fail-closed summaries with the not-implemented code", () => {
    const summary = report.internal_proof.fail_closed_summaries.find(
      (s) =>
        s.fixture_file === "recorded-public-telegram-target-envelope.v0.json",
    );
    expect(summary).toBeDefined();
    expect(summary!.observed_error_code).toBe(
      "public_telegram_projection_not_implemented",
    );
    expect(summary!.matched_expected).toBe(true);
  });

  test("neither authorized_private_session nor public_telegram appears in public_sections", () => {
    const publicFiles = report.public_sections.map((s) => s.fixture_file);
    expect(publicFiles).not.toContain(
      "recorded-authorized-private-target-envelope.v0.json",
    );
    expect(publicFiles).not.toContain(
      "recorded-public-telegram-target-envelope.v0.json",
    );
  });
});

describe("runDixieEnvelopeDemo · no live integration surface (static source guard)", () => {
  // Read the runner source directly to guard against accidental import
  // additions. Mirrors the run-demo.test.ts pattern.
  const moduleSource = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync: rfs } =
      require("node:fs") as typeof import("node:fs");
    const { dirname: dn, resolve: rs } =
      require("node:path") as typeof import("node:path");
    const { fileURLToPath: ftp } =
      require("node:url") as typeof import("node:url");
    const here = dn(ftp(import.meta.url));
    return rfs(rs(here, "run-dixie-envelope-demo.ts"), "utf8");
  })();

  test("runner source imports no Discord client or interactions", () => {
    expect(moduleSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
  });

  test("runner source imports no Telegram client", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*node-telegram[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']telegraf["']/);
  });

  test("runner source imports no @loa/dixie / @loa/straylight / Finn", () => {
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
  });

  test("runner source does not call an LLM SDK", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']@anthropic-ai\/sdk["']/);
    expect(moduleSource).not.toMatch(/from\s+["']openai["']/);
  });

  test("runner source does not pull in pg / production storage", () => {
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
    expect(moduleSource).not.toMatch(/from\s+["']redis["']/);
  });

  test("runner source contains no fetch( or network node imports", () => {
    expect(moduleSource).not.toContain("fetch(");
    expect(moduleSource).not.toMatch(/from\s+["']node:http["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:https["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:net["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:child_process["']/);
  });

  test("runner source does not register or dispatch Discord / Telegram commands", () => {
    expect(moduleSource).not.toMatch(/registerCommand\s*\(/);
    expect(moduleSource).not.toMatch(/applicationCommands/);
    expect(moduleSource).not.toMatch(/sendMessage\s*\(/);
  });

  test("runner source uses node:fs only for local fixture loading", () => {
    // node:fs is allowed (fixtures are JSON files on disk), but only
    // through the readFileSync used by loadJson; no writes, watches, or
    // streams.
    expect(moduleSource).toMatch(/from\s+["']node:fs["']/);
    expect(moduleSource).not.toMatch(/writeFileSync\s*\(/);
    expect(moduleSource).not.toMatch(/createWriteStream\s*\(/);
    expect(moduleSource).not.toMatch(/watchFile\s*\(/);
    expect(moduleSource).not.toMatch(/\bunlinkSync\s*\(/);
  });
});
