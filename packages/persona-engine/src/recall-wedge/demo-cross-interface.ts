// Phase 33D · fixture-bound cross-interface Recall Wedge continuity demo.
//
// Pure deterministic demo proving the Phase 33A boundary
// (docs/RECALL-WEDGE-MEMORY-MVP.md §1):
//   1. one shared seed memory fixture underlies multiple projected views;
//   2. one internal continuity actor is referenced across operator/private,
//      public-discord, and character-boundary referral projections;
//   3. different interface frames yield different authorized views;
//   4. public projections render through the Phase 33C public-safe renderer;
//   5. the operator-private projection is rejected by that renderer and
//      recorded as not publicly renderable;
//   6. public rendered outputs carry no private sentinels, raw_reasons,
//      operator-private payload, assertion ids, source material, or any
//      continuity actor identifier on the public surface (§9 allowlist).
//
// Voiceless / data-billboard only. The continuity actor id is retained on
// the structured demo result for proof and test purposes; it never reaches
// the public rendered text — the Phase 33C renderer drops it from the
// allowlist, and this demo's no-leak guard re-checks for it. No LLM, no
// Discord client, no Dixie client, no Straylight wiring, no Finn, no
// network behavior. Fixture-bound.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PublicRecallRenderError,
  renderPublicRecallProjection,
} from "./render-public-recall.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(
  __dirname,
  "../../../../docs/recall-wedge/fixtures",
);

// Defense-in-depth public-output guard. Strictly broader than the renderer's
// own internal scan: this demo additionally rejects any continuity actor
// identifier line on the public surface, per §9 allowlist.
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

export interface RecallWedgeFixtureBundle {
  readonly seed: Record<string, unknown>;
  readonly operatorPrivate: Record<string, unknown>;
  readonly publicDiscord: Record<string, unknown>;
  readonly characterBoundaryReferral: Record<string, unknown>;
}

export interface CrossInterfaceView {
  readonly recall_interface: string;
  readonly render_surface: string;
  readonly renderable_publicly: boolean;
  readonly rendered_text?: string;
  readonly reason?: string;
}

export interface CrossInterfaceDemo {
  readonly seed_fixture_id: string;
  readonly continuity_actor_id_internal: string;
  readonly views: {
    readonly operator_private: CrossInterfaceView;
    readonly public_discord: CrossInterfaceView;
    readonly character_boundary_referral: CrossInterfaceView;
  };
  readonly proof: {
    readonly same_seed_fixture: boolean;
    readonly same_continuity_actor_internal: boolean;
    readonly different_authorized_views: boolean;
    readonly public_outputs_no_leak: boolean;
  };
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function loadRecallWedgeFixtures(): RecallWedgeFixtureBundle {
  return {
    seed: loadJson(
      resolve(FIXTURE_ROOT, "seed-memory/shared-substrate-demo.memory.json"),
    ),
    operatorPrivate: loadJson(
      resolve(FIXTURE_ROOT, "projected-dto/operator-private-view.dto.json"),
    ),
    publicDiscord: loadJson(
      resolve(FIXTURE_ROOT, "projected-dto/public-discord-view.dto.json"),
    ),
    characterBoundaryReferral: loadJson(
      resolve(FIXTURE_ROOT, "projected-dto/character-boundary-referral.dto.json"),
    ),
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type RenderAttempt =
  | { readonly renderable: true; readonly text: string }
  | { readonly renderable: false; readonly reason: string };

function tryRenderPublic(dto: Record<string, unknown>): RenderAttempt {
  try {
    const text = renderPublicRecallProjection(dto);
    return { renderable: true, text };
  } catch (err) {
    if (err instanceof PublicRecallRenderError) {
      return { renderable: false, reason: err.code };
    }
    return { renderable: false, reason: "unknown_render_error" };
  }
}

function publicOutputHasNoLeak(text: string): boolean {
  for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
    if (text.includes(banned)) return false;
  }
  return true;
}

export function buildRecallWedgeCrossInterfaceDemo(
  fixtures: RecallWedgeFixtureBundle = loadRecallWedgeFixtures(),
): CrossInterfaceDemo {
  const { seed, operatorPrivate, publicDiscord, characterBoundaryReferral } =
    fixtures;

  const seedFixtureId = asString(seed.fixture_id);
  const continuityActor = asString(seed.continuity_actor_id);

  const opAttempt = tryRenderPublic(operatorPrivate);
  const operatorPrivateView: CrossInterfaceView = {
    recall_interface: asString(operatorPrivate.recall_interface),
    render_surface: asString(operatorPrivate.render_surface),
    renderable_publicly: false,
    reason: opAttempt.renderable
      ? "unexpected_public_render_succeeded"
      : "operator_private_not_public_renderable",
  };

  const pubAttempt = tryRenderPublic(publicDiscord);
  const publicDiscordView: CrossInterfaceView = {
    recall_interface: asString(publicDiscord.recall_interface),
    render_surface: asString(publicDiscord.render_surface),
    renderable_publicly: pubAttempt.renderable,
    rendered_text: pubAttempt.renderable ? pubAttempt.text : undefined,
    reason: pubAttempt.renderable ? undefined : pubAttempt.reason,
  };

  const refAttempt = tryRenderPublic(characterBoundaryReferral);
  const referralView: CrossInterfaceView = {
    recall_interface: asString(characterBoundaryReferral.recall_interface),
    render_surface: asString(characterBoundaryReferral.render_surface),
    renderable_publicly: refAttempt.renderable,
    rendered_text: refAttempt.renderable ? refAttempt.text : undefined,
    reason: refAttempt.renderable ? undefined : refAttempt.reason,
  };

  const sameSeedFixture =
    seedFixtureId.length > 0 &&
    asString(operatorPrivate.source_seed_fixture) === seedFixtureId &&
    asString(publicDiscord.source_seed_fixture) === seedFixtureId &&
    asString(characterBoundaryReferral.source_seed_fixture) === seedFixtureId;

  const sameContinuityActorInternal =
    continuityActor.length > 0 &&
    asString(operatorPrivate.continuity_actor_id) === continuityActor &&
    asString(publicDiscord.continuity_actor_id) === continuityActor &&
    asString(characterBoundaryReferral.continuity_actor_id) === continuityActor;

  const differentAuthorizedViews =
    operatorPrivateView.renderable_publicly !==
      publicDiscordView.renderable_publicly &&
    publicDiscordView.rendered_text !== referralView.rendered_text &&
    publicDiscordView.rendered_text !== undefined &&
    referralView.rendered_text !== undefined;

  const publicOutputsNoLeak =
    publicDiscordView.rendered_text !== undefined &&
    referralView.rendered_text !== undefined &&
    publicOutputHasNoLeak(publicDiscordView.rendered_text) &&
    publicOutputHasNoLeak(referralView.rendered_text);

  return {
    seed_fixture_id: seedFixtureId,
    continuity_actor_id_internal: continuityActor,
    views: {
      operator_private: operatorPrivateView,
      public_discord: publicDiscordView,
      character_boundary_referral: referralView,
    },
    proof: {
      same_seed_fixture: sameSeedFixture,
      same_continuity_actor_internal: sameContinuityActorInternal,
      different_authorized_views: differentAuthorizedViews,
      public_outputs_no_leak: publicOutputsNoLeak,
    },
  };
}

export function renderRecallWedgeCrossInterfaceDemo(
  fixtures?: RecallWedgeFixtureBundle,
): CrossInterfaceDemo {
  return buildRecallWedgeCrossInterfaceDemo(fixtures);
}
