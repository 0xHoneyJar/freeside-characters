// Phase 35B · explicit dev/operator Recall Wedge demo runner.
//
// Operator ergonomics over the accepted Phase 33D fixture-bound proof
// (docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md, docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md
// §9). This module:
//
//   1. invokes the existing fixture-bound cross-interface demo
//      (`buildRecallWedgeCrossInterfaceDemo`);
//   2. produces a deterministic, operator-readable report that visibly
//      separates public rendered text from internal proof data;
//   3. never copies internal proof fields into public-rendered sections;
//   4. surfaces the proof booleans (same_seed_fixture,
//      same_continuity_actor_internal, different_authorized_views,
//      public_outputs_no_leak) in an explicitly INTERNAL / operator-only
//      section;
//   5. records that the operator-private projection is not publicly
//      renderable;
//   6. emits the public-discord and character-boundary referral
//      rendered text verbatim from the Phase 33C public renderer.
//
// Hard non-goals (per Phase 35B brief and the post-MVP decision map):
// no Discord wiring, no command registration, no Discord API call, no
// production / public API surface, no live Dixie client, no Straylight
// admission, no Finn integration, no production storage, no live memory
// admission, no LLM/voice rewrite. Fixture-bound and deterministic.

import {
  buildRecallWedgeCrossInterfaceDemo,
  loadRecallWedgeFixtures,
  type CrossInterfaceDemo,
  type RecallWedgeFixtureBundle,
} from "./demo-cross-interface.ts";

const NON_GOALS = [
  "no Discord client / command registration / Discord API call",
  "no live Dixie client",
  "no @loa/straylight or @loa/dixie integration",
  "no Finn runtime",
  "no production storage",
  "no live memory admission",
  "no LLM / voice rewrite",
] as const;

export interface RecallWedgeDemoPublicSection {
  readonly view_id: "public_discord" | "character_boundary_referral";
  readonly recall_interface: string;
  readonly render_surface: string;
  readonly rendered_text: string;
}

export interface RecallWedgeDemoInternalProof {
  readonly seed_fixture_id: string;
  readonly continuity_actor_id_internal: string;
  readonly operator_private_view: {
    readonly recall_interface: string;
    readonly render_surface: string;
    readonly publicly_renderable: false;
    readonly reason: string;
  };
  readonly proof: CrossInterfaceDemo["proof"];
}

export interface RecallWedgeDemoReport {
  readonly title: string;
  readonly public_sections: {
    readonly public_discord: RecallWedgeDemoPublicSection;
    readonly character_boundary_referral: RecallWedgeDemoPublicSection;
  };
  readonly internal_proof: RecallWedgeDemoInternalProof;
  readonly non_goals: readonly string[];
}

export const RECALL_WEDGE_DEMO_REPORT_TITLE =
  "Recall Wedge fixture-bound demo" as const;

export const PUBLIC_SECTION_HEADER_PREFIX =
  "Public rendered output: " as const;

export const INTERNAL_PROOF_HEADER =
  "Internal proof summary [INTERNAL / operator-only]" as const;

export const NON_GOALS_HEADER =
  "Non-goals / live integration not present" as const;

function requireRenderedText(
  view: CrossInterfaceDemo["views"]["public_discord"],
  label: string,
): string {
  const text = view.rendered_text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      `recall-wedge run-demo: expected ${label} to be publicly renderable, got reason="${
        view.reason ?? "unknown"
      }"`,
    );
  }
  return text;
}

export function buildRecallWedgeDemoReport(
  fixtures: RecallWedgeFixtureBundle = loadRecallWedgeFixtures(),
): RecallWedgeDemoReport {
  const demo = buildRecallWedgeCrossInterfaceDemo(fixtures);

  const publicDiscord: RecallWedgeDemoPublicSection = {
    view_id: "public_discord",
    recall_interface: demo.views.public_discord.recall_interface,
    render_surface: demo.views.public_discord.render_surface,
    rendered_text: requireRenderedText(
      demo.views.public_discord,
      "public_discord",
    ),
  };

  const referral: RecallWedgeDemoPublicSection = {
    view_id: "character_boundary_referral",
    recall_interface: demo.views.character_boundary_referral.recall_interface,
    render_surface: demo.views.character_boundary_referral.render_surface,
    rendered_text: requireRenderedText(
      demo.views.character_boundary_referral,
      "character_boundary_referral",
    ),
  };

  const internalProof: RecallWedgeDemoInternalProof = {
    seed_fixture_id: demo.seed_fixture_id,
    continuity_actor_id_internal: demo.continuity_actor_id_internal,
    operator_private_view: {
      recall_interface: demo.views.operator_private.recall_interface,
      render_surface: demo.views.operator_private.render_surface,
      publicly_renderable: false,
      reason:
        demo.views.operator_private.reason ??
        "operator_private_not_public_renderable",
    },
    proof: demo.proof,
  };

  return {
    title: RECALL_WEDGE_DEMO_REPORT_TITLE,
    public_sections: {
      public_discord: publicDiscord,
      character_boundary_referral: referral,
    },
    internal_proof: internalProof,
    non_goals: NON_GOALS,
  };
}

function formatPublicSection(section: RecallWedgeDemoPublicSection): string {
  return [
    `## ${PUBLIC_SECTION_HEADER_PREFIX}${section.view_id}`,
    section.rendered_text,
  ].join("\n");
}

function formatInternalProof(proof: RecallWedgeDemoInternalProof): string {
  const lines: string[] = [
    `## ${INTERNAL_PROOF_HEADER}`,
    "the fields below are operator-only and must not be relayed to any",
    "public surface; they are surfaced here for operator inspection of",
    "the accepted MVP proof",
    "",
    `seed_fixture_id (internal): ${proof.seed_fixture_id}`,
    `continuity_actor_id_internal (internal): ${proof.continuity_actor_id_internal}`,
    "",
    "operator_private projection:",
    `  recall_interface: ${proof.operator_private_view.recall_interface}`,
    `  render_surface:   ${proof.operator_private_view.render_surface}`,
    `  publicly_renderable: ${String(
      proof.operator_private_view.publicly_renderable,
    )}`,
    `  reason: ${proof.operator_private_view.reason}`,
    "",
    "proof booleans:",
    `  same_seed_fixture:              ${String(proof.proof.same_seed_fixture)}`,
    `  same_continuity_actor_internal: ${String(
      proof.proof.same_continuity_actor_internal,
    )}`,
    `  different_authorized_views:     ${String(
      proof.proof.different_authorized_views,
    )}`,
    `  public_outputs_no_leak:         ${String(
      proof.proof.public_outputs_no_leak,
    )}`,
  ];
  return lines.join("\n");
}

function formatNonGoals(nonGoals: readonly string[]): string {
  const lines: string[] = [`## ${NON_GOALS_HEADER}`];
  for (const item of nonGoals) lines.push(`- ${item}`);
  return lines.join("\n");
}

export function formatRecallWedgeDemoReport(
  report: RecallWedgeDemoReport,
): string {
  return [
    `# ${report.title}`,
    formatPublicSection(report.public_sections.public_discord),
    formatPublicSection(report.public_sections.character_boundary_referral),
    formatInternalProof(report.internal_proof),
    formatNonGoals(report.non_goals),
  ].join("\n\n");
}

export interface ExtractedPublicSection {
  readonly header: string;
  readonly body: string;
}

// Locate a single public section's body inside a formatted report. Stops at
// the next "## " header or end-of-report. Used by tests to verify that no
// banned substring appears inside any public section.
export function extractFormattedPublicSection(
  formatted: string,
  view_id: RecallWedgeDemoPublicSection["view_id"],
): ExtractedPublicSection {
  const header = `## ${PUBLIC_SECTION_HEADER_PREFIX}${view_id}`;
  const headerIdx = formatted.indexOf(header);
  if (headerIdx < 0) {
    throw new Error(
      `recall-wedge run-demo: public section header not found for ${view_id}`,
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

export interface RunRecallWedgeDemoOptions {
  readonly fixtures?: RecallWedgeFixtureBundle;
  readonly print?: (line: string) => void;
}

export function runRecallWedgeDemo(
  options: RunRecallWedgeDemoOptions = {},
): { readonly report: RecallWedgeDemoReport; readonly formatted: string } {
  const report = buildRecallWedgeDemoReport(options.fixtures);
  const formatted = formatRecallWedgeDemoReport(report);
  if (options.print) options.print(formatted);
  return { report, formatted };
}

const isCli =
  typeof import.meta !== "undefined" &&
  (import.meta as { main?: boolean }).main === true;

if (isCli) {
  runRecallWedgeDemo({ print: (line) => console.log(line) });
}
