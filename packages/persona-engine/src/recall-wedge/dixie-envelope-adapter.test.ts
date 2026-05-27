// Phase 35D · adapter regression gate for recorded Dixie-safe recall envelopes.
//
// Drives `adaptDixieEnvelopeToPublicRecallProjection` and
// `adaptDixieEnvelopeToRecallProjection` against the Phase 35D recorded
// envelope fixtures shipped under `docs/recall-wedge/fixtures/dixie-envelope/`.
// Proves:
//
//   1. a recorded public Dixie envelope adapts to a public_discord /
//      discord_public_character DTO;
//   2. that adapted DTO renders through `renderPublicRecallProjection`;
//   3. a recorded referral envelope adapts to a referral DTO and renders
//      through `renderPublicRecallProjection`;
//   4. an unknown envelope_version fails closed with the
//      `unsupported_dixie_envelope_version` code;
//   5. non-object input fails closed;
//   6. missing required envelope fields fail closed;
//   7. raw / private / debug Dixie fields never appear in the adapted DTO;
//   8. raw / private / debug Dixie fields never appear in the rendered
//      public output;
//   9. raw Dixie envelopes are NEVER passed directly to
//      `renderPublicRecallProjection` (the adapter is the narrowing
//      boundary, not the renderer);
//  10. the adapter performs no network / Discord / Telegram / Dixie / Finn /
//      Straylight / storage / LLM I/O — proven by import inspection;
//  11. authorized_private_session target is rejected with a stable
//      `authorized_private_projection_not_implemented` code (the §5a DTO
//      gate has not been satisfied; no private renderer is authorized).

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DixieEnvelopeAdapterError,
  adaptDixieEnvelopeToPublicRecallProjection,
  adaptDixieEnvelopeToRecallProjection,
  isSupportedDixieEnvelopeVersion,
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

function loadFixture(name: string): unknown {
  const path = resolve(FIXTURE_DIR, name);
  return JSON.parse(readFileSync(path, "utf8"));
}

const PUBLIC_DISCORD_ENVELOPE = loadFixture(
  "recorded-public-discord-recall-envelope.v0.json",
);
const REFERRAL_ENVELOPE = loadFixture(
  "recorded-referral-recall-envelope.v0.json",
);
const UNKNOWN_VERSION_ENVELOPE = loadFixture(
  "recorded-unknown-version-envelope.json",
);

// Strings that must never appear anywhere in an adapted DTO or in rendered
// public output. Mirrors the Phase 33C public-output guard plus the Dixie-
// raw sentinels and operational identifiers that this adapter is explicitly
// responsible for stripping.
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
  "continuity_actor_id",
  "actor:",
  "freeside-characters:shared-substrate",
] as const;

function collectAllStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAllStrings(item, out);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectAllStrings(v, out);
    }
  }
}

function dtoContainsBannedSubstring(dto: unknown): string | null {
  const strings: string[] = [];
  collectAllStrings(dto, strings);
  for (const s of strings) {
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      if (s.includes(banned)) return banned;
    }
  }
  return null;
}

describe("isSupportedDixieEnvelopeVersion", () => {
  test("accepts the recorded v0 public envelope", () => {
    expect(isSupportedDixieEnvelopeVersion(PUBLIC_DISCORD_ENVELOPE)).toBe(true);
  });

  test("accepts the recorded v0 referral envelope", () => {
    expect(isSupportedDixieEnvelopeVersion(REFERRAL_ENVELOPE)).toBe(true);
  });

  test("rejects the unknown-version envelope", () => {
    expect(isSupportedDixieEnvelopeVersion(UNKNOWN_VERSION_ENVELOPE)).toBe(
      false,
    );
  });

  test("rejects non-object input", () => {
    expect(isSupportedDixieEnvelopeVersion(null)).toBe(false);
    expect(isSupportedDixieEnvelopeVersion("nope")).toBe(false);
    expect(isSupportedDixieEnvelopeVersion(42)).toBe(false);
    expect(isSupportedDixieEnvelopeVersion([])).toBe(false);
  });

  test("rejects an envelope that omits envelope_version", () => {
    const e = { ...(PUBLIC_DISCORD_ENVELOPE as Record<string, unknown>) };
    delete e.envelope_version;
    expect(isSupportedDixieEnvelopeVersion(e)).toBe(false);
  });
});

describe("adaptDixieEnvelopeToPublicRecallProjection · public envelope", () => {
  const dto = adaptDixieEnvelopeToPublicRecallProjection(
    PUBLIC_DISCORD_ENVELOPE,
  );

  test("produces a public_discord / discord_public_character DTO", () => {
    expect((dto as Record<string, unknown>).recall_interface).toBe(
      "public_discord",
    );
    expect((dto as Record<string, unknown>).render_surface).toBe(
      "discord_public_character",
    );
    expect((dto as Record<string, unknown>).outcome).toBe("ok");
    expect((dto as Record<string, unknown>).character_frame).toBe("ruggy");
  });

  test("preserves the public counts and labels from the envelope payload", () => {
    expect((dto as Record<string, unknown>).included_count).toBe(3);
    expect((dto as Record<string, unknown>).redacted_count).toBe(1);
    expect((dto as Record<string, unknown>).excluded_count).toBe(1);
    expect((dto as Record<string, unknown>).public_reason_labels).toEqual([
      "redacted_for_public_surface",
      "excluded_from_public_surface",
    ]);
  });

  test("renders successfully through the public-safe renderer", () => {
    const text = renderPublicRecallProjection(dto);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("[recall · public · ruggy · ok]");
    expect(text).toContain("included=3");
    expect(text).toContain("redacted_for_public_surface=1");
  });

  test("adapted DTO contains no raw / private / debug Dixie material", () => {
    const banned = dtoContainsBannedSubstring(dto);
    expect(banned).toBeNull();
  });

  test("rendered public output contains no raw / private / debug Dixie material", () => {
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("adapted DTO does not pass through session_id / message_id / continuity_actor_id", () => {
    const obj = dto as Record<string, unknown>;
    expect(obj.session_id).toBeUndefined();
    expect(obj.message_id).toBeUndefined();
    expect(obj.continuity_actor_id).toBeUndefined();
    expect(obj.raw_dixie_debug).toBeUndefined();
    expect(obj.raw_session_trace).toBeUndefined();
    expect(obj.source_material).toBeUndefined();
  });
});

describe("adaptDixieEnvelopeToPublicRecallProjection · referral envelope", () => {
  const dto = adaptDixieEnvelopeToPublicRecallProjection(REFERRAL_ENVELOPE);

  test("produces a referral DTO", () => {
    expect((dto as Record<string, unknown>).outcome).toBe("referral");
    expect((dto as Record<string, unknown>).safe_referral_target).toBe(
      "satoshi",
    );
    expect((dto as Record<string, unknown>).public_referral_message).toContain(
      "satoshi",
    );
    expect((dto as Record<string, unknown>).denied_or_refused).toBe(true);
  });

  test("renders successfully through the public-safe renderer", () => {
    const text = renderPublicRecallProjection(dto);
    expect(text).toContain("referral target: satoshi");
    expect(text).toContain("referral message: that lives closer to satoshi");
  });

  test("adapted DTO and rendered text contain no raw Dixie material", () => {
    const banned = dtoContainsBannedSubstring(dto);
    expect(banned).toBeNull();
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("adaptDixieEnvelopeToPublicRecallProjection · fail-closed", () => {
  test("rejects the unknown-version envelope with unsupported_dixie_envelope_version", () => {
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(UNKNOWN_VERSION_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToPublicRecallProjection(UNKNOWN_VERSION_ENVELOPE);
    } catch (err) {
      expect(err).toBeInstanceOf(DixieEnvelopeAdapterError);
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "unsupported_dixie_envelope_version",
      );
    }
  });

  test("rejects non-object input", () => {
    for (const bad of [null, undefined, "nope", 7, true, []] as const) {
      expect(() =>
        adaptDixieEnvelopeToPublicRecallProjection(bad as unknown),
      ).toThrow(DixieEnvelopeAdapterError);
    }
  });

  test("rejects an envelope that omits envelope_version", () => {
    const e = { ...(PUBLIC_DISCORD_ENVELOPE as Record<string, unknown>) };
    delete e.envelope_version;
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      /envelope_version/,
    );
  });

  test("rejects an envelope with the wrong input_envelope_kind", () => {
    const e = {
      ...(PUBLIC_DISCORD_ENVELOPE as Record<string, unknown>),
      input_envelope_kind: "dixie_session_envelope",
    };
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      /input_envelope_kind/,
    );
  });

  test("rejects an envelope missing target_projection", () => {
    const e = { ...(PUBLIC_DISCORD_ENVELOPE as Record<string, unknown>) };
    delete e.target_projection;
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
  });

  test("rejects an envelope missing public_recall_payload", () => {
    const e = { ...(PUBLIC_DISCORD_ENVELOPE as Record<string, unknown>) };
    delete e.public_recall_payload;
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      /public_recall_payload/,
    );
  });

  test("rejects a referral envelope missing safe_referral_target", () => {
    const e = JSON.parse(
      JSON.stringify(REFERRAL_ENVELOPE),
    ) as Record<string, unknown>;
    const payload = e.public_recall_payload as Record<string, unknown>;
    delete payload.safe_referral_target;
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      /safe_referral_target/,
    );
  });

  test("rejects an envelope with an unknown outcome", () => {
    const e = JSON.parse(
      JSON.stringify(PUBLIC_DISCORD_ENVELOPE),
    ) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).outcome = "exploding";
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      /outcome/,
    );
  });
});

describe("adaptDixieEnvelopeToRecallProjection · target options", () => {
  test("default target picked from envelope.target_projection.recall_interface", () => {
    const dto = adaptDixieEnvelopeToRecallProjection(PUBLIC_DISCORD_ENVELOPE);
    expect((dto as Record<string, unknown>).recall_interface).toBe(
      "public_discord",
    );
  });

  test("explicit public_discord target produces a public_discord DTO", () => {
    const dto = adaptDixieEnvelopeToRecallProjection(PUBLIC_DISCORD_ENVELOPE, {
      target: "public_discord",
    });
    expect((dto as Record<string, unknown>).render_surface).toBe(
      "discord_public_character",
    );
  });

  test("authorized_private_session target fails closed with a stable code", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(PUBLIC_DISCORD_ENVELOPE, {
        target: "authorized_private_session",
      }),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(PUBLIC_DISCORD_ENVELOPE, {
        target: "authorized_private_session",
      });
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "authorized_private_projection_not_implemented",
      );
    }
  });

  test("public_telegram target fails closed (no shipped renderer in Phase 35D)", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(PUBLIC_DISCORD_ENVELOPE, {
        target: "public_telegram",
      }),
    ).toThrow(/public_telegram/);
  });

  test("unknown-version envelope still fails closed under adaptDixieEnvelopeToRecallProjection", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(UNKNOWN_VERSION_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(UNKNOWN_VERSION_ENVELOPE);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "unsupported_dixie_envelope_version",
      );
    }
  });
});

describe("adapter is the narrowing boundary · raw envelope never reaches the renderer", () => {
  test("renderer rejects a raw recorded Dixie envelope", () => {
    // The renderer is bound to the projected-DTO contract, not to Dixie
    // envelopes. Passing a raw envelope must fail closed inside the
    // renderer, proving the adapter is the only path that can produce a
    // renderable DTO.
    expect(() =>
      renderPublicRecallProjection(PUBLIC_DISCORD_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
    expect(() => renderPublicRecallProjection(REFERRAL_ENVELOPE)).toThrow(
      PublicRecallRenderError,
    );
    expect(() =>
      renderPublicRecallProjection(UNKNOWN_VERSION_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });

  test("rendered public output from adapted public envelope has no banned substrings", () => {
    const dto = adaptDixieEnvelopeToPublicRecallProjection(
      PUBLIC_DISCORD_ENVELOPE,
    );
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("rendered public output from adapted referral envelope has no banned substrings", () => {
    const dto = adaptDixieEnvelopeToPublicRecallProjection(REFERRAL_ENVELOPE);
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("adapter is offline / pure · no live integration imports", () => {
  test("adapter source imports nothing that could produce I/O", () => {
    const adapterSource = readFileSync(
      resolve(__dirname, "./dixie-envelope-adapter.ts"),
      "utf8",
    );
    const FORBIDDEN_IMPORT_FRAGMENTS = [
      "discord.js",
      "node-telegram",
      "telegraf",
      "@anthropic-ai/claude-agent-sdk",
      "@anthropic-ai/sdk",
      "@loa/dixie",
      "@loa/straylight",
      "@loa/finn",
      "fetch(",
      "node:http",
      "node:https",
      "node:net",
      "node:fs",
      "node:child_process",
    ];
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      expect(adapterSource).not.toContain(fragment);
    }
  });
});

// Anti-vacuity: prove the SOURCE fixtures actually contain the planted raw /
// private / debug sentinels before adaptation. Without this, the no-leak
// assertions on the adapted DTO and rendered text could be vacuously true if
// someone quietly cleaned the fixtures. These tests fail loudly in that case
// so the rest of the proof cannot drift into vacuity.
describe("source fixture sentinel presence · no-leak proof is non-vacuous", () => {
  const REQUIRED_SOURCE_SENTINELS = [
    "PRIVATE_SENTINEL",
    "raw_dixie_debug",
    "raw_session_trace",
    "raw_reasons",
    "source_material",
    "session_id",
    "message_id",
    "continuity_actor_id",
  ] as const;

  function rawFixture(name: string): string {
    return readFileSync(resolve(FIXTURE_DIR, name), "utf8");
  }

  test("recorded public Dixie envelope fixture carries every required raw/private sentinel", () => {
    const raw = rawFixture("recorded-public-discord-recall-envelope.v0.json");
    for (const sentinel of REQUIRED_SOURCE_SENTINELS) {
      expect(raw).toContain(sentinel);
    }
  });

  test("recorded referral Dixie envelope fixture carries every required raw/private sentinel", () => {
    const raw = rawFixture("recorded-referral-recall-envelope.v0.json");
    for (const sentinel of REQUIRED_SOURCE_SENTINELS) {
      expect(raw).toContain(sentinel);
    }
  });

  test("recorded unknown-version Dixie envelope fixture carries every required raw/private sentinel", () => {
    const raw = rawFixture("recorded-unknown-version-envelope.json");
    for (const sentinel of REQUIRED_SOURCE_SENTINELS) {
      expect(raw).toContain(sentinel);
    }
  });
});

// The adapter is the narrowing boundary. Even though it only reads named
// allowlist fields, an allowed field's STRING VALUE could still smuggle
// banned material. The adapter must reject before returning, not delegate
// to the renderer's defense-in-depth scan.
describe("adapter fails closed when allowed payload fields smuggle banned material", () => {
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  test("public_summary smuggling PRIVATE_SENTINEL trips the projection scan", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_summary =
      "PRIVATE_SENTINEL_SHOULD_FAIL";
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("public_reason_labels containing 'raw_reasons' trips the projection scan", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_reason_labels =
      ["redacted_for_public_surface", "raw_reasons"];
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("public_reason_counts with a key carrying 'source_material' trips the projection scan", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_reason_counts =
      {
        redacted_for_public_surface: 1,
        smuggled_source_material_key: 2,
      };
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("public_reason_counts with a contaminated STRING value trips the scan before numeric filtering", () => {
    // Without the pre-normalization scan, the adapter's existing
    // finite-non-negative-int filter on public_reason_counts would silently
    // drop this entry and return a DTO with public_reason_counts: {} —
    // erasing contamination instead of failing closed. The pre-normalization
    // scan must catch the raw payload before that filter runs.
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_reason_counts =
      {
        redacted_for_public_surface: "source_material",
      };
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("public_reason_counts contaminated string value also fails closed via adaptDixieEnvelopeToRecallProjection({ target: 'public_discord' })", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_reason_counts =
      {
        redacted_for_public_surface: "source_material",
      };
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(e, { target: "public_discord" }),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(e, { target: "public_discord" });
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("public_reason_counts with PRIVATE_SENTINEL embedded in a string value also trips the scan", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_reason_counts =
      {
        redacted_for_public_surface: "PRIVATE_SENTINEL_LEAK",
      };
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("character_frame smuggling actor identifier trips the projection scan", () => {
    const e = clone(PUBLIC_DISCORD_ENVELOPE) as Record<string, unknown>;
    (e.target_projection as Record<string, unknown>).character_frame =
      "freeside-characters:shared-substrate";
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("referral public_referral_message smuggling debug substring trips the projection scan", () => {
    const e = clone(REFERRAL_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_referral_message =
      "that lives closer to satoshi — debug payload PRIVATE_SENTINEL";
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("referral safe_referral_target smuggling session_id trips the projection scan", () => {
    const e = clone(REFERRAL_ENVELOPE) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).safe_referral_target =
      "satoshi-session_id-leak";
    expect(() => adaptDixieEnvelopeToPublicRecallProjection(e)).toThrow(
      DixieEnvelopeAdapterError,
    );
    try {
      adaptDixieEnvelopeToPublicRecallProjection(e);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });

  test("scan also fires through the broader adaptDixieEnvelopeToRecallProjection entry point", () => {
    const e = JSON.parse(
      JSON.stringify(PUBLIC_DISCORD_ENVELOPE),
    ) as Record<string, unknown>;
    (e.public_recall_payload as Record<string, unknown>).public_summary =
      "summary PRIVATE_SENTINEL_OPERATOR_ONLY";
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(e, { target: "public_discord" }),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(e, { target: "public_discord" });
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "banned_private_material_in_projection",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 36B · expanded recorded Dixie envelope corpus.
//
// Six new fixtures: refusal/unauthorized, session-bearing,
// authorized_private_session-target negative, public_telegram-target
// negative, malformed-missing-payload, malformed-missing-target. The block
// below exercises each through the adapter and proves:
//
//   - positive fixtures (refusal, session-bearing) adapt and render
//     through `renderPublicRecallProjection` without leaking;
//   - the session-bearing fixture's session_id / message_id /
//     tenant_id / community_id / session_thread_id never reach the
//     adapted DTO or rendered text;
//   - negative fixtures fail closed with their expected stable error
//     code (authorized_private_projection_not_implemented,
//     public_telegram_projection_not_implemented,
//     missing_public_recall_payload, target-resolution error);
//   - the unknown-version fixture's existing fail-closed behavior is
//     unchanged;
//   - raw envelopes never reach the renderer for any new fixture;
//   - the existing Phase 35D no-leak behavior is preserved.
// ---------------------------------------------------------------------------

const REFUSAL_UNAUTHORIZED_ENVELOPE = loadFixture(
  "recorded-refusal-unauthorized-envelope.v0.json",
);
const SESSION_BEARING_ENVELOPE = loadFixture(
  "recorded-session-bearing-public-recall-envelope.v0.json",
);
const AUTHORIZED_PRIVATE_TARGET_ENVELOPE = loadFixture(
  "recorded-authorized-private-target-envelope.v0.json",
);
const PUBLIC_TELEGRAM_TARGET_ENVELOPE = loadFixture(
  "recorded-public-telegram-target-envelope.v0.json",
);
const MALFORMED_MISSING_PAYLOAD_ENVELOPE = loadFixture(
  "recorded-malformed-missing-payload-envelope.v0.json",
);
const MALFORMED_MISSING_TARGET_ENVELOPE = loadFixture(
  "recorded-malformed-missing-target-envelope.v0.json",
);

describe("phase 36b · refusal/unauthorized envelope (positive — public-safe refusal)", () => {
  // The refusal/unauthorized envelope reuses the existing public-safe
  // contract: outcome=referral + denied_or_refused=true + a generic
  // safe_referral_target / public_referral_message. It is NOT a positive
  // authorized_private_session projection; it is a public-safe billboard
  // shaped to communicate that the requested view is unavailable on this
  // surface. This matches the adapter's existing two-outcome contract
  // ("ok" or "referral") without expanding the outcome enum.

  const dto = adaptDixieEnvelopeToPublicRecallProjection(
    REFUSAL_UNAUTHORIZED_ENVELOPE,
  );

  test("adapts to a public_discord referral DTO with denied_or_refused", () => {
    expect((dto as Record<string, unknown>).recall_interface).toBe(
      "public_discord",
    );
    expect((dto as Record<string, unknown>).render_surface).toBe(
      "discord_public_character",
    );
    expect((dto as Record<string, unknown>).outcome).toBe("referral");
    expect((dto as Record<string, unknown>).denied_or_refused).toBe(true);
    expect((dto as Record<string, unknown>).safe_referral_target).toBe(
      "authorized_session",
    );
  });

  test("renders safely through the public-safe renderer", () => {
    const text = renderPublicRecallProjection(dto);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("referral");
    expect(text).toContain("authorized_session");
  });

  test("adapted DTO contains no banned/private substrings", () => {
    const banned = dtoContainsBannedSubstring(dto);
    expect(banned).toBeNull();
  });

  test("rendered public output contains no banned/private substrings", () => {
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("renderer rejects the raw refusal envelope (adapter is the narrowing boundary)", () => {
    expect(() =>
      renderPublicRecallProjection(REFUSAL_UNAUTHORIZED_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · session-bearing envelope (positive — operational identifiers stripped)", () => {
  const dto = adaptDixieEnvelopeToPublicRecallProjection(
    SESSION_BEARING_ENVELOPE,
  );

  test("adapts to a public_discord/discord_public_character ok DTO", () => {
    expect((dto as Record<string, unknown>).recall_interface).toBe(
      "public_discord",
    );
    expect((dto as Record<string, unknown>).render_surface).toBe(
      "discord_public_character",
    );
    expect((dto as Record<string, unknown>).outcome).toBe("ok");
    expect((dto as Record<string, unknown>).included_count).toBe(2);
    expect((dto as Record<string, unknown>).redacted_count).toBe(1);
  });

  test("source envelope ACTUALLY carries the operational identifiers (proof is non-vacuous)", () => {
    const env = SESSION_BEARING_ENVELOPE as Record<string, unknown>;
    expect(env.session_id).toBeDefined();
    expect(env.message_id).toBeDefined();
    expect(env.tenant_id).toBeDefined();
    expect(env.community_id).toBeDefined();
    expect(env.session_thread_id).toBeDefined();
  });

  test("session_id / message_id / tenant_id / community_id / session_thread_id do NOT appear on the adapted DTO", () => {
    const obj = dto as Record<string, unknown>;
    expect(obj.session_id).toBeUndefined();
    expect(obj.message_id).toBeUndefined();
    expect(obj.tenant_id).toBeUndefined();
    expect(obj.community_id).toBeUndefined();
    expect(obj.session_thread_id).toBeUndefined();
    expect(obj.continuity_actor_id).toBeUndefined();
    expect(obj.raw_dixie_debug).toBeUndefined();
    expect(obj.raw_session_trace).toBeUndefined();
    expect(obj.source_material).toBeUndefined();
  });

  test("adapted DTO contains no banned/private substrings", () => {
    const banned = dtoContainsBannedSubstring(dto);
    expect(banned).toBeNull();
  });

  test("rendered public output contains no banned/private substrings (and no session/message ids)", () => {
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("rendered public output does not contain the synthetic session/message id values verbatim", () => {
    const text = renderPublicRecallProjection(dto);
    const env = SESSION_BEARING_ENVELOPE as Record<string, unknown>;
    for (const key of [
      "session_id",
      "message_id",
      "tenant_id",
      "community_id",
      "session_thread_id",
    ]) {
      const v = env[key];
      if (typeof v === "string" && v.length > 0) {
        expect(text).not.toContain(v);
      }
    }
  });

  test("renderer rejects the raw session-bearing envelope (adapter is the narrowing boundary)", () => {
    expect(() =>
      renderPublicRecallProjection(SESSION_BEARING_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · authorized_private_session target (negative — fail-closed)", () => {
  test("adaptDixieEnvelopeToRecallProjection fails closed with authorized_private_projection_not_implemented", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(AUTHORIZED_PRIVATE_TARGET_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(AUTHORIZED_PRIVATE_TARGET_ENVELOPE);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "authorized_private_projection_not_implemented",
      );
    }
  });

  test("explicit authorized_private_session target option also fails closed", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(AUTHORIZED_PRIVATE_TARGET_ENVELOPE, {
        target: "authorized_private_session",
      }),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(AUTHORIZED_PRIVATE_TARGET_ENVELOPE, {
        target: "authorized_private_session",
      });
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "authorized_private_projection_not_implemented",
      );
    }
  });

  test("adaptDixieEnvelopeToPublicRecallProjection on this fixture rejects on wrong target (defense in depth)", () => {
    // The narrow public-only entry point doesn't read target_projection
    // before validating it for the public_discord contract; an authorized
    // private target therefore hits wrong_recall_interface_for_target
    // there. Either way, it fails closed and never produces a positive
    // authorized_private_session projection.
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(
        AUTHORIZED_PRIVATE_TARGET_ENVELOPE,
      ),
    ).toThrow(DixieEnvelopeAdapterError);
  });

  test("renderer rejects the raw authorized-private-target envelope", () => {
    expect(() =>
      renderPublicRecallProjection(AUTHORIZED_PRIVATE_TARGET_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · public_telegram target (negative — fail-closed)", () => {
  test("adaptDixieEnvelopeToRecallProjection fails closed with public_telegram_projection_not_implemented", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(PUBLIC_TELEGRAM_TARGET_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(PUBLIC_TELEGRAM_TARGET_ENVELOPE);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "public_telegram_projection_not_implemented",
      );
    }
  });

  test("explicit public_telegram target option also fails closed", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(PUBLIC_TELEGRAM_TARGET_ENVELOPE, {
        target: "public_telegram",
      }),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(PUBLIC_TELEGRAM_TARGET_ENVELOPE, {
        target: "public_telegram",
      });
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "public_telegram_projection_not_implemented",
      );
    }
  });

  test("adaptDixieEnvelopeToPublicRecallProjection on this fixture rejects on wrong target (defense in depth)", () => {
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(
        PUBLIC_TELEGRAM_TARGET_ENVELOPE,
      ),
    ).toThrow(DixieEnvelopeAdapterError);
  });

  test("renderer rejects the raw public-telegram-target envelope", () => {
    expect(() =>
      renderPublicRecallProjection(PUBLIC_TELEGRAM_TARGET_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · malformed-missing-payload (negative — fail-closed)", () => {
  test("adaptDixieEnvelopeToPublicRecallProjection fails closed with missing_public_recall_payload", () => {
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(
        MALFORMED_MISSING_PAYLOAD_ENVELOPE,
      ),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToPublicRecallProjection(
        MALFORMED_MISSING_PAYLOAD_ENVELOPE,
      );
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "missing_public_recall_payload",
      );
    }
  });

  test("adaptDixieEnvelopeToRecallProjection also fails closed (default-target path)", () => {
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(MALFORMED_MISSING_PAYLOAD_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
  });

  test("renderer rejects the raw missing-payload envelope", () => {
    expect(() =>
      renderPublicRecallProjection(MALFORMED_MISSING_PAYLOAD_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · malformed-missing-target (negative — fail-closed)", () => {
  test("adaptDixieEnvelopeToPublicRecallProjection fails closed with missing_target_projection", () => {
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(
        MALFORMED_MISSING_TARGET_ENVELOPE,
      ),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToPublicRecallProjection(
        MALFORMED_MISSING_TARGET_ENVELOPE,
      );
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "missing_target_projection",
      );
    }
  });

  test("adaptDixieEnvelopeToRecallProjection fails closed with unknown_target_projection (target-resolution path)", () => {
    // The broader entry point reads target_projection.recall_interface
    // before projecting; with target_projection absent and no explicit
    // options.target, it hits the unknown_target_projection guard.
    expect(() =>
      adaptDixieEnvelopeToRecallProjection(MALFORMED_MISSING_TARGET_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToRecallProjection(MALFORMED_MISSING_TARGET_ENVELOPE);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "unknown_target_projection",
      );
    }
  });

  test("renderer rejects the raw missing-target envelope", () => {
    expect(() =>
      renderPublicRecallProjection(MALFORMED_MISSING_TARGET_ENVELOPE),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("phase 36b · expanded corpus preserves Phase 35D no-leak behavior", () => {
  // Anti-vacuity: prove every newly-added recorded fixture still carries
  // the planted raw / private / debug sentinels at source, so the
  // "stripped from the adapted DTO" claims above cannot be satisfied
  // simply by a clean fixture.
  const REQUIRED_SOURCE_SENTINELS = [
    "PRIVATE_SENTINEL",
    "raw_dixie_debug",
    "raw_session_trace",
    "raw_reasons",
    "source_material",
    "session_id",
    "message_id",
    "continuity_actor_id",
  ] as const;

  function rawFixture(name: string): string {
    return readFileSync(resolve(FIXTURE_DIR, name), "utf8");
  }

  const FIXTURE_FILES = [
    "recorded-refusal-unauthorized-envelope.v0.json",
    "recorded-session-bearing-public-recall-envelope.v0.json",
    "recorded-authorized-private-target-envelope.v0.json",
    "recorded-public-telegram-target-envelope.v0.json",
    "recorded-malformed-missing-payload-envelope.v0.json",
    "recorded-malformed-missing-target-envelope.v0.json",
  ];

  for (const fname of FIXTURE_FILES) {
    test(`source fixture ${fname} carries every required raw/private sentinel`, () => {
      const raw = rawFixture(fname);
      for (const sentinel of REQUIRED_SOURCE_SENTINELS) {
        expect(raw).toContain(sentinel);
      }
    });
  }

  test("Phase 35D unknown-version fail-closed behavior is unchanged", () => {
    expect(() =>
      adaptDixieEnvelopeToPublicRecallProjection(UNKNOWN_VERSION_ENVELOPE),
    ).toThrow(DixieEnvelopeAdapterError);
    try {
      adaptDixieEnvelopeToPublicRecallProjection(UNKNOWN_VERSION_ENVELOPE);
    } catch (err) {
      expect((err as DixieEnvelopeAdapterError).code).toBe(
        "unsupported_dixie_envelope_version",
      );
    }
  });

  test("Phase 35D normal public envelope still adapts and renders cleanly", () => {
    const dto = adaptDixieEnvelopeToPublicRecallProjection(
      PUBLIC_DISCORD_ENVELOPE,
    );
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("Phase 35D referral envelope still adapts and renders cleanly", () => {
    const dto = adaptDixieEnvelopeToPublicRecallProjection(REFERRAL_ENVELOPE);
    const text = renderPublicRecallProjection(dto);
    for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });
});
