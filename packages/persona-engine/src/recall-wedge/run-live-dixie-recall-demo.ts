// Phase 37C · operator/dev-only runner over the live Dixie recall client.
//
// Authority: docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md §F.
//
// This runner is the explicit operator/dev entry point that exercises the
// isolated live client (`./live-dixie-client.ts`). It is NOT wired to:
//   - any Discord / Telegram surface,
//   - the public-safe renderer (`./render-public-recall.ts`),
//   - the recorded dixie-envelope adapter (`./dixie-envelope-adapter.ts`),
//   - any storage / admission / LLM / character-voice path.
//
// Invocation discipline:
//   - side-effect-free by default. No print, no fetch, until either the CLI
//     guard runs (operator opts in via env), or a caller injects a print
//     sink and a fake fetch.
//   - the runner does NOT call live Dixie unless the operator explicitly
//     supplies `RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN=true` AND the CLI
//     entry point is reached. Tests always inject a fake fetch.

import {
  LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS,
  LIVE_DIXIE_CLIENT_INTAKE_PATH,
  LiveDixieClientConfigError,
  buildLiveDixieRecallRequestPlan,
  findBannedPublicSubstring,
  liveRecallViaDixie,
  loadLiveDixieClientConfigFromEnv,
  type LiveDixieClientConfig,
  type LiveDixieFetchLike,
  type LiveDixieRecallResult,
  type LiveRecallInput,
} from "./live-dixie-client.ts";

// -- public report shape ---------------------------------------------------

export const LIVE_DIXIE_DEMO_REPORT_TITLE =
  "Live Dixie recall dev/operator demo (operator/dev-only, post-Phase-37B gate)" as const;

export const SCOPE_BANNER_LINES = [
  "operator/dev only: no public surface delivery",
  "live Dixie POST /api/recall/intake — operator-supplied env required",
  "not Discord / not Telegram: no command registration, no bot dispatch",
  "not governed memory admission: this runner does not write candidate or admitted memory",
  "not character voice: operator-readable text only",
  "not the recorded fixture path: this runner uses the live client module, never the recorded adapter",
] as const;

const NON_GOALS = [
  "no Discord client / command registration / Discord API call",
  "no Telegram bot / Telegram API call",
  "no positive public_telegram support",
  "no positive authorized_private_session support",
  "no @loa/dixie / @loa/straylight / Finn integration",
  "no production storage / admission / consent",
  "no live memory admission",
  "no LLM / voice rewrite / character voice",
  "no public renderer expansion",
  "no use of recorded_dixie_recall_envelope on live traffic",
] as const;

const REQUEST_SUMMARY_HEADER =
  "Live request summary (no secrets)" as const;
const CLASSIFICATION_HEADER = "Classification summary" as const;
const PUBLIC_SAFE_HEADER = "Public/operator-safe summary" as const;
const INTERNAL_DIAGNOSTIC_HEADER =
  "Internal diagnostic [INTERNAL / operator-only]" as const;
const NON_GOALS_HEADER =
  "Non-goals / live integration not present" as const;

// -- types -----------------------------------------------------------------

export interface LiveDixieDemoRequestSummary {
  readonly url: string;
  readonly method: "POST";
  readonly idempotency_key_present: boolean;
  readonly idempotency_key_length: number;
  readonly authorization_scheme: "Bearer (redacted)";
  readonly tenant_actor_consistent: boolean;
  readonly body_field_set: readonly string[];
}

export interface LiveDixieDemoReport {
  readonly title: string;
  readonly scope_banner: readonly string[];
  readonly request_summary: LiveDixieDemoRequestSummary | null;
  readonly classification: string;
  readonly public_safe_summary: {
    readonly outcome: string;
    readonly classification: string;
    readonly stable_reason_code: string;
  };
  readonly internal_diagnostic: Readonly<Record<string, unknown>>;
  readonly non_goals: readonly string[];
  readonly config_error: string | null;
}

// -- builders --------------------------------------------------------------

// Only top-level body keys are emitted into operator-public output —
// expanding nested objects would surface field names like `tenant_id` /
// `actor_id` / `session_id` (which appear in Dixie's wire body but are
// also on the public-output banned-substring list). Operators can confirm
// shape from the top-level keys; full structural confirmation belongs in
// internal/operator-only diagnostics, not the public summary.
function summarizeBodyFields(
  body: Readonly<Record<string, unknown>>,
): readonly string[] {
  return Object.keys(body).sort();
}

export interface BuildLiveDixieDemoReportInput {
  readonly input: LiveRecallInput;
  readonly config: LiveDixieClientConfig;
  readonly result: LiveDixieRecallResult;
}

export function buildLiveDixieDemoReport(
  args: BuildLiveDixieDemoReportInput,
): LiveDixieDemoReport {
  let requestSummary: LiveDixieDemoRequestSummary | null = null;
  let configError: string | null = null;
  try {
    const plan = buildLiveDixieRecallRequestPlan(args.input, args.config);
    requestSummary = {
      url: plan.url,
      method: plan.method,
      idempotency_key_present: plan.headers["idempotency-key"]?.length > 0,
      idempotency_key_length: plan.idempotencyKey.length,
      authorization_scheme: "Bearer (redacted)",
      tenant_actor_consistent:
        args.config.tenantId === args.config.callerActorId,
      body_field_set: summarizeBodyFields(plan.body),
    };
  } catch (err) {
    if (err instanceof LiveDixieClientConfigError) {
      configError = err.code;
    } else {
      configError = "unknown_error";
    }
  }

  return {
    title: LIVE_DIXIE_DEMO_REPORT_TITLE,
    scope_banner: SCOPE_BANNER_LINES,
    request_summary: requestSummary,
    classification: args.result.classification,
    public_safe_summary: {
      outcome: args.result.public_summary.outcome,
      classification: args.result.public_summary.classification,
      stable_reason_code: args.result.public_summary.stable_reason_code,
    },
    internal_diagnostic: { ...args.result.internal_diagnostic },
    non_goals: NON_GOALS,
    config_error: configError,
  };
}

// -- formatter -------------------------------------------------------------

function formatScopeBanner(banner: readonly string[]): string {
  const lines: string[] = ["> scope (read me first):"];
  for (const item of banner) lines.push(`> - ${item}`);
  return lines.join("\n");
}

function formatRequestSummary(
  summary: LiveDixieDemoRequestSummary | null,
  configError: string | null,
): string {
  const lines: string[] = [`## ${REQUEST_SUMMARY_HEADER}`];
  if (summary === null) {
    lines.push(
      `request_plan: NOT BUILT (config_error=${configError ?? "unknown"})`,
    );
    lines.push("no live request was issued");
    return lines.join("\n");
  }
  lines.push(`url:                   ${summary.url}`);
  lines.push(`method:                ${summary.method}`);
  lines.push(`route:                 ${LIVE_DIXIE_CLIENT_INTAKE_PATH}`);
  lines.push(`authorization_scheme:  ${summary.authorization_scheme}`);
  lines.push(
    `idempotency_key:       present=${String(summary.idempotency_key_present)} length=${summary.idempotency_key_length}`,
  );
  lines.push(
    `tenant_actor_consistent: ${String(summary.tenant_actor_consistent)}`,
  );
  lines.push(`body_field_set:`);
  for (const f of summary.body_field_set) lines.push(`  - ${f}`);
  return lines.join("\n");
}

function formatClassificationSummary(classification: string): string {
  return [
    `## ${CLASSIFICATION_HEADER}`,
    `classification: ${classification}`,
  ].join("\n");
}

function formatPublicSafe(
  s: LiveDixieDemoReport["public_safe_summary"],
): string {
  return [
    `## ${PUBLIC_SAFE_HEADER}`,
    `outcome:             ${s.outcome}`,
    `classification:      ${s.classification}`,
    `stable_reason_code:  ${s.stable_reason_code}`,
  ].join("\n");
}

function formatInternalDiagnostic(
  diag: Readonly<Record<string, unknown>>,
): string {
  const lines: string[] = [
    `## ${INTERNAL_DIAGNOSTIC_HEADER}`,
    "the fields below are operator-only and must not be relayed to any",
    "public surface; they are surfaced here for operator inspection of",
    "the live spike",
    "",
  ];
  const keys = Object.keys(diag).sort();
  if (keys.length === 0) {
    lines.push("(none)");
  } else {
    for (const k of keys) {
      lines.push(`  ${k}: ${JSON.stringify(diag[k])}`);
    }
  }
  return lines.join("\n");
}

function formatNonGoals(nonGoals: readonly string[]): string {
  const lines: string[] = [`## ${NON_GOALS_HEADER}`];
  for (const item of nonGoals) lines.push(`- ${item}`);
  return lines.join("\n");
}

export function formatLiveDixieDemoReport(report: LiveDixieDemoReport): string {
  return [
    `# ${report.title}`,
    formatScopeBanner(report.scope_banner),
    formatRequestSummary(report.request_summary, report.config_error),
    formatClassificationSummary(report.classification),
    formatPublicSafe(report.public_safe_summary),
    formatInternalDiagnostic(report.internal_diagnostic),
    formatNonGoals(report.non_goals),
  ].join("\n\n");
}

// -- runner ----------------------------------------------------------------

export interface RunLiveDixieRecallDemoOptions {
  readonly env?: Record<string, string | undefined>;
  readonly input?: LiveRecallInput;
  readonly fetch?: LiveDixieFetchLike;
  readonly print?: (text: string) => void;
}

const DEFAULT_OPERATOR_INPUT: LiveRecallInput = {
  recallRequestId: "operator-spike-1",
  task: "operator-dev-recall-spike",
  environmentFrame: "private_chat",
  riskProfile: "low",
  detailLevel: "minimal",
  receiptDetail: "minimal",
  signature: {
    signature_id: "sig_1",
    signer_id: "signer_test",
    signer_type: "actor_controller",
    signature_type: "dev_signature",
    signed_payload_hash:
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    signature: "devsig",
    signed_at: "2026-05-18T00:00:00Z",
    key_ref: "kref_test",
  },
  createdAt: "2026-05-18T00:00:00Z",
};

export async function runLiveDixieRecallDemo(
  options: RunLiveDixieRecallDemoOptions = {},
): Promise<{
  readonly report: LiveDixieDemoReport;
  readonly formatted: string;
}> {
  const env = options.env ?? {};
  const input = options.input ?? DEFAULT_OPERATOR_INPUT;

  let config: LiveDixieClientConfig | null = null;
  let configError: LiveDixieClientConfigError | null = null;
  try {
    config = loadLiveDixieClientConfigFromEnv(env);
  } catch (err) {
    if (err instanceof LiveDixieClientConfigError) {
      configError = err;
    } else {
      throw err;
    }
  }

  let result: LiveDixieRecallResult;
  if (config === null) {
    result = {
      classification:
        configError && configError.code === "missing_required_env"
          ? "missing_required_env"
          : "invalid_config",
      public_summary: {
        outcome: "config_error",
        classification:
          configError && configError.code === "missing_required_env"
            ? "missing_required_env"
            : "invalid_config",
        stable_reason_code:
          configError && configError.code === "missing_required_env"
            ? `missing:${configError.missingEnv ?? "unknown"}`
            : "invalid_config",
      },
      internal_diagnostic: {
        idempotency_key_present: false,
        ...(configError && configError.missingEnv !== undefined
          ? { missing_env: configError.missingEnv }
          : {}),
      },
    };
  } else {
    result = await liveRecallViaDixie(input, config, {
      fetch: options.fetch,
    });
  }

  const report = buildLiveDixieDemoReport({
    input,
    config: config ?? {
      baseUrl: "",
      serviceToken: "",
      tenantId: "",
      callerActorId: "",
      requestKeyPrefix: "",
      timeoutMs: 0,
    },
    result,
  });
  const formatted = formatLiveDixieDemoReport(report);

  // Defense-in-depth: never let banned substrings smuggle into the
  // public-bound sections of the formatted report. If detected, replace
  // the public/classification/request-summary sections with a stable
  // marker rather than printing the contaminated text.
  const publicPortion = extractPublicPortionForScan(formatted);
  if (findBannedPublicSubstring(publicPortion) !== null) {
    const sanitized = formatLiveDixieDemoReport({
      ...report,
      public_safe_summary: {
        outcome: "config_error",
        classification: "unsupported_response_shape",
        stable_reason_code: "public_section_contained_banned_material",
      },
      internal_diagnostic: {
        idempotency_key_present: false,
        sanitized: true,
      },
    });
    if (options.print) options.print(sanitized);
    return { report, formatted: sanitized };
  }

  if (options.print) options.print(formatted);
  return { report, formatted };
}

// Inspect only the operator-public sections of the formatted report (title,
// scope banner, request summary, classification, public-safe summary, and
// non-goals) — exclude the internal diagnostic block, which is allowed to
// carry classification codes whose names overlap with banned substrings
// for downstream inspection only.
function extractPublicPortionForScan(formatted: string): string {
  const internalIdx = formatted.indexOf(`## ${INTERNAL_DIAGNOSTIC_HEADER}`);
  if (internalIdx < 0) return formatted;
  const publicHead = formatted.slice(0, internalIdx);
  const nonGoalsIdx = formatted.indexOf(`## ${NON_GOALS_HEADER}`);
  const nonGoalsTail =
    nonGoalsIdx >= 0 ? formatted.slice(nonGoalsIdx) : "";
  return `${publicHead}\n${nonGoalsTail}`;
}

// -- CLI guard -------------------------------------------------------------

// Phase 37B requires the live runner to be explicitly operator/dev opt-in
// (gate §F). The helper returns true ONLY when the env var is exactly the
// string "true"; any other value (absent, empty, "false", "1", "TRUE", …)
// returns false and the CLI branch must NOT call runLiveDixieRecallDemo
// and must NOT print a report skeleton.
export const RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN_ENV =
  "RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN" as const;

export function shouldRunLiveDixieCli(
  env: Record<string, string | undefined>,
): boolean {
  return env[RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN_ENV] === "true";
}

const isCli =
  typeof import.meta !== "undefined" &&
  (import.meta as { main?: boolean }).main === true;

if (isCli) {
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};
  if (shouldRunLiveDixieCli(env)) {
    runLiveDixieRecallDemo({
      env,
      print: (line) => console.log(line),
    });
  }
  // Without explicit operator opt-in, the CLI is a no-op: no fetch, no
  // print, no skeleton. Operators must set
  // RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN=true to invoke the live spike.
}

// Expose the banned-substring set so other operator/dev tooling in this
// module's test surface can co-locate its no-leak posture.
export { LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS };
