// Phase 35B · explicit dev/operator Recall Wedge demo runner regression gate.
//
// Proves the runner module:
//   1. invokes the existing fixture-bound cross-interface demo;
//   2. exposes public rendered text from the Phase 33C public renderer
//      via the public-discord and character-boundary referral sections;
//   3. clearly separates internal proof data from public output;
//   4. reports the operator-private view as not publicly renderable;
//   5. never leaks banned private substrings into any public section;
//   6. labels the internal proof section as INTERNAL / operator-only;
//   7. introduces no Discord / Dixie / Straylight / Finn / storage /
//      admission / LLM behavior.

import { describe, test, expect } from "bun:test";

import {
  buildRecallWedgeCrossInterfaceDemo,
  loadRecallWedgeFixtures,
} from "./demo-cross-interface.ts";
import {
  buildRecallWedgeDemoReport,
  extractFormattedPublicSection,
  formatRecallWedgeDemoReport,
  INTERNAL_PROOF_HEADER,
  NON_GOALS_HEADER,
  PUBLIC_SECTION_HEADER_PREFIX,
  RECALL_WEDGE_DEMO_REPORT_TITLE,
  runRecallWedgeDemo,
} from "./run-demo.ts";

const PUBLIC_OUTPUT_BANNED_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
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
  "actor:",
  "freeside-characters:shared-substrate",
] as const;

describe("buildRecallWedgeDemoReport · uses the existing cross-interface demo", () => {
  const report = buildRecallWedgeDemoReport();
  const referenceDemo = buildRecallWedgeCrossInterfaceDemo();

  test("seed_fixture_id matches the cross-interface demo seed_fixture_id", () => {
    expect(report.internal_proof.seed_fixture_id).toBe(
      referenceDemo.seed_fixture_id,
    );
    expect(report.internal_proof.seed_fixture_id).toBe(
      "shared-substrate-demo-001",
    );
  });

  test("continuity_actor_id_internal matches the cross-interface demo", () => {
    expect(report.internal_proof.continuity_actor_id_internal).toBe(
      referenceDemo.continuity_actor_id_internal,
    );
    expect(report.internal_proof.continuity_actor_id_internal).toBe(
      "freeside-characters:shared-substrate",
    );
  });

  test("public-discord rendered text comes through verbatim from Phase 33C renderer", () => {
    const referenceText = referenceDemo.views.public_discord.rendered_text;
    expect(typeof referenceText).toBe("string");
    expect(report.public_sections.public_discord.rendered_text).toBe(
      referenceText as string,
    );
    expect(report.public_sections.public_discord.recall_interface).toBe(
      "public_discord",
    );
    expect(report.public_sections.public_discord.render_surface).toBe(
      "discord_public_character",
    );
    expect(report.public_sections.public_discord.rendered_text).toContain(
      "[recall · public · ruggy · ok]",
    );
  });

  test("character-boundary referral rendered text comes through verbatim from Phase 33C renderer", () => {
    const referenceText =
      referenceDemo.views.character_boundary_referral.rendered_text;
    expect(typeof referenceText).toBe("string");
    expect(
      report.public_sections.character_boundary_referral.rendered_text,
    ).toBe(referenceText as string);
    expect(
      report.public_sections.character_boundary_referral.rendered_text,
    ).toContain("referral target: satoshi");
  });

  test("proof booleans match the underlying cross-interface demo", () => {
    expect(report.internal_proof.proof).toEqual(referenceDemo.proof);
    expect(report.internal_proof.proof.same_seed_fixture).toBe(true);
    expect(report.internal_proof.proof.same_continuity_actor_internal).toBe(
      true,
    );
    expect(report.internal_proof.proof.different_authorized_views).toBe(true);
    expect(report.internal_proof.proof.public_outputs_no_leak).toBe(true);
  });

  test("accepts injected fixtures for deterministic test composition", () => {
    const fixtures = loadRecallWedgeFixtures();
    const injected = buildRecallWedgeDemoReport(fixtures);
    expect(injected.internal_proof.seed_fixture_id).toBe(
      "shared-substrate-demo-001",
    );
  });
});

describe("buildRecallWedgeDemoReport · operator-private view is not publicly renderable", () => {
  const report = buildRecallWedgeDemoReport();

  test("operator_private projection is reported as publicly_renderable=false", () => {
    expect(report.internal_proof.operator_private_view.publicly_renderable).toBe(
      false,
    );
    expect(report.internal_proof.operator_private_view.reason).toBe(
      "operator_private_not_public_renderable",
    );
    expect(report.internal_proof.operator_private_view.recall_interface).toBe(
      "operator_private",
    );
    expect(report.internal_proof.operator_private_view.render_surface).toBe(
      "operator_debug",
    );
  });

  test("public sections cover only public_discord and character_boundary_referral", () => {
    const keys = Object.keys(report.public_sections).sort();
    expect(keys).toEqual(
      ["character_boundary_referral", "public_discord"].sort(),
    );
  });
});

describe("formatRecallWedgeDemoReport · structural separation", () => {
  const report = buildRecallWedgeDemoReport();
  const formatted = formatRecallWedgeDemoReport(report);

  test("title section names the fixture-bound demo", () => {
    expect(formatted).toContain(`# ${RECALL_WEDGE_DEMO_REPORT_TITLE}`);
  });

  test("includes a public-discord public section header", () => {
    expect(formatted).toContain(
      `## ${PUBLIC_SECTION_HEADER_PREFIX}public_discord`,
    );
  });

  test("includes a character-boundary referral public section header", () => {
    expect(formatted).toContain(
      `## ${PUBLIC_SECTION_HEADER_PREFIX}character_boundary_referral`,
    );
  });

  test("internal proof section is labeled INTERNAL / operator-only", () => {
    expect(formatted).toContain(`## ${INTERNAL_PROOF_HEADER}`);
    expect(formatted).toContain("INTERNAL / operator-only");
  });

  test("non-goals section enumerates the live integrations not present", () => {
    expect(formatted).toContain(`## ${NON_GOALS_HEADER}`);
    expect(formatted).toContain("no Discord");
    expect(formatted).toContain("no live Dixie client");
    expect(formatted).toContain("no live memory admission");
    expect(formatted).toContain("no LLM / voice rewrite");
  });

  test("internal proof and public sections are textually distinct (proof appears after public sections)", () => {
    const pubIdx = formatted.indexOf(
      `## ${PUBLIC_SECTION_HEADER_PREFIX}public_discord`,
    );
    const refIdx = formatted.indexOf(
      `## ${PUBLIC_SECTION_HEADER_PREFIX}character_boundary_referral`,
    );
    const internalIdx = formatted.indexOf(`## ${INTERNAL_PROOF_HEADER}`);
    expect(pubIdx).toBeGreaterThan(-1);
    expect(refIdx).toBeGreaterThan(pubIdx);
    expect(internalIdx).toBeGreaterThan(refIdx);
  });
});

describe("formatRecallWedgeDemoReport · public sections never leak private material", () => {
  const report = buildRecallWedgeDemoReport();
  const formatted = formatRecallWedgeDemoReport(report);
  const publicSection = extractFormattedPublicSection(
    formatted,
    "public_discord",
  );
  const referralSection = extractFormattedPublicSection(
    formatted,
    "character_boundary_referral",
  );

  for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
    test(`public_discord public section contains no "${banned}"`, () => {
      expect(publicSection.body).not.toContain(banned);
    });
    test(`character_boundary_referral public section contains no "${banned}"`, () => {
      expect(referralSection.body).not.toContain(banned);
    });
  }

  test("no public section line begins with actor:", () => {
    for (const body of [publicSection.body, referralSection.body]) {
      for (const line of body.split("\n")) {
        expect(line.startsWith("actor:")).toBe(false);
      }
    }
  });

  test("public sections do not embed the operator-private summary", () => {
    const fixtures = loadRecallWedgeFixtures();
    const opSummary = String(
      fixtures.operatorPrivate.operator_private_summary ?? "",
    );
    expect(opSummary.length).toBeGreaterThan(0);
    expect(publicSection.body).not.toContain(opSummary);
    expect(referralSection.body).not.toContain(opSummary);
  });

  test("public sections never include the internal continuity actor id", () => {
    const internalActor = report.internal_proof.continuity_actor_id_internal;
    expect(publicSection.body).not.toContain(internalActor);
    expect(referralSection.body).not.toContain(internalActor);
  });

  test("public sections never include the seed_fixture_id (internal proof field)", () => {
    const seedId = report.internal_proof.seed_fixture_id;
    expect(publicSection.body).not.toContain(seedId);
    expect(referralSection.body).not.toContain(seedId);
  });
});

describe("runRecallWedgeDemo · invocation surface", () => {
  test("returns the report and formatted text without printing by default", () => {
    const printed: string[] = [];
    const result = runRecallWedgeDemo({
      print: (line) => printed.push(line),
    });
    expect(result.report.title).toBe(RECALL_WEDGE_DEMO_REPORT_TITLE);
    expect(typeof result.formatted).toBe("string");
    expect(result.formatted.length).toBeGreaterThan(0);
    expect(printed.length).toBe(1);
    expect(printed[0]).toBe(result.formatted);
  });

  test("does not print when no print sink is provided", () => {
    const result = runRecallWedgeDemo();
    expect(result.report.title).toBe(RECALL_WEDGE_DEMO_REPORT_TITLE);
    expect(result.formatted).toContain(`# ${RECALL_WEDGE_DEMO_REPORT_TITLE}`);
  });

  test("formatted output is deterministic across invocations", () => {
    const a = runRecallWedgeDemo().formatted;
    const b = runRecallWedgeDemo().formatted;
    expect(a).toBe(b);
  });
});

describe("runRecallWedgeDemo · no live integration surface", () => {
  // Static-source guards: the runner must not introduce Discord / Dixie /
  // Straylight / Finn / storage / admission / LLM imports. The cross-
  // interface demo it composes is fixture-bound and so is this runner.
  const moduleSource = (() => {
    // Read the source from disk via the same fileURLToPath trick the demo
    // uses elsewhere — keeps the assertion close to the file under test.
    // Lazy import so test discovery is unaffected.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { dirname, resolve } = require("node:path") as typeof import("node:path");
    const { fileURLToPath } = require("node:url") as typeof import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(resolve(here, "run-demo.ts"), "utf8");
  })();

  // These guards check actual `from "..."` import specifiers — they are
  // intentionally narrower than substring matching because the file's
  // header comment legitimately *names* the integrations it omits.

  test("runner source imports no Discord client", () => {
    expect(moduleSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
  });

  test("runner source imports no Dixie / Straylight / Finn", () => {
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
  });

  test("runner source does not call an LLM SDK", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']openai["']/);
  });

  test("runner source does not pull in pg / production storage", () => {
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
  });

  test("runner source does not register or dispatch Discord commands", () => {
    expect(moduleSource).not.toMatch(/registerCommand\s*\(/);
    expect(moduleSource).not.toMatch(/applicationCommands/);
  });
});
