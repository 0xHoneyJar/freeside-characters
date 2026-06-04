/**
 * composition-root.test.ts — the SHADOW-vs-LIVE ScoreSource selection
 * (Bridgebuilder #3). The pre-fix `resolveScoreLayer` returned the MOCK
 * ScoreSource (zeros) for an unwired world REGARDLESS of mode — a fail-OPEN in
 * the gated LIVE path (a LIVE go_live would read mock-zeros and create roles
 * assigning nobody). The fix makes it MODE-AWARE: LIVE fails closed
 * (LiveScoreWiringMissingError) when wiring is absent; MOCK fallback is allowed
 * ONLY for SHADOW preview.
 *
 * These tests exercise the PUBLIC layer builders (liveApplyLayer /
 * shadowPreviewLayer). They build Layers only — no Discord, NATS, or pg I/O
 * (everything is lazy; the score-wiring check fires synchronously at build).
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { Signer } from "@0xhoneyjar/events";
import {
  liveApplyLayer,
  shadowPreviewLayer,
  buildModeControl,
  LiveScoreWiringMissingError,
  type ShadowDeps,
  type LiveAuditDeps,
  type WorldScoreWiring,
} from "./composition-root.ts";
import { makeRecordingEmitter } from "./acvp-emitter.mock.ts";

const WORLD = "purupuru";

function baseDeps(over: Partial<ShadowDeps> = {}): ShadowDeps {
  return {
    getBotClient: async () => null,
    resolveWorld: () => ({ guild_id: "111122223333444455", namespace_prefix: "purupuru:" }),
    manifestPath: () => "/tmp/does-not-exist-purupuru.yaml",
    world: WORLD,
    initialMode: "SHADOW",
    ...over,
  };
}

// a stub audit boundary (lazy — signer/nats only touched at emit time).
const auditStub: LiveAuditDeps = {
  nats: { publish: () => undefined },
  signer: {} as unknown as Signer,
};

const liveWiring = (apiKey: string | undefined): ((w: string) => WorldScoreWiring | undefined) =>
  () => ({ scoreApiUrl: "https://score-api.test", community: "purupuru", apiKey });

describe("resolveScoreLayer (via the layer builders) — mode-aware fail-closed (#3)", () => {
  test("LIVE with NO score wiring (no resolveScoreWiring) FAILS CLOSED", async () => {
    const mode = await Effect.runPromise(buildModeControl("LIVE"));
    expect(() => liveApplyLayer(baseDeps(), auditStub, mode, () => "h".repeat(64))).toThrow(
      LiveScoreWiringMissingError,
    );
  });

  test("LIVE with wiring but NO apiKey FAILS CLOSED (mock-zeros never feeds the gated path)", async () => {
    const mode = await Effect.runPromise(buildModeControl("LIVE"));
    const deps = baseDeps({ resolveScoreWiring: liveWiring(undefined) });
    expect(() => liveApplyLayer(deps, auditStub, mode, () => "h".repeat(64))).toThrow(
      LiveScoreWiringMissingError,
    );
  });

  test("LIVE WITH a real apiKey builds the live stack (no throw)", async () => {
    const mode = await Effect.runPromise(buildModeControl("LIVE"));
    const deps = baseDeps({ resolveScoreWiring: liveWiring("sk-live-key") });
    // builds without throwing — the live ScoreSource is wired.
    expect(() => liveApplyLayer(deps, auditStub, mode, () => "h".repeat(64))).not.toThrow();
  });

  test("SHADOW with NO score wiring is ALLOWED (MOCK fallback) — preview works unprovisioned", async () => {
    const mode = await Effect.runPromise(buildModeControl("SHADOW"));
    const { layer: emitterLayer } = makeRecordingEmitter();
    // MOCK fallback is the whole point of an unprovisioned shadow preview.
    expect(() => shadowPreviewLayer(baseDeps(), mode, () => "h".repeat(64), emitterLayer)).not.toThrow();
  });
});
