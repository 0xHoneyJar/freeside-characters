// Phase 38A · multi-surface Recall Wedge projection harness regression
// gate. Authority: docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md (Phase
// 37D §F, §G, §H, §I).
//
// Phase 38A scope reminder (per Phase 37D):
//   - this is a fixture/injected-result harness;
//   - it does NOT authorize real Discord, Telegram, private-chat, storage,
//     admission, public renderer expansion, Finn audit wiring, LLM
//     rewriting, or character-voiced recall;
//   - nothing under test here claims production readiness.
//
// What these tests prove (Phase 37D §H):
//   1. taxonomy: every required frame exists, exactly once;
//   2. shared continuity actor / recall result is evaluated across every
//      frame; raw continuity actor identifier never reaches public output;
//   3. operator_dev: operator-safe classification + operator-only
//      diagnostic; operator-public fields contain no banned substrings;
//   4. public_discord_simulated: deterministic public-safe output (or safe
//      denied output) with no banned substrings, no operational IDs;
//   5. public_telegram_simulated: fails closed; stable refusal code;
//   6. authorized_private_session_simulated: fails closed; stable refusal
//      code; no positive private DTO;
//   7. private_chat_simulated: fail-closed / unimplemented; no live private
//      chat marker; no identity / consent claim;
//   8. character_frame_public: deterministic public-safe / referral-style
//      output only; no LLM/voice marker; no persona-styled prose claim;
//   9. non-degenerate matrix: at least two distinct frame signatures;
//      a synthetic degenerate matrix fails the helper;
//   10. no-leak / non-vacuous: contaminated raw/private/debug/source inputs
//       and operational IDs are present in the input but never appear in
//       any frame output;
//   11. static guards: harness source contains no Discord / Telegram /
//       storage / LLM / Finn / @loa/dixie / @loa/straylight imports, no
//       network primitives, no live-Dixie-client / runner / adapter /
//       public-renderer imports, no command registration / dispatch, no
//       use of recorded_dixie_recall_envelope as live traffic;
//   12. Phase 37D ladder: comments and runtime output do not claim
//       production readiness.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS,
  MULTI_SURFACE_RECALL_CLASSIFICATIONS,
  MULTI_SURFACE_RECALL_FRAMES,
  MULTI_SURFACE_REFUSAL_CODES,
  findMultiSurfaceBannedSubstring,
  isMultiSurfaceMatrixNonDegenerate,
  multiSurfaceMatrixDistinctSignatureCount,
  projectAcrossMultiSurfaceFrames,
  type MultiSurfaceFrameResult,
  type MultiSurfaceRecallFrame,
  type MultiSurfaceRecallInput,
  type MultiSurfaceRecallProjectionMatrix,
} from "./multi-surface-recall-harness.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RAW_ACTOR_ID = "actor:freeside-characters:shared-substrate#0xabc";
const SAFE_BINDING = "binding-A";
const RECALL_RESULT_ID = "rr-multi-surface-1";

// Operational identifiers — operational only, NOT memory identity. Threaded
// into the input so tests can prove no public-bound frame leaks them.
const OPERATIONAL_IDS = {
  session_id: "session_id_VALUE_X",
  message_id: "message_id_VALUE_Y",
  tenant_id: "tenant_id_VALUE_T",
  community_id: "community_id_VALUE_C",
  session_thread_id: "session_thread_id_VALUE_ST",
  sessionId: "sessionId_VALUE_X2",
  messageId: "messageId_VALUE_Y2",
  tenantId: "tenantId_VALUE_T2",
  communityId: "communityId_VALUE_C2",
  sessionThreadId: "sessionThreadId_VALUE_ST2",
  continuityActorId: "continuityActorId_VALUE_CA",
} as const;

// Intentionally contaminated raw/private/debug/source material. Every key
// AND every value below contains a banned substring. The harness must NOT
// propagate any of these into any frame's output.
const CONTAMINATED_INTERNAL: Readonly<Record<string, unknown>> = {
  PRIVATE_SENTINEL: "PRIVATE_SENTINEL",
  raw_reasons: ["raw_reasons:PRIVATE_SENTINEL"],
  raw_dixie_debug: { hidden: "hidden estate" },
  raw_session_trace: "raw_session_trace_VALUE",
  debug: "debug_VALUE",
  operator_private: "operator_private_VALUE",
  private_assertion: "private_assertion_VALUE",
  private_assertion_id: "private_assertion_id_VALUE",
  assertion_id: "assertion_id_VALUE",
  source_material: "source_material_VALUE",
  hidden_estate_field: "hidden estate VALUE",
  full_assertion_bodies: "full assertion bodies VALUE",
  private_identifiers: "private identifiers VALUE",
};

function buildServedInput(
  overrides: Partial<MultiSurfaceRecallInput> = {},
): MultiSurfaceRecallInput {
  return {
    continuity_actor_binding: SAFE_BINDING,
    raw_continuity_actor_id: RAW_ACTOR_ID,
    recall_result_id: RECALL_RESULT_ID,
    classification: "served",
    safe_public_summary: "redacted: 0 · marked: 1",
    safe_public_reason_labels: ["public-allowlisted-label"],
    safe_public_reason_counts: { redacted: 0, marked: 1 },
    operator_diagnostic_label: "operator_safe_label",
    contaminated_internal: CONTAMINATED_INTERNAL,
    operational_ids: OPERATIONAL_IDS,
    ...overrides,
  };
}

function buildDeniedInput(
  overrides: Partial<MultiSurfaceRecallInput> = {},
): MultiSurfaceRecallInput {
  return buildServedInput({
    classification: "denied_or_forbidden",
    safe_public_summary: undefined,
    operator_diagnostic_label: "operator_safe_denied_label",
    ...overrides,
  });
}

// Helper: collect every public-bound emitted string field (i.e. every field
// that could reach an end user). For operator_dev, public_text is empty —
// but the operator-public surface (safe_summary + operator_only_diagnostic)
// is still scanned because operator-public output also forbids raw /
// private / debug / source material per Phase 37D §F.1.
function publicBoundStringsForFrame(
  result: MultiSurfaceFrameResult,
): readonly string[] {
  const out: string[] = [];
  if (result.public_text !== undefined) out.push(result.public_text);
  if (result.safe_summary !== undefined) out.push(result.safe_summary);
  if (result.refusal_code !== undefined) out.push(result.refusal_code);
  return out;
}

// -- 1. taxonomy ----------------------------------------------------------

describe("Phase 38A · taxonomy", () => {
  test("every required frame name is present in MULTI_SURFACE_RECALL_FRAMES", () => {
    for (const required of [
      "operator_dev",
      "public_discord_simulated",
      "public_telegram_simulated",
      "authorized_private_session_simulated",
      "private_chat_simulated",
      "character_frame_public",
    ]) {
      expect(
        (MULTI_SURFACE_RECALL_FRAMES as readonly string[]).includes(required),
      ).toBe(true);
    }
  });

  test("MULTI_SURFACE_RECALL_FRAMES contains no duplicates", () => {
    const seen = new Set<string>();
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      expect(seen.has(f)).toBe(false);
      seen.add(f);
    }
  });

  test("matrix contains exactly the required frames, each exactly once", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const keys = Object.keys(matrix.frames);
    expect(keys.length).toBe(MULTI_SURFACE_RECALL_FRAMES.length);
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      expect(matrix.frames[f]).toBeTruthy();
      expect(matrix.frames[f].frame).toBe(f);
    }
  });
});

// -- 2. shared actor / result ---------------------------------------------

describe("Phase 38A · shared continuity actor and recall result", () => {
  test("one shared input is evaluated across every frame", () => {
    const input = buildServedInput();
    const matrix = projectAcrossMultiSurfaceFrames(input);
    expect(matrix.continuity_actor_binding).toBe(SAFE_BINDING);
    expect(matrix.recall_result_id).toBe(RECALL_RESULT_ID);
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      expect(matrix.frames[f].frame).toBe(f);
    }
  });

  test("public-bound outputs do not expose the raw continuity actor identifier", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      const r = matrix.frames[f];
      for (const s of publicBoundStringsForFrame(r)) {
        expect(s).not.toContain(RAW_ACTOR_ID);
        expect(s).not.toContain("freeside-characters:shared-substrate");
        expect(s).not.toContain("actor:");
      }
    }
  });
});

// -- 3. operator_dev ------------------------------------------------------

describe("Phase 38A · operator_dev", () => {
  test("renders an operator-safe classification", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.operator_dev;
    expect(r.outcome).toBe("rendered");
    expect(r.safe_summary).toBeTruthy();
    expect(r.safe_summary!).toContain("served");
  });

  test("emits an INTERNAL/operator-only diagnostic", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.operator_dev;
    expect(r.operator_only_diagnostic).toBeTruthy();
    expect(r.operator_only_diagnostic!).toContain("INTERNAL/operator-only");
  });

  test("operator-public fields do not leak banned substrings", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.operator_dev;
    expect(r.leak_scan.clean).toBe(true);
    expect(findMultiSurfaceBannedSubstring(r.safe_summary)).toBeNull();
    expect(
      findMultiSurfaceBannedSubstring(r.operator_only_diagnostic),
    ).toBeNull();
  });
});

// -- 4. public_discord_simulated ------------------------------------------

describe("Phase 38A · public_discord_simulated", () => {
  test("served input renders deterministic public-safe output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.public_discord_simulated;
    expect(r.outcome).toBe("rendered");
    expect(r.public_text).toBeTruthy();
    expect(r.public_text!).toContain("public_discord_simulated");
    expect(r.public_text!).toContain("served");
  });

  test("denied input renders deterministic public-safe refusal output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildDeniedInput());
    const r = matrix.frames.public_discord_simulated;
    expect(r.outcome).toBe("refused");
    expect(r.public_text).toBeTruthy();
    expect(r.refusal_code).toBe(
      MULTI_SURFACE_REFUSAL_CODES.denied_or_forbidden_projection_refused_publicly,
    );
  });

  test("public output contains no banned substrings (served + denied)", () => {
    for (const input of [buildServedInput(), buildDeniedInput()]) {
      const matrix = projectAcrossMultiSurfaceFrames(input);
      const r = matrix.frames.public_discord_simulated;
      expect(r.leak_scan.clean).toBe(true);
      for (const s of publicBoundStringsForFrame(r)) {
        expect(findMultiSurfaceBannedSubstring(s)).toBeNull();
      }
    }
  });

  test("no operational IDs appear in public output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.public_discord_simulated;
    for (const s of publicBoundStringsForFrame(r)) {
      for (const v of Object.values(OPERATIONAL_IDS)) {
        expect(s).not.toContain(v);
      }
    }
  });
});

// -- 5. public_telegram_simulated -----------------------------------------

describe("Phase 38A · public_telegram_simulated", () => {
  test("fails closed regardless of classification", () => {
    for (const cls of [
      "served",
      "denied_or_forbidden",
      "needs_review",
      "service_unauthorized",
      "unsupported_response_shape",
    ] as const) {
      const matrix = projectAcrossMultiSurfaceFrames(
        buildServedInput({
          classification: cls,
          safe_public_summary: cls === "served" ? "ok" : undefined,
        }),
      );
      const r = matrix.frames.public_telegram_simulated;
      expect(r.outcome).toBe("refused");
      expect(r.refusal_code).toBe(
        MULTI_SURFACE_REFUSAL_CODES.public_telegram_projection_not_implemented,
      );
    }
  });

  test("emits no positive billboard fields", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.public_telegram_simulated;
    // The frame may still emit a public_text, but it must be the refusal
    // form — not a positive served billboard. We assert no served-specific
    // markers appear.
    expect(r.public_text ?? "").not.toContain("served");
    expect(r.public_text ?? "").not.toContain("ok");
    // safe_summary is an explicit served-shape field; refused frames must
    // not populate it.
    expect(r.safe_summary).toBeUndefined();
  });

  test("public output contains no banned substrings", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.public_telegram_simulated;
    expect(r.leak_scan.clean).toBe(true);
    for (const s of publicBoundStringsForFrame(r)) {
      expect(findMultiSurfaceBannedSubstring(s)).toBeNull();
    }
  });
});

// -- 6. authorized_private_session_simulated ------------------------------

describe("Phase 38A · authorized_private_session_simulated", () => {
  test("fails closed regardless of classification", () => {
    for (const cls of [
      "served",
      "denied_or_forbidden",
      "needs_review",
    ] as const) {
      const matrix = projectAcrossMultiSurfaceFrames(
        buildServedInput({
          classification: cls,
          safe_public_summary: cls === "served" ? "ok" : undefined,
        }),
      );
      const r = matrix.frames.authorized_private_session_simulated;
      expect(r.outcome).toBe("refused");
      expect(r.refusal_code).toBe(
        MULTI_SURFACE_REFUSAL_CODES.authorized_private_projection_not_implemented,
      );
    }
  });

  test("does not emit a positive private DTO", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.authorized_private_session_simulated;
    // Refused frames must not echo the public-safe summary as if rendered;
    // the input's safe_public_summary field carried "redacted: 0 · marked: 1"
    // and that string must NOT appear in the refusal output.
    expect(r.public_text ?? "").not.toContain("redacted: 0 · marked: 1");
    expect(r.safe_summary).toBeUndefined();
  });

  test("public output contains no banned substrings", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.authorized_private_session_simulated;
    expect(r.leak_scan.clean).toBe(true);
    for (const s of publicBoundStringsForFrame(r)) {
      expect(findMultiSurfaceBannedSubstring(s)).toBeNull();
    }
  });
});

// -- 7. private_chat_simulated --------------------------------------------

describe("Phase 38A · private_chat_simulated", () => {
  test("is unimplemented (taxonomy-only)", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.private_chat_simulated;
    expect(r.outcome).toBe("unimplemented");
    expect(r.refusal_code).toBe(
      MULTI_SURFACE_REFUSAL_CODES.private_chat_projection_unimplemented,
    );
  });

  test("emits no live private chat marker, identity, or consent claim", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.private_chat_simulated;
    for (const s of publicBoundStringsForFrame(r)) {
      // No live private chat transport claim.
      expect(s.toLowerCase()).not.toContain("live");
      // No identity-binding claim.
      expect(s.toLowerCase()).not.toContain("identity bound");
      expect(s.toLowerCase()).not.toContain("identity binding");
      // No consent capture claim.
      expect(s.toLowerCase()).not.toContain("consent");
    }
  });

  test("public output contains no banned substrings", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.private_chat_simulated;
    expect(r.leak_scan.clean).toBe(true);
    for (const s of publicBoundStringsForFrame(r)) {
      expect(findMultiSurfaceBannedSubstring(s)).toBeNull();
    }
  });
});

// -- 8. character_frame_public --------------------------------------------

describe("Phase 38A · character_frame_public", () => {
  test("served input emits deterministic referral-style output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const r = matrix.frames.character_frame_public;
    expect(r.outcome).toBe("rendered");
    expect(r.public_text).toBeTruthy();
    expect(r.public_text!).toContain("referral");
    expect(r.public_text!).toContain("public-recall-billboard");
  });

  test("denied input emits a public-safe refusal", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildDeniedInput());
    const r = matrix.frames.character_frame_public;
    expect(r.outcome).toBe("refused");
    expect(r.refusal_code).toBe(
      MULTI_SURFACE_REFUSAL_CODES.character_frame_refused_publicly,
    );
  });

  test("emits no LLM/voice marker or persona-styled prose claim", () => {
    for (const input of [buildServedInput(), buildDeniedInput()]) {
      const matrix = projectAcrossMultiSurfaceFrames(input);
      const r = matrix.frames.character_frame_public;
      for (const s of publicBoundStringsForFrame(r)) {
        const lc = s.toLowerCase();
        expect(lc).not.toContain("llm");
        expect(lc).not.toContain("anthropic");
        expect(lc).not.toContain("openai");
        expect(lc).not.toContain("claude agent sdk");
        expect(lc).not.toContain("character voice");
        expect(lc).not.toContain("persona-styled");
        expect(lc).not.toContain("generated prose");
      }
    }
  });

  test("public output contains no banned substrings", () => {
    for (const input of [buildServedInput(), buildDeniedInput()]) {
      const matrix = projectAcrossMultiSurfaceFrames(input);
      const r = matrix.frames.character_frame_public;
      expect(r.leak_scan.clean).toBe(true);
      for (const s of publicBoundStringsForFrame(r)) {
        expect(findMultiSurfaceBannedSubstring(s)).toBeNull();
      }
    }
  });
});

// -- 9. non-degenerate matrix --------------------------------------------

describe("Phase 38A · non-degenerate matrix", () => {
  test("served-input matrix has at least two distinct frame signatures", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    expect(isMultiSurfaceMatrixNonDegenerate(matrix)).toBe(true);
    expect(multiSurfaceMatrixDistinctSignatureCount(matrix)).toBeGreaterThan(
      1,
    );
  });

  test("denied-input matrix is also non-degenerate", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildDeniedInput());
    expect(isMultiSurfaceMatrixNonDegenerate(matrix)).toBe(true);
  });

  test("public_discord_simulated and public_telegram_simulated produce distinguishably different outputs for the same served input", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    const a = matrix.frames.public_discord_simulated;
    const b = matrix.frames.public_telegram_simulated;
    expect(a.outcome).not.toBe(b.outcome);
    expect(a.public_text).not.toBe(b.public_text);
  });

  test("a deliberately degenerate synthetic matrix fails the helper", () => {
    const cloneFrameWithFrameName = (
      frame: MultiSurfaceRecallFrame,
    ): MultiSurfaceFrameResult => ({
      frame,
      outcome: "rendered",
      public_text: "[recall · uniform]\nstatus: same-everywhere",
      safe_summary: "same-summary",
      leak_scan: { clean: true, first_hit: null },
    });
    const degenerate: MultiSurfaceRecallProjectionMatrix = {
      continuity_actor_binding: SAFE_BINDING,
      recall_result_id: RECALL_RESULT_ID,
      classification: "served",
      frames: {
        operator_dev: cloneFrameWithFrameName("operator_dev"),
        public_discord_simulated: cloneFrameWithFrameName(
          "public_discord_simulated",
        ),
        public_telegram_simulated: cloneFrameWithFrameName(
          "public_telegram_simulated",
        ),
        authorized_private_session_simulated: cloneFrameWithFrameName(
          "authorized_private_session_simulated",
        ),
        private_chat_simulated: cloneFrameWithFrameName(
          "private_chat_simulated",
        ),
        character_frame_public: cloneFrameWithFrameName(
          "character_frame_public",
        ),
      },
    };
    expect(isMultiSurfaceMatrixNonDegenerate(degenerate)).toBe(false);
    expect(
      multiSurfaceMatrixDistinctSignatureCount(degenerate),
    ).toBe(1);
  });
});

// -- 10. no-leak / non-vacuous -------------------------------------------

describe("Phase 38A · no-leak / non-vacuous", () => {
  test("input contains intentionally contaminated raw/private/debug/source fields", () => {
    // Non-vacuous proof: prove the contamination exists in the test
    // fixture before asserting it is absent from outputs.
    const input = buildServedInput();
    const found = findMultiSurfaceBannedSubstring(input.contaminated_internal);
    expect(found).not.toBeNull();
  });

  test("input contains every operational identifier", () => {
    const input = buildServedInput();
    expect(input.operational_ids).toBeTruthy();
    for (const k of [
      "session_id",
      "message_id",
      "tenant_id",
      "community_id",
      "session_thread_id",
      "sessionId",
      "messageId",
      "tenantId",
      "communityId",
      "sessionThreadId",
      "continuityActorId",
    ] as const) {
      expect(
        (input.operational_ids as Record<string, unknown>)[k],
      ).toBeTruthy();
    }
  });

  test("operational ID values never appear in any frame's public-bound output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      const r = matrix.frames[f];
      const allStrings = [
        ...publicBoundStringsForFrame(r),
        ...(r.operator_only_diagnostic !== undefined
          ? [r.operator_only_diagnostic]
          : []),
      ];
      for (const s of allStrings) {
        for (const v of Object.values(OPERATIONAL_IDS)) {
          expect(s).not.toContain(v);
        }
      }
    }
  });

  test("contaminated internal values never appear in any frame's public-bound output", () => {
    const matrix = projectAcrossMultiSurfaceFrames(buildServedInput());
    for (const f of MULTI_SURFACE_RECALL_FRAMES) {
      const r = matrix.frames[f];
      const allStrings = [
        ...publicBoundStringsForFrame(r),
        ...(r.operator_only_diagnostic !== undefined
          ? [r.operator_only_diagnostic]
          : []),
      ];
      for (const s of allStrings) {
        // Each contaminated value would also light up the banned-substring
        // posture. Direct value checks belt-and-suspenders against any
        // future drift in the banned list.
        for (const v of [
          "PRIVATE_SENTINEL",
          "raw_reasons:PRIVATE_SENTINEL",
          "raw_session_trace_VALUE",
          "operator_private_VALUE",
          "private_assertion_VALUE",
          "assertion_id_VALUE",
          "source_material_VALUE",
          "hidden estate VALUE",
          "full assertion bodies VALUE",
          "private identifiers VALUE",
        ]) {
          expect(s).not.toContain(v);
        }
      }
    }
  });

  test("every frame's leak_scan reports clean for served + denied inputs", () => {
    for (const input of [buildServedInput(), buildDeniedInput()]) {
      const matrix = projectAcrossMultiSurfaceFrames(input);
      for (const f of MULTI_SURFACE_RECALL_FRAMES) {
        const r = matrix.frames[f];
        expect(r.leak_scan.clean).toBe(true);
        expect(r.leak_scan.first_hit).toBeNull();
      }
    }
  });

  test("findMultiSurfaceBannedSubstring detects every banned substring at depth", () => {
    // The function returns the FIRST banned substring it encounters, which
    // is not necessarily equal to the input (e.g. "private_assertion_id"
    // hits "private_assertion" first). Each input below must produce some
    // non-null hit; clean inputs must produce null.
    for (const banned of MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS) {
      expect(findMultiSurfaceBannedSubstring(banned)).not.toBeNull();
      expect(
        findMultiSurfaceBannedSubstring({ wrap: { x: [banned] } }),
      ).not.toBeNull();
      // Banned substring as a key
      const obj: Record<string, unknown> = {};
      obj[banned] = "clean";
      expect(findMultiSurfaceBannedSubstring(obj)).not.toBeNull();
    }
    expect(findMultiSurfaceBannedSubstring({ ok: "fine" })).toBeNull();
    expect(findMultiSurfaceBannedSubstring("benign-content")).toBeNull();
    expect(findMultiSurfaceBannedSubstring(42)).toBeNull();
    expect(findMultiSurfaceBannedSubstring(null)).toBeNull();
  });

  test("MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS covers every required token", () => {
    for (const expected of [
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
      "sessionId",
      "messageId",
      "tenantId",
      "communityId",
      "sessionThreadId",
      "continuityActorId",
    ]) {
      expect(
        (MULTI_SURFACE_HARNESS_BANNED_SUBSTRINGS as readonly string[]).includes(
          expected,
        ),
      ).toBe(true);
    }
  });
});

// -- 11. static guards ----------------------------------------------------

describe("Phase 38A · static source guards", () => {
  const harnessSource = readFileSync(
    resolve(__dirname, "multi-surface-recall-harness.ts"),
    "utf8",
  );
  const testSource = readFileSync(
    resolve(__dirname, "multi-surface-recall-harness.test.ts"),
    "utf8",
  );

  test("harness imports no Discord client / interactions", () => {
    expect(harnessSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*discord-interactions[^"']*["']/,
    );
    expect(harnessSource).not.toMatch(/from\s+["']@discordjs\/[^"']+["']/);
  });

  test("harness imports no Telegram client / bot framework", () => {
    expect(harnessSource).not.toMatch(/from\s+["']telegraf["']/);
    expect(harnessSource).not.toMatch(/from\s+["']grammy["']/);
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*node-telegram[^"']*["']/,
    );
    expect(harnessSource).not.toMatch(/from\s+["'][^"']*telegram[^"']*["']/i);
  });

  test("harness imports no production storage clients", () => {
    expect(harnessSource).not.toMatch(/from\s+["']pg["']/);
    expect(harnessSource).not.toMatch(/from\s+["']postgres["']/);
    expect(harnessSource).not.toMatch(/from\s+["']redis["']/);
    expect(harnessSource).not.toMatch(/from\s+["']ioredis["']/);
    expect(harnessSource).not.toMatch(/from\s+["']@aws-sdk\/[^"']+["']/);
  });

  test("harness imports no LLM SDK / Claude Agent SDK", () => {
    expect(harnessSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(harnessSource).not.toMatch(/from\s+["']@anthropic-ai\/sdk["']/);
    expect(harnessSource).not.toMatch(/from\s+["']openai["']/);
  });

  test("harness imports no Finn / @loa/dixie / @loa/straylight runtime dependency", () => {
    expect(harnessSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(harnessSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(harnessSource).not.toMatch(/from\s+["'][^"']*\/finn[^"']*["']/);
  });

  test("harness does not import the Phase 37C live Dixie client", () => {
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
  });

  test("harness does not import the Phase 37C live Dixie runner", () => {
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
  });

  test("harness does not import the recorded dixie-envelope adapter", () => {
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
  });

  test("harness does not import the public renderer", () => {
    expect(harnessSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
  });

  test("harness contains no fetch / low-level network primitives", () => {
    expect(harnessSource).not.toMatch(/\bfetch\s*\(/);
    expect(harnessSource).not.toMatch(/globalThis\.fetch/);
    expect(harnessSource).not.toMatch(/from\s+["']node:http["']/);
    expect(harnessSource).not.toMatch(/from\s+["']node:https["']/);
    expect(harnessSource).not.toMatch(/from\s+["']node:net["']/);
    expect(harnessSource).not.toMatch(/from\s+["']node:tls["']/);
    expect(harnessSource).not.toMatch(/from\s+["']node:dgram["']/);
    expect(harnessSource).not.toMatch(/from\s+["']node:child_process["']/);
  });

  test("harness does not register or dispatch Discord / Telegram commands", () => {
    expect(harnessSource).not.toMatch(/registerCommand\s*\(/);
    expect(harnessSource).not.toMatch(/applicationCommands/);
    expect(harnessSource).not.toMatch(/sendMessage\s*\(/);
    expect(harnessSource).not.toMatch(/createWebhook\s*\(/);
    expect(harnessSource).not.toMatch(/discord\.gateway/i);
  });

  test("harness does not treat recorded_dixie_recall_envelope as live traffic", () => {
    // The string is allowed to appear in a comment that explicitly forbids
    // its use as live traffic. It must NOT appear as a value, body field,
    // or imported identifier.
    const tokenLines = harnessSource
      .split("\n")
      .map((line, i) => ({ i, line }))
      .filter((l) => l.line.includes("recorded_dixie_recall_envelope"));
    for (const { line } of tokenLines) {
      const trimmed = line.trim();
      // Only allowed in comment lines (// ... or part of a block comment).
      const isCommentLine =
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*");
      expect(isCommentLine).toBe(true);
    }
  });

  test("test source also does not introduce network/surface imports", () => {
    expect(testSource).not.toMatch(/from\s+["']discord\.js["']/);
    expect(testSource).not.toMatch(/from\s+["']telegraf["']/);
    expect(testSource).not.toMatch(/from\s+["']grammy["']/);
    expect(testSource).not.toMatch(/from\s+["']pg["']/);
    expect(testSource).not.toMatch(/from\s+["']redis["']/);
    expect(testSource).not.toMatch(
      /from\s+["']@anthropic-ai\/claude-agent-sdk["']/,
    );
    expect(testSource).not.toMatch(/from\s+["']openai["']/);
    expect(testSource).not.toMatch(/from\s+["']@loa\/dixie["']/);
    expect(testSource).not.toMatch(/from\s+["']@loa\/straylight["']/);
    expect(testSource).not.toMatch(
      /from\s+["'][^"']*live-dixie-client[^"']*["']/,
    );
    expect(testSource).not.toMatch(
      /from\s+["'][^"']*run-live-dixie-recall-demo[^"']*["']/,
    );
    expect(testSource).not.toMatch(
      /from\s+["'][^"']*dixie-envelope-adapter[^"']*["']/,
    );
    expect(testSource).not.toMatch(
      /from\s+["'][^"']*render-public-recall[^"']*["']/,
    );
    expect(testSource).not.toMatch(/\bfetch\s*\(/);
    expect(testSource).not.toMatch(/globalThis\.fetch/);
  });
});

// -- 12. Phase 37D ladder -------------------------------------------------

describe("Phase 38A · Phase 37D ladder", () => {
  test("classification vocabulary matches what the harness advertises", () => {
    for (const cls of [
      "served",
      "denied_or_forbidden",
      "needs_review",
      "service_unauthorized",
      "unsupported_response_shape",
    ]) {
      expect(
        (MULTI_SURFACE_RECALL_CLASSIFICATIONS as readonly string[]).includes(
          cls,
        ),
      ).toBe(true);
    }
  });

  test("no runtime output claims production readiness", () => {
    // Phase 38A §I: nothing in this harness is real Discord, Telegram,
    // private chat, storage, admission, public renderer, or character
    // voice. No emitted string may claim production-ready / live status
    // for any of those surfaces.
    for (const input of [buildServedInput(), buildDeniedInput()]) {
      const matrix = projectAcrossMultiSurfaceFrames(input);
      for (const f of MULTI_SURFACE_RECALL_FRAMES) {
        const r = matrix.frames[f];
        const all = [
          ...publicBoundStringsForFrame(r),
          ...(r.operator_only_diagnostic !== undefined
            ? [r.operator_only_diagnostic]
            : []),
        ];
        for (const s of all) {
          const lc = s.toLowerCase();
          expect(lc).not.toContain("production");
          expect(lc).not.toContain("production-ready");
          expect(lc).not.toContain("live discord");
          expect(lc).not.toContain("live telegram");
          expect(lc).not.toContain("live private chat");
          expect(lc).not.toContain("live admission");
        }
      }
    }
  });

  test("harness comments record the Phase 37D non-authorization", () => {
    const harnessSource = readFileSync(
      resolve(__dirname, "multi-surface-recall-harness.ts"),
      "utf8",
    );
    expect(harnessSource).toContain("Phase 37D");
    expect(harnessSource).toContain("fixture/injected-result");
    expect(harnessSource).toContain("does NOT call live Dixie");
    expect(harnessSource).toContain("does NOT touch real Discord");
    expect(harnessSource).toContain("does NOT invoke any LLM");
  });
});
