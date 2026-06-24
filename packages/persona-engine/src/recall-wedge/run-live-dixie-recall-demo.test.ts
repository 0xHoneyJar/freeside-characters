// Phase 37C · regression gate for the operator/dev-only runner over the
// live Dixie recall client.
//
// Proves:
//   1. runner is side-effect-free by default — no print, no network call;
//   2. runner prints exactly once through an injected print sink;
//   3. report includes the operator/dev-only scope banner;
//   4. report includes the non-goals section enumerating live integrations
//      not present;
//   5. report does not contain banned private/debug/source substrings in
//      public/operator-public sections, even when Dixie returns hostile
//      payloads;
//   6. runner source imports no Discord / Telegram / storage / LLM / Finn
//      / @loa/dixie / @loa/straylight;
//   7. runner source does not register or dispatch commands;
//   8. runner source does not import the recorded adapter or the public
//      renderer;
//   9. runner does not use recorded_dixie_recall_envelope.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LIVE_DIXIE_DEMO_REPORT_TITLE,
  RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN_ENV,
  SCOPE_BANNER_LINES,
  buildLiveDixieDemoReport,
  formatLiveDixieDemoReport,
  runLiveDixieRecallDemo,
  shouldRunLiveDixieCli,
  type LiveDixieDemoReport,
} from "./run-live-dixie-recall-demo.ts";
import {
  LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS,
  type LiveDixieFetchLike,
  type LiveRecallInput,
} from "./live-dixie-client.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WALLET = "0xabcdef0000000000000000000000000000000001";

function fullEnv(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string | undefined> {
  return {
    RECALL_WEDGE_DIXIE_BASE_URL: "https://dixie.example.test",
    RECALL_WEDGE_DIXIE_SERVICE_TOKEN: "tkn-operator-dev",
    RECALL_WEDGE_DIXIE_TENANT_ID: WALLET,
    RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID: WALLET,
    RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX: "p37c",
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<LiveRecallInput> = {},
): LiveRecallInput {
  return {
    recallRequestId: "rr-runner-1",
    task: "operator-runner-test",
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
    idempotencyKey: "runner-test-key",
    ...overrides,
  };
}

function fetchReturning(
  status: number,
  body: unknown,
  bodyOverride?: string,
): LiveDixieFetchLike {
  return async () => ({
    status,
    text: async () =>
      bodyOverride !== undefined
        ? bodyOverride
        : body === undefined
          ? ""
          : JSON.stringify(body),
  });
}

// Sections allowed to surface in the operator-public output, before the
// internal-diagnostic header. The `runner` post-processing step never
// strips banned substrings from the internal diagnostic; only the public
// portion is asserted here.
function publicPortionOf(formatted: string): string {
  const idx = formatted.indexOf(
    "## Internal diagnostic [INTERNAL / operator-only]",
  );
  return idx < 0 ? formatted : formatted.slice(0, idx);
}

// -- 1. side-effect-free invocation ----------------------------------------

describe("runLiveDixieRecallDemo · invocation surface", () => {
  test("no env supplied: returns a config_error report without printing or fetching", async () => {
    let calls = 0;
    const fetchSpy: LiveDixieFetchLike = async () => {
      calls += 1;
      return { status: 200, text: async () => "" };
    };
    const original = console.log;
    let logCalls = 0;
    console.log = () => {
      logCalls += 1;
    };
    try {
      const r = await runLiveDixieRecallDemo({ env: {}, fetch: fetchSpy });
      expect(r.report.config_error).not.toBeNull();
      expect(r.report.classification).toBe("missing_required_env");
      expect(r.report.public_safe_summary.outcome).toBe("config_error");
    } finally {
      console.log = original;
    }
    expect(calls).toBe(0);
    expect(logCalls).toBe(0);
  });

  test("prints exactly once through an injected print sink", async () => {
    const printed: string[] = [];
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, {
        outcome: "served",
        redacted_count: 0,
        redacted_counts_by_reason: [],
      }),
      print: (line) => printed.push(line),
    });
    expect(printed.length).toBe(1);
    expect(printed[0]).toBe(r.formatted);
  });

  test("does not call console.log when no print sink is provided (side-effect-free)", async () => {
    const original = console.log;
    let calls = 0;
    console.log = () => {
      calls += 1;
    };
    try {
      await runLiveDixieRecallDemo({
        env: fullEnv(),
        input: makeInput(),
        fetch: fetchReturning(200, { outcome: "served" }),
      });
    } finally {
      console.log = original;
    }
    expect(calls).toBe(0);
  });

  test("returns a report with the documented title", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    expect(r.report.title).toBe(LIVE_DIXIE_DEMO_REPORT_TITLE);
  });
});

// -- 2. report structure ---------------------------------------------------

describe("runLiveDixieRecallDemo · report structure", () => {
  test("scope banner declares operator/dev only, live route, not Discord/Telegram, not memory admission", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    expect(r.formatted).toContain("operator/dev only");
    expect(r.formatted).toContain("live Dixie POST /api/recall/intake");
    expect(r.formatted).toContain("not Discord / not Telegram");
    expect(r.formatted).toContain("not governed memory admission");
    expect(r.formatted).toContain("not character voice");
  });

  test("non-goals section enumerates the live integrations not present", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    const formatted = r.formatted;
    expect(formatted).toContain(
      "## Non-goals / live integration not present",
    );
    expect(formatted).toContain("no Discord");
    expect(formatted).toContain("no Telegram");
    expect(formatted).toContain("no positive public_telegram support");
    expect(formatted).toContain(
      "no positive authorized_private_session support",
    );
    expect(formatted).toContain("no live memory admission");
    expect(formatted).toContain("no LLM / voice rewrite / character voice");
    expect(formatted).toContain(
      "no use of recorded_dixie_recall_envelope on live traffic",
    );
  });

  test("includes a request summary referencing /api/recall/intake without raw secrets", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv({ RECALL_WEDGE_DIXIE_SERVICE_TOKEN: "SECRET_TOKEN_VALUE" }),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    expect(r.formatted).toContain("## Live request summary (no secrets)");
    expect(r.formatted).toContain("/api/recall/intake");
    expect(r.formatted).toContain("Bearer (redacted)");
    expect(r.formatted).not.toContain("SECRET_TOKEN_VALUE");
  });

  test("classification summary reflects the live result classification", async () => {
    const denied = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(403, {
        outcome: "denied",
        error: "seam.privacy_scope_refusal",
      }),
    });
    expect(denied.report.classification).toBe("denied_or_forbidden");
    expect(denied.formatted).toContain(
      "classification: denied_or_forbidden",
    );
  });

  test("public/operator-safe summary section is structured separately from internal diagnostic", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    const publicIdx = r.formatted.indexOf(
      "## Public/operator-safe summary",
    );
    const internalIdx = r.formatted.indexOf(
      "## Internal diagnostic [INTERNAL / operator-only]",
    );
    expect(publicIdx).toBeGreaterThan(-1);
    expect(internalIdx).toBeGreaterThan(publicIdx);
  });

  test("internal diagnostic section is labeled INTERNAL / operator-only", async () => {
    const r = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    expect(r.formatted).toContain(
      "## Internal diagnostic [INTERNAL / operator-only]",
    );
    expect(r.formatted).toContain(
      "the fields below are operator-only and must not be relayed",
    );
  });

  test("scope banner exports the documented lines", () => {
    expect(SCOPE_BANNER_LINES.length).toBeGreaterThan(0);
    for (const line of SCOPE_BANNER_LINES) {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

// -- 3. no-leak in public/operator-public sections -------------------------

describe("runLiveDixieRecallDemo · operator-public sections never leak banned material", () => {
  for (const scenario of [
    {
      name: "served body",
      status: 200,
      body: { outcome: "served", redacted_count: 0 },
    },
    {
      name: "user-level recall denial",
      status: 403,
      body: { outcome: "denied", error: "seam.privacy_scope_refusal" },
    },
    {
      name: "service-auth refused",
      status: 401,
      body: {
        outcome: "denied",
        error: "ingress.unauthenticated",
        message: "wallet required",
      },
    },
    {
      name: "ingress invalid request with hostile error class",
      status: 400,
      body: {
        outcome: "denied",
        error: "ingress.something_with_session_id_in_name",
        message: "raw_reasons should not leak",
        raw_reasons: ["raw_reasons:PRIVATE_SENTINEL"],
      },
    },
    {
      name: "upstream 503 with raw debug payload",
      status: 503,
      body: {
        outcome: "denied",
        error: "seam.totally_unknown_class_with_raw_dixie_debug",
        raw_dixie_debug: { hidden: "estate" },
        raw_reasons: ["source_material:leak"],
      },
    },
    {
      name: "non-JSON body",
      status: 200,
      body: undefined,
      override: "<<not json>>",
    },
  ] as const) {
    test(`public portion is clean for ${scenario.name}`, async () => {
      const r = await runLiveDixieRecallDemo({
        env: fullEnv(),
        input: makeInput(),
        fetch: fetchReturning(
          scenario.status,
          scenario.body,
          (scenario as { override?: string }).override,
        ),
      });
      const publicPortion = publicPortionOf(r.formatted);
      for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
        expect(publicPortion).not.toContain(banned);
      }
    });
  }

  test("missing-env config_error report never leaks token / env values into public portion", async () => {
    const r = await runLiveDixieRecallDemo({
      env: {
        RECALL_WEDGE_DIXIE_BASE_URL: "https://dixie.example.test",
        RECALL_WEDGE_DIXIE_SERVICE_TOKEN: "VERY_SECRET_TOKEN_123",
        RECALL_WEDGE_DIXIE_TENANT_ID: WALLET,
        RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID: WALLET,
        RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX: "",
      },
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served" }),
    });
    expect(r.formatted).not.toContain("VERY_SECRET_TOKEN_123");
    const publicPortion = publicPortionOf(r.formatted);
    for (const banned of LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS) {
      expect(publicPortion).not.toContain(banned);
    }
  });
});

// -- 4. report builder direct test -----------------------------------------

describe("buildLiveDixieDemoReport · directly", () => {
  test("config_error null when input is well-formed", () => {
    const result = {
      classification: "served",
      public_summary: {
        outcome: "served",
        classification: "served",
        stable_reason_code: "served",
      },
      internal_diagnostic: {
        idempotency_key_present: true,
        http_status: 200,
        observed_outcome: "served",
        fingerprint: "fnv1a64:0000000000000000",
      },
    } as const;
    const report: LiveDixieDemoReport = buildLiveDixieDemoReport({
      input: makeInput(),
      config: {
        baseUrl: "https://dixie.example.test",
        serviceToken: "tkn-1",
        tenantId: WALLET,
        callerActorId: WALLET,
        requestKeyPrefix: "p37c",
        timeoutMs: 10_000,
      },
      result,
    });
    expect(report.config_error).toBeNull();
    expect(report.request_summary).not.toBeNull();
    expect(report.request_summary!.url).toBe(
      "https://dixie.example.test/api/recall/intake",
    );
    expect(report.public_safe_summary.outcome).toBe("served");
  });
});

// -- 5. format determinism -------------------------------------------------

describe("formatLiveDixieDemoReport · determinism", () => {
  test("formatted output is deterministic across invocations with same inputs", async () => {
    const a = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served", redacted_count: 0 }),
    });
    const b = await runLiveDixieRecallDemo({
      env: fullEnv(),
      input: makeInput(),
      fetch: fetchReturning(200, { outcome: "served", redacted_count: 0 }),
    });
    expect(a.formatted).toBe(b.formatted);
  });
});

// -- 6. static source guards ----------------------------------------------

describe("run-live-dixie-recall-demo.ts · static source guards", () => {
  const moduleSource = readFileSync(
    resolve(__dirname, "run-live-dixie-recall-demo.ts"),
    "utf8",
  );

  test("imports no Discord client", () => {
    expect(moduleSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
  });

  test("imports no Telegram client", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*node-telegram[^"']*["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']telegraf["']/);
    expect(moduleSource).not.toMatch(/from\s+["']grammy["']/);
  });

  test("imports no production storage / cache clients", () => {
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
    expect(moduleSource).not.toMatch(/from\s+["']redis["']/);
    expect(moduleSource).not.toMatch(/from\s+["']ioredis["']/);
  });

  test("imports no LLM SDK", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(moduleSource).not.toMatch(/from\s+["']@anthropic-ai\/sdk["']/);
    expect(moduleSource).not.toMatch(/from\s+["']openai["']/);
  });

  test("imports no Finn / @loa/dixie / @loa/straylight runtime dependency", () => {
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(moduleSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
  });

  test("does not import the recorded dixie-envelope adapter", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
  });

  test("does not import the public-safe renderer", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
  });

  test("does not register or dispatch Discord / Telegram commands", () => {
    expect(moduleSource).not.toMatch(/registerCommand\s*\(/);
    expect(moduleSource).not.toMatch(/applicationCommands/);
    expect(moduleSource).not.toMatch(/sendMessage\s*\(/);
    expect(moduleSource).not.toMatch(/createWebhook\s*\(/);
  });

  test("does not import low-level network or process primitives", () => {
    expect(moduleSource).not.toMatch(/from\s+["']node:http["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:https["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:net["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:tls["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:child_process["']/);
  });

  test("does not use recorded_dixie_recall_envelope as a wire kind", () => {
    // Like the live client test, the only allowed mention is in a comment
    // that explicitly forbids the use. Regex: token must be preceded by
    // either "no use of " (the non-goal phrase) or a comment / scope
    // banner phrase.
    const all = moduleSource;
    const hits = [...all.matchAll(/recorded_dixie_recall_envelope/g)];
    for (const m of hits) {
      const before = all.slice(Math.max(0, m.index - 80), m.index);
      const commented =
        /no use of $/.test(before) ||
        /not the recorded fixture path/.test(before) ||
        /\/\/ /.test(before.split("\n").pop() ?? "");
      expect(commented).toBe(true);
    }
  });

  test("CLI guard branch only invokes runLiveDixieRecallDemo when shouldRunLiveDixieCli is true", () => {
    // Phase 37B requires the live runner to be explicit operator/dev opt-in.
    // The non-opt-in branch must NOT call runLiveDixieRecallDemo and must
    // NOT print a report skeleton.
    //
    // Locate the `if (isCli) { ... }` block and its inner branching, and
    // assert structural shape: the only invocation of
    // runLiveDixieRecallDemo inside the CLI block is gated by
    // shouldRunLiveDixieCli(env), and there is no fallback branch that
    // calls runLiveDixieRecallDemo without the opt-in.
    const cliBlockMatch = moduleSource.match(
      /if\s*\(\s*isCli\s*\)\s*\{[\s\S]*?\n\}/,
    );
    expect(cliBlockMatch).not.toBeNull();
    const cliBlock = cliBlockMatch![0];

    // Must reference shouldRunLiveDixieCli — the only way to reach the
    // runner inside the CLI block.
    expect(cliBlock).toContain("shouldRunLiveDixieCli");

    // The total number of `runLiveDixieRecallDemo(` invocations in the CLI
    // block must equal the number reached only after the opt-in helper
    // returns true. With one gated invocation, that count is exactly 1.
    const invocationCount = (
      cliBlock.match(/runLiveDixieRecallDemo\s*\(/g) ?? []
    ).length;
    expect(invocationCount).toBe(1);

    // No `else` / fallback path that prints anything in the CLI block.
    expect(cliBlock).not.toMatch(/else\s*\{[^}]*console\.log/);
    expect(cliBlock).not.toMatch(/else\s*\{[^}]*print/);
    // The gated invocation must come from inside the truthy branch of
    // shouldRunLiveDixieCli.
    const truthyBranch = cliBlock.match(
      /if\s*\(\s*shouldRunLiveDixieCli\([^)]*\)\s*\)\s*\{([\s\S]*?)\n {2}\}/,
    );
    expect(truthyBranch).not.toBeNull();
    expect(truthyBranch![1]).toContain("runLiveDixieRecallDemo");
  });
});

// -- 7. CLI opt-in helper -------------------------------------------------

describe("shouldRunLiveDixieCli · explicit operator opt-in", () => {
  test("env var name is the documented one", () => {
    expect(RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN_ENV).toBe(
      "RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN",
    );
  });

  test('returns true ONLY when the env var equals "true" (lowercase, exact)', () => {
    expect(
      shouldRunLiveDixieCli({
        RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN: "true",
      }),
    ).toBe(true);
  });

  test("returns false when env var is absent", () => {
    expect(shouldRunLiveDixieCli({})).toBe(false);
  });

  test("returns false when env var is empty / false / any other value", () => {
    for (const v of [
      "",
      "false",
      "FALSE",
      "True",
      "TRUE",
      "1",
      "0",
      "yes",
      "no",
      " true",
      "true ",
      "y",
    ]) {
      expect(
        shouldRunLiveDixieCli({
          RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN: v,
        }),
      ).toBe(false);
    }
  });

  test("undefined env var value returns false", () => {
    const env: Record<string, string | undefined> = {
      RECALL_WEDGE_LIVE_DIXIE_RUNNER_OPT_IN: undefined,
    };
    expect(shouldRunLiveDixieCli(env)).toBe(false);
  });
});
