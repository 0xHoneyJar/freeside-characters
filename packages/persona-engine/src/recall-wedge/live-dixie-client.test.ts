// Phase 37C · regression gate for the operator/dev-only live Dixie recall
// client. Authority: docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md §K.
//
// Proves:
//   1. config / env loader fails closed on missing or invalid env, no
//      network call;
//   2. request plan targets exactly POST /api/recall/intake, includes
//      Idempotency-Key, includes the documented Dixie wire body shape,
//      includes Bearer service auth, and never carries
//      recorded_dixie_recall_envelope;
//   3. unsafe Idempotency-Key reuse with different content is detected
//      before any network call;
//   4. response classification cleanly partitions served / denied /
//      needs_review / ingress / service-auth / tenant-mismatch /
//      rate-limit / upstream / network / unsupported shapes;
//   5. raw / private / debug / source sentinels never reach the
//      operator-public public_summary fields, even when Dixie returns a
//      contaminated body or unknown error class;
//   6. live client source imports no Discord / Telegram / storage / LLM /
//      Finn / @loa/dixie / @loa/straylight runtime dependency, and does
//      not import dixie-envelope-adapter.ts or render-public-recall.ts.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS,
  LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS,
  LIVE_DIXIE_CLIENT_INTAKE_PATH,
  LIVE_DIXIE_CLIENT_MAX_TIMEOUT_MS,
  LIVE_DIXIE_DISALLOWED_ENVIRONMENT_FRAMES,
  LIVE_DIXIE_RECALL_CLASSIFICATIONS,
  RECALL_DEV_SEED_KEY_REF,
  RECALL_DEV_SEED_SIGNER_ID,
  RECALL_DEV_SEED_SIGNER_TYPE,
  LiveDixieClientConfigError,
  buildDevSeededRecallSignature,
  buildLiveDixieRecallRequestPlan,
  computeDevSeededSignature,
  computeDevSeededSignedPayloadHash,
  computeLiveDixieRequestFingerprint,
  createIdempotencyReuseDetector,
  findBannedPublicSubstring,
  liveRecallViaDixie,
  loadLiveDixieClientConfigFromEnv,
  type LiveDixieClientConfig,
  type LiveDixieFetchLike,
  type LiveRecallInput,
} from "./live-dixie-client.ts";
import { createHash, createHmac } from "node:crypto";

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

function buildConfig(
  overrides: Partial<LiveDixieClientConfig> = {},
): LiveDixieClientConfig {
  return {
    baseUrl: "https://dixie.example.test",
    serviceToken: "tkn-operator-dev",
    tenantId: WALLET,
    callerActorId: WALLET,
    requestKeyPrefix: "p37c",
    timeoutMs: LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS,
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<LiveRecallInput> = {},
): LiveRecallInput {
  return {
    recallRequestId: "rr-1",
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
    idempotencyKey: "fixed-key-1",
    ...overrides,
  };
}

// -- 1. config / env -------------------------------------------------------

describe("loadLiveDixieClientConfigFromEnv · fail-closed env handling", () => {
  test("loads a complete config from a valid env object", () => {
    const cfg = loadLiveDixieClientConfigFromEnv(fullEnv());
    expect(cfg.baseUrl).toBe("https://dixie.example.test");
    expect(cfg.serviceToken).toBe("tkn-operator-dev");
    expect(cfg.tenantId).toBe(WALLET);
    expect(cfg.callerActorId).toBe(WALLET);
    expect(cfg.requestKeyPrefix).toBe("p37c");
    expect(cfg.timeoutMs).toBe(LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS);
  });

  test("uses conservative default timeout when RECALL_WEDGE_DIXIE_TIMEOUT_MS unset", () => {
    const cfg = loadLiveDixieClientConfigFromEnv(fullEnv());
    expect(cfg.timeoutMs).toBe(LIVE_DIXIE_CLIENT_DEFAULT_TIMEOUT_MS);
  });

  test("respects explicit timeout when within ceiling", () => {
    const cfg = loadLiveDixieClientConfigFromEnv(
      fullEnv({ RECALL_WEDGE_DIXIE_TIMEOUT_MS: "2000" }),
    );
    expect(cfg.timeoutMs).toBe(2000);
  });

  test("rejects invalid timeout values fail-closed", () => {
    expect(() =>
      loadLiveDixieClientConfigFromEnv(
        fullEnv({ RECALL_WEDGE_DIXIE_TIMEOUT_MS: "abc" }),
      ),
    ).toThrow(LiveDixieClientConfigError);
    expect(() =>
      loadLiveDixieClientConfigFromEnv(
        fullEnv({ RECALL_WEDGE_DIXIE_TIMEOUT_MS: "-1" }),
      ),
    ).toThrow(LiveDixieClientConfigError);
    expect(() =>
      loadLiveDixieClientConfigFromEnv(
        fullEnv({
          RECALL_WEDGE_DIXIE_TIMEOUT_MS: String(
            LIVE_DIXIE_CLIENT_MAX_TIMEOUT_MS + 1,
          ),
        }),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  test("rejects invalid base URL fail-closed", () => {
    expect(() =>
      loadLiveDixieClientConfigFromEnv(
        fullEnv({ RECALL_WEDGE_DIXIE_BASE_URL: "not-a-url" }),
      ),
    ).toThrow(LiveDixieClientConfigError);
    expect(() =>
      loadLiveDixieClientConfigFromEnv(
        fullEnv({ RECALL_WEDGE_DIXIE_BASE_URL: "ftp://example.test" }),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  for (const required of [
    "RECALL_WEDGE_DIXIE_BASE_URL",
    "RECALL_WEDGE_DIXIE_SERVICE_TOKEN",
    "RECALL_WEDGE_DIXIE_TENANT_ID",
    "RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID",
    "RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX",
  ] as const) {
    test(`missing ${required} fails closed before any network`, () => {
      const env = fullEnv({ [required]: "" });
      expect(() => loadLiveDixieClientConfigFromEnv(env)).toThrow(
        LiveDixieClientConfigError,
      );
    });

    test(`undefined ${required} fails closed before any network`, () => {
      const env: Record<string, string | undefined> = fullEnv();
      env[required] = undefined;
      expect(() => loadLiveDixieClientConfigFromEnv(env)).toThrow(
        LiveDixieClientConfigError,
      );
    });
  }

  test("liveRecallViaDixie reports missing_required_env without calling fetch when env incomplete", async () => {
    const calls: number[] = [];
    const fakeFetch: LiveDixieFetchLike = async () => {
      calls.push(1);
      return { status: 200, text: async () => "" };
    };
    // Build an obviously-invalid config (empty serviceToken) and watch the
    // path in liveRecallViaDixie that converts buildLiveDixieRecallRequestPlan
    // errors into a fail-closed result.
    const result = await liveRecallViaDixie(
      buildInput(),
      buildConfig({ serviceToken: "" }),
      { fetch: fakeFetch },
    );
    expect(result.classification).toBe("missing_required_env");
    expect(result.public_summary.outcome).toBe("config_error");
    expect(calls.length).toBe(0);
  });
});

// -- 2. request building ---------------------------------------------------

describe("buildLiveDixieRecallRequestPlan · request shape per Dixie Phase 32E", () => {
  test("targets exactly POST /api/recall/intake on the configured base URL", () => {
    const plan = buildLiveDixieRecallRequestPlan(buildInput(), buildConfig());
    expect(plan.method).toBe("POST");
    expect(plan.url).toBe(
      `https://dixie.example.test${LIVE_DIXIE_CLIENT_INTAKE_PATH}`,
    );
    expect(LIVE_DIXIE_CLIENT_INTAKE_PATH).toBe("/api/recall/intake");
  });

  test("includes Idempotency-Key header (operator-supplied or generated)", () => {
    const explicit = buildLiveDixieRecallRequestPlan(
      buildInput({ idempotencyKey: "op-1" }),
      buildConfig(),
    );
    expect(explicit.headers["idempotency-key"]).toBe("op-1");
    expect(explicit.idempotencyKey).toBe("op-1");

    const generated = buildLiveDixieRecallRequestPlan(
      buildInput({ idempotencyKey: undefined }),
      buildConfig(),
    );
    expect(generated.headers["idempotency-key"]).toBeTruthy();
    expect(generated.headers["idempotency-key"].startsWith("p37c-")).toBe(
      true,
    );
  });

  test("attaches Bearer service auth from config (per Dixie route Authorization handling)", () => {
    const plan = buildLiveDixieRecallRequestPlan(
      buildInput(),
      buildConfig({ serviceToken: "tkn-secret-x" }),
    );
    expect(plan.headers["authorization"]).toBe("Bearer tkn-secret-x");
  });

  test("body matches the Dixie wedge-aligned wire shape (Phase 32E §2 / route.ts ingress schema)", () => {
    const plan = buildLiveDixieRecallRequestPlan(buildInput(), buildConfig());
    const body = plan.body as Record<string, unknown>;

    expect(body.detail_level).toBe("minimal");
    const caller = body.caller as Record<string, unknown>;
    expect(caller.tenant_id).toBe(WALLET);
    expect(caller.actor_id).toBe(WALLET);

    const request = body.request as Record<string, unknown>;
    expect(request.recall_request_id).toBe("rr-1");
    expect(request.actor_id).toBe(WALLET);
    expect(request.estate_id).toBe(WALLET);
    expect(request.requested_by).toBe(WALLET);
    expect(request.task).toBe("operator-dev-recall-spike");
    expect(request.environment_frame).toBe("private_chat");
    expect(request.risk_profile).toBe("low");
    expect(request.include_receipt_detail).toBe("minimal");

    const sig = request.signature as Record<string, unknown>;
    expect(sig.signature_id).toBe("sig_1");
    expect(sig.signer_id).toBe("signer_test");
    expect(sig.signer_type).toBe("actor_controller");
    expect(sig.signature_type).toBe("dev_signature");
    expect(sig.signed_at).toBe("2026-05-18T00:00:00Z");
    expect(sig.key_ref).toBe("kref_test");
  });

  test("body never carries recorded_dixie_recall_envelope or recorded probe markers", () => {
    const plan = buildLiveDixieRecallRequestPlan(buildInput(), buildConfig());
    const wire = JSON.stringify(plan.body);
    expect(wire).not.toContain("recorded_dixie_recall_envelope");
    expect(wire).not.toContain("input_envelope_kind");
    expect(wire).not.toContain("recall_wedge.dixie_envelope");
    expect(wire).not.toContain("envelope_version");
    expect(wire).not.toContain("public_recall_payload");
    expect(wire).not.toContain("target_projection");
  });

  test("rejects mismatched tenantId / callerActorId fail-closed (Dixie §3.d authoritative-tenant rule)", () => {
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        buildInput(),
        buildConfig({
          tenantId: WALLET,
          callerActorId: "0x9999999999999999999999999999999999999999",
        }),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  test("rejects empty Idempotency-Key fail-closed", () => {
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        buildInput({ idempotencyKey: "" }),
        buildConfig({ requestKeyPrefix: "" }),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  test("rejects oversized Idempotency-Key fail-closed (Dixie 1-256 char ceiling)", () => {
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        buildInput({ idempotencyKey: "x".repeat(257) }),
        buildConfig(),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  test("rejects unsupported environment frame / risk / detail levels", () => {
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        // @ts-expect-error testing runtime guard
        buildInput({ environmentFrame: "actor_private_unsupported" }),
        buildConfig(),
      ),
    ).toThrow(LiveDixieClientConfigError);
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        // @ts-expect-error testing runtime guard
        buildInput({ riskProfile: "extreme" }),
        buildConfig(),
      ),
    ).toThrow(LiveDixieClientConfigError);
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        // @ts-expect-error testing runtime guard
        buildInput({ detailLevel: "verbose" }),
        buildConfig(),
      ),
    ).toThrow(LiveDixieClientConfigError);
  });

  test("Phase 37C non-goal: public_telegram environment frame fails closed before fetch", async () => {
    expect(LIVE_DIXIE_DISALLOWED_ENVIRONMENT_FRAMES).toContain(
      "public_telegram",
    );
    expect(() =>
      buildLiveDixieRecallRequestPlan(
        // @ts-expect-error public_telegram is intentionally not a typed value
        buildInput({ environmentFrame: "public_telegram" }),
        buildConfig(),
      ),
    ).toThrow(LiveDixieClientConfigError);

    let calls = 0;
    const fakeFetch: LiveDixieFetchLike = async () => {
      calls += 1;
      return { status: 200, text: async () => "" };
    };
    const r = await liveRecallViaDixie(
      // @ts-expect-error public_telegram is intentionally not a typed value
      buildInput({ environmentFrame: "public_telegram" }),
      buildConfig(),
      { fetch: fakeFetch },
    );
    expect(r.classification).toBe("invalid_config");
    expect(r.public_summary.outcome).toBe("config_error");
    expect(calls).toBe(0);
  });

  test("Phase 37C non-goal: public_telegram never appears as an accepted live request value in the wire body", () => {
    // Sweep every successfully-built request plan body across the
    // currently-allowed environment frames. None of them should serialize
    // `public_telegram` as the accepted environment_frame value.
    const allowed: readonly string[] = [
      "private_operator",
      "private_chat",
      "public_discord",
      "repo_workflow",
      "tool_action_precheck",
      "audit_review",
    ];
    for (const frame of allowed) {
      const plan = buildLiveDixieRecallRequestPlan(
        buildInput({ environmentFrame: frame as never }),
        buildConfig(),
      );
      const wire = JSON.stringify(plan.body);
      expect(wire).not.toContain('"environment_frame":"public_telegram"');
    }
  });
});

describe("idempotency · key/content fingerprinting", () => {
  test("computeLiveDixieRequestFingerprint is deterministic for identical content", () => {
    const a = buildLiveDixieRecallRequestPlan(buildInput(), buildConfig())
      .body as Record<string, unknown>;
    const b = buildLiveDixieRecallRequestPlan(buildInput(), buildConfig())
      .body as Record<string, unknown>;
    expect(computeLiveDixieRequestFingerprint(a)).toBe(
      computeLiveDixieRequestFingerprint(b),
    );
  });

  test("different content yields a different fingerprint (helper detects mismatch)", () => {
    const a = buildLiveDixieRecallRequestPlan(
      buildInput({ task: "task-A" }),
      buildConfig(),
    ).body as Record<string, unknown>;
    const b = buildLiveDixieRecallRequestPlan(
      buildInput({ task: "task-B" }),
      buildConfig(),
    ).body as Record<string, unknown>;
    expect(computeLiveDixieRequestFingerprint(a)).not.toBe(
      computeLiveDixieRequestFingerprint(b),
    );
  });

  test("reuse detector flags same key + different content as unsafe", () => {
    const det = createIdempotencyReuseDetector();
    expect(det.observe(WALLET, WALLET, "k1", "fp-1")).toBe("ok");
    expect(det.observe(WALLET, WALLET, "k1", "fp-1")).toBe("ok");
    expect(det.observe(WALLET, WALLET, "k1", "fp-2")).toBe("unsafe_reuse");
  });

  test("liveRecallViaDixie surfaces unsafe_idempotency_key_reuse before any network call", async () => {
    let calls = 0;
    const fakeFetch: LiveDixieFetchLike = async () => {
      calls += 1;
      return {
        status: 200,
        text: async () =>
          JSON.stringify({ outcome: "served", redacted_count: 0 }),
      };
    };
    const detector = createIdempotencyReuseDetector();
    const ok = await liveRecallViaDixie(
      buildInput({ idempotencyKey: "shared-key", task: "first" }),
      buildConfig(),
      { fetch: fakeFetch, idempotencyDetector: detector },
    );
    expect(ok.classification).toBe("served");

    const unsafe = await liveRecallViaDixie(
      buildInput({ idempotencyKey: "shared-key", task: "second-different" }),
      buildConfig(),
      { fetch: fakeFetch, idempotencyDetector: detector },
    );
    expect(unsafe.classification).toBe("unsafe_idempotency_key_reuse");
    expect(unsafe.public_summary.stable_reason_code).toBe(
      "idempotency_key_content_mismatch",
    );
    // Only the first call hit the fake network; the second short-circuited.
    expect(calls).toBe(1);
  });
});

// -- 2b. Phase 32K dev/operator seeded-estate signature -------------------

describe("dev-seeded-estate signature · Phase 32K dev-sign algorithm", () => {
  // Independent re-implementation of Dixie Phase 32K's canonicalize → sha256 →
  // hmac, as the source of truth this client must match byte-for-byte
  // (mirrors ../loa-dixie/.../dev-seeded-live-estate.test.ts).
  function canonicalize(v: unknown): string {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return JSON.stringify(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];
      for (const k of keys) {
        const child = obj[k];
        if (child === undefined) continue;
        parts.push(JSON.stringify(k) + ":" + canonicalize(child));
      }
      return "{" + parts.join(",") + "}";
    }
    throw new Error(`canonicalize: unsupported type ${typeof v}`);
  }
  function refSha256Of(value: unknown): string {
    const bytes = typeof value === "string" ? value : canonicalize(value);
    return "sha256:" + createHash("sha256").update(bytes).digest("hex");
  }
  function refDevSignatureFor(keyRef: string, payloadHash: string): string {
    return `dev:${createHmac("sha256", keyRef).update(payloadHash).digest("hex")}`;
  }

  const PAYLOAD = {
    actor_id: WALLET,
    estate_id: WALLET,
    task: "phase-32k-dev-seed-smoke",
    environment_frame: "private_chat",
    risk_profile: "low",
  };

  test("exports the PUBLIC Phase 32K dev-seed labels verbatim", () => {
    expect(RECALL_DEV_SEED_SIGNER_ID).toBe("signer:dixie-dev-seeded-operator");
    expect(RECALL_DEV_SEED_SIGNER_TYPE).toBe("actor_controller");
    expect(RECALL_DEV_SEED_KEY_REF).toBe("dev-seed-key:dixie-operator-smoke");
  });

  test("computeDevSeededSignedPayloadHash matches the reference sha256 over canonical sorted-key JSON", () => {
    expect(computeDevSeededSignedPayloadHash(PAYLOAD)).toBe(refSha256Of(PAYLOAD));
    expect(computeDevSeededSignedPayloadHash(PAYLOAD)).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
  });

  test("hash is independent of input key order (canonicalization sorts keys)", () => {
    const reordered = {
      risk_profile: "low",
      task: "phase-32k-dev-seed-smoke",
      estate_id: WALLET,
      actor_id: WALLET,
      environment_frame: "private_chat",
    };
    expect(computeDevSeededSignedPayloadHash(reordered)).toBe(
      computeDevSeededSignedPayloadHash(PAYLOAD),
    );
  });

  test("computeDevSeededSignature matches the reference hmac_sha256(key_ref, hash)", () => {
    const hash = computeDevSeededSignedPayloadHash(PAYLOAD);
    expect(computeDevSeededSignature(RECALL_DEV_SEED_KEY_REF, hash)).toBe(
      refDevSignatureFor(RECALL_DEV_SEED_KEY_REF, hash),
    );
    expect(computeDevSeededSignature(RECALL_DEV_SEED_KEY_REF, hash)).toMatch(
      /^dev:[0-9a-f]{64}$/,
    );
  });

  test("buildDevSeededRecallSignature produces a fully self-consistent envelope from the public labels", () => {
    const env = buildDevSeededRecallSignature({
      wallet: WALLET,
      task: "phase-32k-dev-seed-smoke",
      environmentFrame: "private_chat",
      riskProfile: "low",
      signatureId: "sig_phase32k",
      signedAt: "2026-05-30T00:00:00.000Z",
    });
    expect(env.signer_id).toBe(RECALL_DEV_SEED_SIGNER_ID);
    expect(env.signer_type).toBe(RECALL_DEV_SEED_SIGNER_TYPE);
    expect(env.key_ref).toBe(RECALL_DEV_SEED_KEY_REF);
    expect(env.signature_type).toBe("dev_signature");
    expect(env.signature_id).toBe("sig_phase32k");
    expect(env.signed_at).toBe("2026-05-30T00:00:00.000Z");
    // The hash is over the five canonical fields bound to the wallet.
    expect(env.signed_payload_hash).toBe(refSha256Of(PAYLOAD));
    // The signature is hmac over that hash keyed by the key_ref label.
    expect(env.signature).toBe(
      refDevSignatureFor(RECALL_DEV_SEED_KEY_REF, env.signed_payload_hash),
    );
    // It carries none of the old Phase 37C placeholders.
    expect(env.signature).not.toBe("devsig");
    expect(env.signed_payload_hash).not.toBe(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  test("a request plan built around the dev-seeded signature carries it on the wire", () => {
    const signature = buildDevSeededRecallSignature({
      wallet: WALLET,
      task: "phase-32k-dev-seed-smoke",
      environmentFrame: "private_chat",
      riskProfile: "low",
      signatureId: "sig_phase32k",
      signedAt: "2026-05-30T00:00:00.000Z",
    });
    const plan = buildLiveDixieRecallRequestPlan(
      buildInput({
        task: "phase-32k-dev-seed-smoke",
        environmentFrame: "private_chat",
        riskProfile: "low",
        detailLevel: "standard",
        receiptDetail: "standard",
        signature,
      }),
      buildConfig(),
    );
    const request = (plan.body as Record<string, unknown>).request as Record<
      string,
      unknown
    >;
    const sig = request.signature as Record<string, unknown>;
    expect(sig.signer_id).toBe(RECALL_DEV_SEED_SIGNER_ID);
    expect(sig.key_ref).toBe(RECALL_DEV_SEED_KEY_REF);
    expect(sig.signature_type).toBe("dev_signature");
    expect(sig.signed_payload_hash).toBe(signature.signed_payload_hash);
    expect(sig.signature).toBe(signature.signature);
    expect(request.environment_frame).toBe("private_chat");
    expect(request.include_receipt_detail).toBe("standard");
    expect((plan.body as Record<string, unknown>).detail_level).toBe("standard");
  });
});

// -- 3. response classification -------------------------------------------

function fakeFetchReturning(
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

describe("liveRecallViaDixie · response classification", () => {
  test("served body classified as served", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(200, {
        outcome: "served",
        redacted_count: 0,
        redacted_counts_by_reason: [],
      }),
    });
    expect(r.classification).toBe("served");
    expect(r.public_summary.outcome).toBe("served");
    expect(r.public_summary.stable_reason_code).toBe("served");
  });

  test("403 privacy_scope_refusal classified as denied_or_forbidden", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(403, {
        outcome: "denied",
        error: "seam.privacy_scope_refusal",
        message: "user-level recall refused",
      }),
    });
    expect(r.classification).toBe("denied_or_forbidden");
    expect(r.public_summary.stable_reason_code).toBe(
      "seam.privacy_scope_refusal",
    );
  });

  test("403 cross_tenant_recall_refused classified as tenant_or_session_mismatch (distinct from denied_or_forbidden)", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(403, {
        outcome: "denied",
        error: "seam.cross_tenant_recall_refused",
      }),
    });
    expect(r.classification).toBe("tenant_or_session_mismatch");
  });

  test("401 classified as service_unauthorized (distinct from end-user denial)", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(401, {
        outcome: "denied",
        error: "ingress.unauthenticated",
        message: "wallet required",
      }),
    });
    expect(r.classification).toBe("service_unauthorized");
    expect(r.public_summary.stable_reason_code).toBe("service_unauthorized");
  });

  test("400 ingress.invalid_request classified as ingress_invalid_request", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(400, {
        outcome: "denied",
        error: "ingress.invalid_request",
        message: "invalid body shape",
      }),
    });
    expect(r.classification).toBe("ingress_invalid_request");
    expect(r.public_summary.stable_reason_code).toBe(
      "ingress.invalid_request",
    );
  });

  test("400 ingress.missing_idempotency_key classified as ingress_invalid_request", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(400, {
        outcome: "denied",
        error: "ingress.missing_idempotency_key",
      }),
    });
    expect(r.classification).toBe("ingress_invalid_request");
    expect(r.public_summary.stable_reason_code).toBe(
      "ingress.missing_idempotency_key",
    );
  });

  test("503 needs_review outcome classified as needs_review", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(503, {
        outcome: "needs_review",
        error: "seam.policy_unavailable",
      }),
    });
    expect(r.classification).toBe("needs_review");
  });

  test("429 classified as rate_limited", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(429, {
        outcome: "denied",
        error: "ingress.rate_limited",
      }),
    });
    expect(r.classification).toBe("rate_limited");
  });

  test("503 storage_unavailable classified as upstream_unavailable", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(503, {
        outcome: "denied",
        error: "seam.storage_unavailable",
      }),
    });
    expect(r.classification).toBe("upstream_unavailable");
  });

  test("502/504 classified as upstream_unavailable even without an error class", async () => {
    const r502 = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(502, {}),
    });
    expect(r502.classification).toBe("upstream_unavailable");
    const r504 = await liveRecallViaDixie(
      buildInput({ idempotencyKey: "k-504" }),
      buildConfig(),
      { fetch: fakeFetchReturning(504, {}) },
    );
    expect(r504.classification).toBe("upstream_unavailable");
  });

  test("fetch throwing classifies as network_error (no public-bound raw payload)", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: async () => {
        throw new Error("boom");
      },
    });
    expect(r.classification).toBe("network_error");
    expect(r.public_summary.outcome).toBe("network_error");
  });

  test("non-JSON / unparseable body classifies as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(200, undefined, "<<not json>>"),
    });
    expect(r.classification).toBe("unsupported_response_shape");
  });

  test("200 body without served outcome classifies as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(200, {
        outcome: "unexpected",
      }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
  });

  test("unknown HTTP status code classifies as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(418, { hello: "teapot" }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
  });

  test("403 with empty body fails closed as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(403, {}),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(r.public_summary.stable_reason_code).toBe("unknown_403_body_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("400 with empty body fails closed as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(400, {}),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(r.public_summary.stable_reason_code).toBe("unknown_400_body_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("403 with unknown / hostile error class fails closed as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(403, {
        outcome: "denied",
        error: "seam.something_unknown_with_PRIVATE_SENTINEL",
        message: "should not be relayed",
      }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(r.public_summary.stable_reason_code).toBe("unknown_403_body_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("400 with unknown / hostile error class fails closed as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(400, {
        outcome: "denied",
        error: "ingress.something_unknown_with_session_id",
      }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(r.public_summary.stable_reason_code).toBe("unknown_400_body_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("guard.tenant_assertion_cap classified as rate_limited (Phase 37B cap-limited mapping)", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(503, {
        outcome: "denied",
        error: "guard.tenant_assertion_cap",
      }),
    });
    expect(r.classification).toBe("rate_limited");
    expect(r.public_summary.stable_reason_code).toBe(
      "guard.tenant_assertion_cap",
    );
  });

  test("guard.tenant_byte_budget classified as rate_limited (Phase 37B cap-limited mapping)", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(503, {
        outcome: "denied",
        error: "guard.tenant_byte_budget",
      }),
    });
    expect(r.classification).toBe("rate_limited");
    expect(r.public_summary.stable_reason_code).toBe(
      "guard.tenant_byte_budget",
    );
  });

  test("guard cap refusal classified as rate_limited even on alternate carrier status (least-speculative mapping)", async () => {
    // If Dixie ever shifts the carrier status away from 503 for these
    // refusal classes, the documented refusal class wins — they are
    // cap-limited regardless of HTTP status.
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(429, {
        outcome: "denied",
        error: "guard.tenant_assertion_cap",
      }),
    });
    expect(r.classification).toBe("rate_limited");
    expect(r.public_summary.stable_reason_code).toBe(
      "guard.tenant_assertion_cap",
    );
  });

  test("classification set covers every name advertised by LIVE_DIXIE_RECALL_CLASSIFICATIONS", () => {
    // Defense-in-depth: ensures the public name list and the type stay in
    // sync — every advertised classification has a deliberate emitter
    // somewhere above.
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("served");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("denied_or_forbidden");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("needs_review");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain(
      "ingress_invalid_request",
    );
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("service_unauthorized");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain(
      "tenant_or_session_mismatch",
    );
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("rate_limited");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("upstream_unavailable");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain(
      "unsupported_response_shape",
    );
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("network_error");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("missing_required_env");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain("invalid_config");
    expect(LIVE_DIXIE_RECALL_CLASSIFICATIONS).toContain(
      "unsafe_idempotency_key_reuse",
    );
  });
});

// -- 4. no-leak ------------------------------------------------------------

describe("liveRecallViaDixie · operator-public public_summary never carries banned material", () => {
  test("contaminated denied body fails closed as unsupported_response_shape and never leaks raw refusal text", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(403, {
        outcome: "denied",
        // Hostile error class string carrying a banned substring. Under
        // the post-Phase-37C-PATCH strict policy, an unknown error class
        // on 403 fails closed to unsupported_response_shape rather than
        // collapsing into denied_or_forbidden. Defense-in-depth: the
        // banned substring still must not appear in public_summary.
        error: "seam.something_with_PRIVATE_SENTINEL_in_it",
        message: "raw_reasons present",
        raw_reasons: ["raw_reasons:PRIVATE_SENTINEL", "source_material:leak"],
      }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("contaminated 503 body never leaks raw debug payload into public_summary", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(503, {
        outcome: "denied",
        error: "seam.totally_unknown_class_with_raw_dixie_debug",
        raw_dixie_debug: { hidden: "estate" },
      }),
    });
    expect(r.classification).toBe("upstream_unavailable");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("ingress 400 with hostile error class fails closed as unsupported_response_shape", async () => {
    const r = await liveRecallViaDixie(buildInput(), buildConfig(), {
      fetch: fakeFetchReturning(400, {
        outcome: "denied",
        error: "ingress.something_with_session_id_in_name",
      }),
    });
    expect(r.classification).toBe("unsupported_response_shape");
    expect(findBannedPublicSubstring(r.public_summary)).toBeNull();
  });

  test("findBannedPublicSubstring catches sentinels nested inside operator output payloads", () => {
    expect(
      findBannedPublicSubstring({ a: { b: ["ok", "hidden estate"] } }),
    ).toBe("hidden estate");
    expect(findBannedPublicSubstring({ session_id_value: "x" })).toBe(
      "session_id",
    );
    expect(findBannedPublicSubstring({ ok: "fine" })).toBeNull();
  });

  test("LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS includes the same posture as the recorded adapter", () => {
    for (const expected of [
      "PRIVATE_SENTINEL",
      "raw_reasons",
      "raw_dixie_debug",
      "session_id",
      "tenant_id",
      "freeside-characters:shared-substrate",
    ]) {
      expect(
        (LIVE_DIXIE_CLIENT_BANNED_PUBLIC_SUBSTRINGS as readonly string[]).includes(
          expected,
        ),
      ).toBe(true);
    }
  });
});

// -- 5. static guards ------------------------------------------------------

describe("live-dixie-client.ts · static source guards", () => {
  const moduleSource = readFileSync(
    resolve(__dirname, "live-dixie-client.ts"),
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

  test("imports no production storage clients", () => {
    expect(moduleSource).not.toMatch(/from\s+["']pg["']/);
    expect(moduleSource).not.toMatch(/from\s+["']postgres["']/);
    expect(moduleSource).not.toMatch(/from\s+["']redis["']/);
    expect(moduleSource).not.toMatch(/from\s+["']ioredis["']/);
    expect(moduleSource).not.toMatch(/from\s+["']@aws-sdk\/client-s3["']/);
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

  test("does not import the public renderer", () => {
    expect(moduleSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
  });

  test("does not use recorded_dixie_recall_envelope as a wire kind", () => {
    // The string is allowed to appear in a comment that explicitly
    // FORBIDS its use; any actual wire/value usage would also need to
    // appear in a `recorded_dixie_recall_envelope` token outside of the
    // comments. Defense-in-depth: the request-shape test above proves
    // the wire body never carries it.
    const wireBuilder = moduleSource.match(
      /buildLiveDixieRecallRequestPlan[\s\S]*?(?=\nexport\s|\n\/\/ --|$)/,
    );
    expect(wireBuilder).toBeTruthy();
    expect(wireBuilder![0]).not.toContain("recorded_dixie_recall_envelope");
    expect(wireBuilder![0]).not.toContain("input_envelope_kind");
  });

  test("only allowed network primitive is in this live client module (one fetch site)", () => {
    // The module has exactly one place that can call out to fetch — the
    // injected `fetcher` invocation, plus the optional fallback to
    // globalThis.fetch. We assert the file does NOT import any low-level
    // network module and does NOT spawn child processes.
    expect(moduleSource).not.toMatch(/from\s+["']node:http["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:https["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:net["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:tls["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:dgram["']/);
    expect(moduleSource).not.toMatch(/from\s+["']node:child_process["']/);
  });

  test("does not register or dispatch Discord / Telegram commands", () => {
    expect(moduleSource).not.toMatch(/registerCommand\s*\(/);
    expect(moduleSource).not.toMatch(/applicationCommands/);
    expect(moduleSource).not.toMatch(/sendMessage\s*\(/);
    expect(moduleSource).not.toMatch(/createWebhook\s*\(/);
  });
});
