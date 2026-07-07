// Phase 33D · cross-interface continuity demo regression gate.
//
// Drives the deterministic fixture-bound demo against the Phase 33B
// projected-DTO fixtures and the Phase 33C public-safe renderer, proving
// the §1 boundary requirements: same seed packet, same continuity actor,
// different authorized views, public-safe output, no leak of any private
// material on the public surface.
//
// Fixture-only. No live Discord/Dixie/Straylight/Finn integration is
// touched here.

import { describe, test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PublicRecallRenderError,
  renderPublicRecallProjection,
} from "./render-public-recall.ts";
import {
  buildRecallWedgeCrossInterfaceDemo,
  loadRecallWedgeFixtures,
  renderRecallWedgeCrossInterfaceDemo,
} from "./demo-cross-interface.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURE_DIR = resolve(REPO_ROOT, "docs/recall-wedge/fixtures");
const VALIDATOR = resolve(FIXTURE_DIR, "validate-fixtures.mjs");
const PROJECTED_DIR = resolve(FIXTURE_DIR, "projected-dto");

function loadProjected(name: string): unknown {
  return JSON.parse(readFileSync(resolve(PROJECTED_DIR, name), "utf8"));
}

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

describe("phase 33b validator (regression gate)", () => {
  test("validate-fixtures.mjs exits 0 against the shipped fixtures", () => {
    // Throws non-zero exit -> test fails.
    const out = execFileSync("node", [VALIDATOR], { encoding: "utf8" });
    expect(out).toContain("ok — all phase 33b fixture invariants hold");
  });
});

describe("phase 33c renderer (regression gate against fixtures)", () => {
  test("renders the public-discord DTO", () => {
    const text = renderPublicRecallProjection(
      loadProjected("public-discord-view.dto.json"),
    );
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("[recall · public · ruggy · ok]");
  });

  test("renders the character-boundary referral DTO", () => {
    const text = renderPublicRecallProjection(
      loadProjected("character-boundary-referral.dto.json"),
    );
    expect(text).toContain("referral target: satoshi");
  });

  test("rejects the operator-private DTO with a typed render error", () => {
    expect(() =>
      renderPublicRecallProjection(
        loadProjected("operator-private-view.dto.json"),
      ),
    ).toThrow(PublicRecallRenderError);
  });
});

describe("buildRecallWedgeCrossInterfaceDemo · structural shape", () => {
  const demo = buildRecallWedgeCrossInterfaceDemo();

  test("exposes the seed fixture id from the seed packet", () => {
    expect(demo.seed_fixture_id).toBe("shared-substrate-demo-001");
  });

  test("exposes the internal continuity actor id (structured proof field only)", () => {
    expect(demo.continuity_actor_id_internal).toBe(
      "freeside-characters:shared-substrate",
    );
  });

  test("includes operator_private, public_discord, and character_boundary_referral views", () => {
    expect(demo.views.operator_private.recall_interface).toBe(
      "operator_private",
    );
    expect(demo.views.operator_private.render_surface).toBe("operator_debug");
    expect(demo.views.public_discord.recall_interface).toBe("public_discord");
    expect(demo.views.public_discord.render_surface).toBe(
      "discord_public_character",
    );
    expect(demo.views.character_boundary_referral.recall_interface).toBe(
      "public_discord",
    );
    expect(demo.views.character_boundary_referral.render_surface).toBe(
      "discord_public_character",
    );
  });

  test("renderRecallWedgeCrossInterfaceDemo is an alias of buildRecallWedgeCrossInterfaceDemo", () => {
    const a = buildRecallWedgeCrossInterfaceDemo();
    const b = renderRecallWedgeCrossInterfaceDemo();
    expect(a).toEqual(b);
  });

  test("accepts injected fixtures for deterministic test composition", () => {
    const fixtures = loadRecallWedgeFixtures();
    const injected = buildRecallWedgeCrossInterfaceDemo(fixtures);
    expect(injected.seed_fixture_id).toBe("shared-substrate-demo-001");
  });
});

describe("buildRecallWedgeCrossInterfaceDemo · continuity proof", () => {
  const demo = buildRecallWedgeCrossInterfaceDemo();

  test("same seed fixture across all views", () => {
    expect(demo.proof.same_seed_fixture).toBe(true);
    // Mechanically prove: the seed packet's fixture_id is referenced by every
    // projected DTO via source_seed_fixture — operator-private, public-
    // discord, and the character-boundary referral. Same packet under three
    // authorized frames is the §1 boundary requirement.
    const fixtures = loadRecallWedgeFixtures();
    expect(fixtures.seed.fixture_id).toBe(demo.seed_fixture_id);
    expect(fixtures.operatorPrivate.source_seed_fixture).toBe(
      demo.seed_fixture_id,
    );
    expect(fixtures.publicDiscord.source_seed_fixture).toBe(
      demo.seed_fixture_id,
    );
    expect(fixtures.characterBoundaryReferral.source_seed_fixture).toBe(
      demo.seed_fixture_id,
    );
  });

  test("same_seed_fixture is false if publicDiscord points elsewhere (negative regression)", () => {
    const fixtures = loadRecallWedgeFixtures();
    const mutated = {
      ...fixtures,
      publicDiscord: {
        ...fixtures.publicDiscord,
        source_seed_fixture: "some-other-seed-fixture-999",
      },
    };
    const result = buildRecallWedgeCrossInterfaceDemo(mutated);
    expect(result.proof.same_seed_fixture).toBe(false);
  });

  test("same_seed_fixture is false if characterBoundaryReferral points elsewhere (negative regression)", () => {
    const fixtures = loadRecallWedgeFixtures();
    const mutated = {
      ...fixtures,
      characterBoundaryReferral: {
        ...fixtures.characterBoundaryReferral,
        source_seed_fixture: "some-other-seed-fixture-999",
      },
    };
    const result = buildRecallWedgeCrossInterfaceDemo(mutated);
    expect(result.proof.same_seed_fixture).toBe(false);
  });

  test("same internal continuity actor across all views", () => {
    expect(demo.proof.same_continuity_actor_internal).toBe(true);
    const fixtures = loadRecallWedgeFixtures();
    const expected = demo.continuity_actor_id_internal;
    expect(fixtures.seed.continuity_actor_id).toBe(expected);
    expect(fixtures.operatorPrivate.continuity_actor_id).toBe(expected);
    expect(fixtures.publicDiscord.continuity_actor_id).toBe(expected);
    expect(fixtures.characterBoundaryReferral.continuity_actor_id).toBe(
      expected,
    );
  });

  test("operator-private view is not publicly renderable", () => {
    expect(demo.views.operator_private.renderable_publicly).toBe(false);
    expect(demo.views.operator_private.reason).toBe(
      "operator_private_not_public_renderable",
    );
    expect(demo.views.operator_private.rendered_text).toBeUndefined();
  });

  test("public-discord and referral views are publicly renderable", () => {
    expect(demo.views.public_discord.renderable_publicly).toBe(true);
    expect(demo.views.character_boundary_referral.renderable_publicly).toBe(
      true,
    );
    expect(typeof demo.views.public_discord.rendered_text).toBe("string");
    expect(
      typeof demo.views.character_boundary_referral.rendered_text,
    ).toBe("string");
  });

  test("produces at least two different public-safe outputs (normal recall + referral)", () => {
    expect(demo.proof.different_authorized_views).toBe(true);
    expect(demo.views.public_discord.rendered_text).not.toBe(
      demo.views.character_boundary_referral.rendered_text,
    );
  });
});

describe("buildRecallWedgeCrossInterfaceDemo · no-leak proof on public surface", () => {
  const demo = buildRecallWedgeCrossInterfaceDemo();

  test("proof flag reports public outputs are leak-free", () => {
    expect(demo.proof.public_outputs_no_leak).toBe(true);
  });

  for (const banned of PUBLIC_OUTPUT_BANNED_SUBSTRINGS) {
    test(`public_discord rendered text contains no "${banned}"`, () => {
      expect(demo.views.public_discord.rendered_text).not.toContain(banned);
    });
    test(`character_boundary_referral rendered text contains no "${banned}"`, () => {
      expect(demo.views.character_boundary_referral.rendered_text).not.toContain(
        banned,
      );
    });
  }

  test("public-surface outputs do not begin any line with actor:", () => {
    const pub = demo.views.public_discord.rendered_text ?? "";
    const ref = demo.views.character_boundary_referral.rendered_text ?? "";
    for (const line of pub.split("\n")) {
      expect(line.startsWith("actor:")).toBe(false);
    }
    for (const line of ref.split("\n")) {
      expect(line.startsWith("actor:")).toBe(false);
    }
  });

  test("public-surface outputs never reveal the internal continuity actor id", () => {
    const pub = demo.views.public_discord.rendered_text ?? "";
    const ref = demo.views.character_boundary_referral.rendered_text ?? "";
    expect(pub).not.toContain(demo.continuity_actor_id_internal);
    expect(ref).not.toContain(demo.continuity_actor_id_internal);
  });

  test("public-surface outputs do not include the operator-private summary", () => {
    const fixtures = loadRecallWedgeFixtures();
    const opSummary = String(
      fixtures.operatorPrivate.operator_private_summary ?? "",
    );
    expect(opSummary.length).toBeGreaterThan(0);
    const pub = demo.views.public_discord.rendered_text ?? "";
    const ref = demo.views.character_boundary_referral.rendered_text ?? "";
    expect(pub).not.toContain(opSummary);
    expect(ref).not.toContain(opSummary);
  });
});

describe("buildRecallWedgeCrossInterfaceDemo · voiceless billboard posture", () => {
  // Per docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md §12 the recall surface is a
  // voiceless / data-billboard. These spot-checks lock in that the
  // demo's rendered text comes structurally from the renderer (counts,
  // labels, generic referral text) and not from any LLM rewrite.
  const demo = buildRecallWedgeCrossInterfaceDemo();

  test("public-discord text uses billboard markers, not character voice", () => {
    const text = demo.views.public_discord.rendered_text ?? "";
    expect(text).toContain("[recall · public · ");
    expect(text).toContain("counts:");
    expect(text).toContain("labels:");
  });

  test("referral text uses generic referral framing, not character voice", () => {
    const text = demo.views.character_boundary_referral.rendered_text ?? "";
    expect(text).toContain("referral target:");
    expect(text).toContain("referral message:");
  });
});
