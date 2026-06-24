// Phase 36C · explicit dev/operator runner over the recorded Dixie envelope
// fixture corpus.
//
// Composes the Phase 35D pure adapter
// (`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`) and
// the Phase 33C public-safe renderer
// (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`) over
// the Phase 35D + Phase 36B recorded Dixie envelope fixtures shipped under
// `docs/recall-wedge/fixtures/dixie-envelope/`.
//
// Pipeline per fixture:
//
//   recorded Dixie envelope fixture
//     → pure adapter (`adaptDixieEnvelopeToRecallProjection`)
//     → local Recall Wedge projected DTO
//     → public-safe renderer (`renderPublicRecallProjection`), if renderable
//     → deterministic operator-readable section
//
// The runner clearly distinguishes:
//   - positive renderable fixtures — public rendered output, headed with
//     `## ${PUBLIC_SECTION_HEADER_PREFIX}<fixture_file>`;
//   - negative fail-closed fixtures — adapter-error class + stable error
//     code, surfaced ONLY under the INTERNAL / operator-only proof section.
//
// Hard non-goals (per Phase 36A live-boundary decision §10c and the Phase
// 36C brief): no Discord client, no Telegram client, no live Dixie network
// call, no @loa/dixie / @loa/straylight / Finn integration, no production
// storage, no live memory admission, no LLM / voice rewrite, no character
// voice, no `authorized_private_session` positive projection or renderer,
// no `public_telegram` renderer. Fixture-bound, recorded-envelope-bound,
// dev/operator-only, side-effect-free by default.
//
// Recorded fixtures are sample v0 contract probes only — they are not
// production schema authority. Live envelope contract truth must come
// later from a Dixie-side artifact, endpoint contract, or cross-repo
// decision (live-boundary decision §7a).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DixieEnvelopeAdapterError,
  adaptDixieEnvelopeToRecallProjection,
} from "./dixie-envelope-adapter.ts";
import {
  PublicRecallRenderError,
  renderPublicRecallProjection,
} from "./render-public-recall.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/recall-wedge/fixtures/dixie-envelope",
);

// -- public report shape ----------------------------------------------------

export const DIXIE_ENVELOPE_DEMO_REPORT_TITLE =
  "Dixie envelope dev/operator demo (recorded-envelope-bound, pre-live)" as const;

export const PUBLIC_SECTION_HEADER_PREFIX =
  "Public rendered output: " as const;

export const INTERNAL_PROOF_HEADER =
  "Internal proof summary [INTERNAL / operator-only]" as const;

export const NON_GOALS_HEADER =
  "Non-goals / live integration not present" as const;

export const SCOPE_BANNER_LINES = [
  "fixture-bound: recorded Dixie envelope fixtures only",
  "dev/operator only: no public surface delivery",
  "not live Dixie: no live Dixie network call, no live Dixie client",
  "not governed memory admission: this runner does not write to candidate or admitted memory",
  "not production schema authority: recorded fixtures are sample v0 contract probes",
] as const;

const NON_GOALS = [
  "no Discord client / command registration / Discord API call",
  "no Telegram bot / Telegram API call",
  "no live Dixie client",
  "no @loa/dixie or @loa/straylight integration",
  "no Finn runtime",
  "no production storage",
  "no live memory admission",
  "no LLM / voice rewrite",
  "no character-voiced recall",
  "recorded fixtures are not production schema authority",
] as const;

// Each recorded fixture in the Dixie envelope corpus and its expected
// adapter behavior under `adaptDixieEnvelopeToRecallProjection` (the
// broader entry point that respects the envelope's own target_projection).
//
// `expected_class` values:
//   - "positive_renderable" — adapter projects, renderer renders
//   - "negative_fail_closed" — adapter throws DixieEnvelopeAdapterError
//
// `expected_error_code` is the stable error code expected on negatives.
// Choosing `adaptDixieEnvelopeToRecallProjection` deliberately:
//
//   - it surfaces `authorized_private_projection_not_implemented` and
//     `public_telegram_projection_not_implemented` for the negative-target
//     fixtures (the narrow public-only entry point would instead surface
//     `wrong_recall_interface_for_target`, which is correct but generic);
//   - for the missing-target fixture it surfaces
//     `unknown_target_projection` because `pickTarget` runs first;
//   - for the missing-payload fixture it surfaces
//     `missing_public_recall_payload` after target resolution;
//   - for the unknown-version fixture it surfaces
//     `unsupported_dixie_envelope_version` (version check runs first).
//
// These expectations are a published contract for this runner and are
// asserted by `run-dixie-envelope-demo.test.ts`.

export interface DixieEnvelopeFixtureEntry {
  readonly file: string;
  readonly expected_class: "positive_renderable" | "negative_fail_closed";
  readonly expected_error_code?: string;
  readonly description: string;
}

export const DIXIE_ENVELOPE_FIXTURE_CATALOG: readonly DixieEnvelopeFixtureEntry[] =
  [
    {
      file: "recorded-public-discord-recall-envelope.v0.json",
      expected_class: "positive_renderable",
      description: "normal public_discord recall billboard",
    },
    {
      file: "recorded-referral-recall-envelope.v0.json",
      expected_class: "positive_renderable",
      description: "character-boundary referral on public_discord",
    },
    {
      file: "recorded-refusal-unauthorized-envelope.v0.json",
      expected_class: "positive_renderable",
      description:
        "refusal/unauthorized narrowed to public-safe generic-refusal billboard",
    },
    {
      file: "recorded-session-bearing-public-recall-envelope.v0.json",
      expected_class: "positive_renderable",
      description:
        "public_discord recall with synthetic session/message/tenant ids that the adapter must strip",
    },
    {
      file: "recorded-unknown-version-envelope.json",
      expected_class: "negative_fail_closed",
      expected_error_code: "unsupported_dixie_envelope_version",
      description: "envelope_version present but intentionally unsupported",
    },
    {
      file: "recorded-authorized-private-target-envelope.v0.json",
      expected_class: "negative_fail_closed",
      expected_error_code: "authorized_private_projection_not_implemented",
      description:
        "target_projection.recall_interface=authorized_private_session — multi-surface contract §5a authorized-private DTO gate not satisfied",
    },
    {
      file: "recorded-public-telegram-target-envelope.v0.json",
      expected_class: "negative_fail_closed",
      expected_error_code: "public_telegram_projection_not_implemented",
      description:
        "target_projection.recall_interface=public_telegram — multi-surface contract §8a future-renderer warning not satisfied for Telegram",
    },
    {
      file: "recorded-malformed-missing-payload-envelope.v0.json",
      expected_class: "negative_fail_closed",
      expected_error_code: "missing_public_recall_payload",
      description: "supported version + valid target, public_recall_payload absent",
    },
    {
      file: "recorded-malformed-missing-target-envelope.v0.json",
      expected_class: "negative_fail_closed",
      expected_error_code: "unknown_target_projection",
      description:
        "supported version + valid payload, target_projection absent (broader entry point hits target-resolution error first)",
    },
  ] as const;

// -- public types -----------------------------------------------------------

export interface DixieEnvelopePublicSection {
  readonly fixture_file: string;
  readonly description: string;
  readonly rendered_text: string;
}

export interface DixieEnvelopeFailClosedSummary {
  readonly fixture_file: string;
  readonly description: string;
  readonly expected_error_code: string;
  readonly observed_error_code: string;
  readonly matched_expected: boolean;
}

export interface DixieEnvelopeInternalProof {
  readonly counts: {
    readonly total: number;
    readonly positive_renderable: number;
    readonly negative_fail_closed: number;
    readonly positive_rendered_ok: number;
    readonly positive_unexpected_failure: number;
    readonly negative_matched_expected_code: number;
    readonly negative_unexpected_code_or_pass: number;
  };
  readonly fail_closed_summaries: readonly DixieEnvelopeFailClosedSummary[];
  readonly all_negatives_matched_expected: boolean;
  readonly all_positives_rendered_ok: boolean;
}

export interface DixieEnvelopeDemoReport {
  readonly title: string;
  readonly scope_banner: readonly string[];
  readonly public_sections: readonly DixieEnvelopePublicSection[];
  readonly internal_proof: DixieEnvelopeInternalProof;
  readonly non_goals: readonly string[];
}

// -- fixture loading --------------------------------------------------------

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadDixieEnvelopeFixtures(): Readonly<
  Record<string, unknown>
> {
  const out: Record<string, unknown> = {};
  for (const entry of DIXIE_ENVELOPE_FIXTURE_CATALOG) {
    out[entry.file] = loadJson(resolve(FIXTURE_DIR, entry.file));
  }
  return out;
}

// -- adapter / renderer composition ----------------------------------------

type AttemptResult =
  | { readonly kind: "rendered"; readonly text: string }
  | { readonly kind: "adapter_error"; readonly code: string }
  | { readonly kind: "render_error"; readonly code: string }
  | { readonly kind: "unknown_error" };

function attemptAdaptAndRender(envelope: unknown): AttemptResult {
  let dto: unknown;
  try {
    dto = adaptDixieEnvelopeToRecallProjection(envelope);
  } catch (err) {
    if (err instanceof DixieEnvelopeAdapterError) {
      return { kind: "adapter_error", code: err.code };
    }
    return { kind: "unknown_error" };
  }
  try {
    const text = renderPublicRecallProjection(dto);
    return { kind: "rendered", text };
  } catch (err) {
    if (err instanceof PublicRecallRenderError) {
      return { kind: "render_error", code: err.code };
    }
    return { kind: "unknown_error" };
  }
}

// -- report builder --------------------------------------------------------

export interface BuildDixieEnvelopeDemoReportOptions {
  readonly fixtures?: Readonly<Record<string, unknown>>;
}

export function buildDixieEnvelopeDemoReport(
  options: BuildDixieEnvelopeDemoReportOptions = {},
): DixieEnvelopeDemoReport {
  const fixtures = options.fixtures ?? loadDixieEnvelopeFixtures();

  const publicSections: DixieEnvelopePublicSection[] = [];
  const failClosedSummaries: DixieEnvelopeFailClosedSummary[] = [];

  let positiveRenderable = 0;
  let positiveRenderedOk = 0;
  let positiveUnexpectedFailure = 0;
  let negativeFailClosed = 0;
  let negativeMatchedExpected = 0;
  let negativeUnexpected = 0;

  for (const entry of DIXIE_ENVELOPE_FIXTURE_CATALOG) {
    const envelope = fixtures[entry.file];
    const result = attemptAdaptAndRender(envelope);

    if (entry.expected_class === "positive_renderable") {
      positiveRenderable += 1;
      if (result.kind === "rendered") {
        positiveRenderedOk += 1;
        publicSections.push({
          fixture_file: entry.file,
          description: entry.description,
          rendered_text: result.text,
        });
      } else {
        positiveUnexpectedFailure += 1;
        failClosedSummaries.push({
          fixture_file: entry.file,
          description: `UNEXPECTED · positive fixture failed to render — ${entry.description}`,
          expected_error_code: "(none — fixture is positive)",
          observed_error_code:
            result.kind === "adapter_error"
              ? result.code
              : result.kind === "render_error"
                ? result.code
                : "unknown_error",
          matched_expected: false,
        });
      }
      continue;
    }

    // negative_fail_closed
    negativeFailClosed += 1;
    const expected = entry.expected_error_code ?? "(unspecified)";
    if (result.kind === "adapter_error" && result.code === expected) {
      negativeMatchedExpected += 1;
      failClosedSummaries.push({
        fixture_file: entry.file,
        description: entry.description,
        expected_error_code: expected,
        observed_error_code: result.code,
        matched_expected: true,
      });
    } else {
      negativeUnexpected += 1;
      failClosedSummaries.push({
        fixture_file: entry.file,
        description: `UNEXPECTED · ${entry.description}`,
        expected_error_code: expected,
        observed_error_code:
          result.kind === "adapter_error"
            ? result.code
            : result.kind === "render_error"
              ? `(render error) ${result.code}`
              : result.kind === "rendered"
                ? "(rendered — negative fixture did NOT fail closed)"
                : "unknown_error",
        matched_expected: false,
      });
    }
  }

  const internalProof: DixieEnvelopeInternalProof = {
    counts: {
      total: DIXIE_ENVELOPE_FIXTURE_CATALOG.length,
      positive_renderable: positiveRenderable,
      negative_fail_closed: negativeFailClosed,
      positive_rendered_ok: positiveRenderedOk,
      positive_unexpected_failure: positiveUnexpectedFailure,
      negative_matched_expected_code: negativeMatchedExpected,
      negative_unexpected_code_or_pass: negativeUnexpected,
    },
    fail_closed_summaries: failClosedSummaries,
    all_negatives_matched_expected: negativeUnexpected === 0,
    all_positives_rendered_ok: positiveUnexpectedFailure === 0,
  };

  return {
    title: DIXIE_ENVELOPE_DEMO_REPORT_TITLE,
    scope_banner: SCOPE_BANNER_LINES,
    public_sections: publicSections,
    internal_proof: internalProof,
    non_goals: NON_GOALS,
  };
}

// -- formatter -------------------------------------------------------------

function formatScopeBanner(banner: readonly string[]): string {
  const lines: string[] = ["> scope (read me first):"];
  for (const item of banner) lines.push(`> - ${item}`);
  return lines.join("\n");
}

function formatPublicSection(section: DixieEnvelopePublicSection): string {
  return [
    `## ${PUBLIC_SECTION_HEADER_PREFIX}${section.fixture_file}`,
    `description: ${section.description}`,
    "",
    section.rendered_text,
  ].join("\n");
}

function formatInternalProof(proof: DixieEnvelopeInternalProof): string {
  const lines: string[] = [
    `## ${INTERNAL_PROOF_HEADER}`,
    "the fields below are operator-only and must not be relayed to any",
    "public surface; they are surfaced here for operator inspection of",
    "the recorded-envelope-bound proof",
    "",
    "fixture counts:",
    `  total fixtures:                       ${proof.counts.total}`,
    `  positive renderable:                  ${proof.counts.positive_renderable}`,
    `  negative fail-closed:                 ${proof.counts.negative_fail_closed}`,
    `  positive rendered ok:                 ${proof.counts.positive_rendered_ok}`,
    `  positive unexpected failure:          ${proof.counts.positive_unexpected_failure}`,
    `  negative matched expected error code: ${proof.counts.negative_matched_expected_code}`,
    `  negative unexpected code or pass:     ${proof.counts.negative_unexpected_code_or_pass}`,
    "",
    "proof booleans:",
    `  all_positives_rendered_ok:       ${String(proof.all_positives_rendered_ok)}`,
    `  all_negatives_matched_expected:  ${String(proof.all_negatives_matched_expected)}`,
    "",
    "fail-closed summaries [INTERNAL / operator-only]:",
  ];
  if (proof.fail_closed_summaries.length === 0) {
    lines.push("  (none)");
  } else {
    for (const s of proof.fail_closed_summaries) {
      lines.push(`  - fixture: ${s.fixture_file}`);
      lines.push(`    description:    ${s.description}`);
      lines.push(`    expected_code:  ${s.expected_error_code}`);
      lines.push(`    observed_code:  ${s.observed_error_code}`);
      lines.push(`    matched:        ${String(s.matched_expected)}`);
    }
  }
  return lines.join("\n");
}

function formatNonGoals(nonGoals: readonly string[]): string {
  const lines: string[] = [`## ${NON_GOALS_HEADER}`];
  for (const item of nonGoals) lines.push(`- ${item}`);
  return lines.join("\n");
}

export function formatDixieEnvelopeDemoReport(
  report: DixieEnvelopeDemoReport,
): string {
  const parts: string[] = [
    `# ${report.title}`,
    formatScopeBanner(report.scope_banner),
  ];
  for (const section of report.public_sections) {
    parts.push(formatPublicSection(section));
  }
  parts.push(formatInternalProof(report.internal_proof));
  parts.push(formatNonGoals(report.non_goals));
  return parts.join("\n\n");
}

// -- public-section extractor (test helper) --------------------------------

export interface ExtractedDixieEnvelopePublicSection {
  readonly header: string;
  readonly body: string;
}

export function extractFormattedPublicSection(
  formatted: string,
  fixture_file: string,
): ExtractedDixieEnvelopePublicSection {
  const header = `## ${PUBLIC_SECTION_HEADER_PREFIX}${fixture_file}`;
  const headerIdx = formatted.indexOf(header);
  if (headerIdx < 0) {
    throw new Error(
      `run-dixie-envelope-demo: public section header not found for ${fixture_file}`,
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

export interface RunDixieEnvelopeDemoOptions {
  readonly fixtures?: Readonly<Record<string, unknown>>;
  readonly print?: (text: string) => void;
}

export function runDixieEnvelopeDemo(
  options: RunDixieEnvelopeDemoOptions = {},
): {
  readonly report: DixieEnvelopeDemoReport;
  readonly formatted: string;
} {
  const report = buildDixieEnvelopeDemoReport({ fixtures: options.fixtures });
  const formatted = formatDixieEnvelopeDemoReport(report);
  if (options.print) options.print(formatted);
  return { report, formatted };
}

// -- CLI guard --------------------------------------------------------------

const isCli =
  typeof import.meta !== "undefined" &&
  (import.meta as { main?: boolean }).main === true;

if (isCli) {
  runDixieEnvelopeDemo({ print: (line) => console.log(line) });
}
