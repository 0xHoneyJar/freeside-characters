/**
 * quest-runtime-bootstrap.ts — memory-mode QuestRuntime constructor for QA
 * dogfood (cycle-Q post-merge).
 *
 * Per CLAUDE.md operator authorization 2026-05-04 PM ("/autonomous so I can
 * QA test with mongolian"): unblocks Q3.7 KEEPER felt-pass via Discord
 * without Q2.9 DB migration. Memory adapter only · production runtime
 * stays operator-bounded (real world-manifest source + per-world Pg pools).
 *
 * Architect locks honored:
 *   - A2: QuestStatePort Tag identity preserved (this module only constructs
 *     QuestRuntime — does not touch the Tag string at all).
 *   - A4: substrate does NOT dereference rubric_pointer · the catalog stub
 *     ships a codex_ref pointer that the construct (LLM) would resolve at
 *     judgment time · NOT here.
 *   - A6: Munkh persona body is curator territory · this module ships
 *     SUBSTRATE scaffolding only. voice_cadence stays empty · falls back
 *     to phaseToNarrative substrate default until Track A populates.
 */

import { Effect } from "effect";
import type {
  CharacterRegistry,
  CuratorVoiceProfile,
  QuestCatalog,
} from "@0xhoneyjar/quests-discord-renderer";
import type {
  Quest,
  QuestId,
  NpcId,
  WorldSlug,
  BadgeFamilyId,
  PlayerIdentity,
  DiscordId,
} from "@0xhoneyjar/quests-protocol";
import type { CharacterConfig } from "@freeside-characters/persona-engine";
import type { QuestRuntime } from "./discord-interactions/quest-dispatch.ts";
import type {
  WorldPgPoolFactory,
} from "./quest-runtime.ts";
import type { WorldManifestQuestSubset } from "./world-resolver.ts";
import type { DiscordInteraction } from "./discord-interactions/types.ts";

// ---------------------------------------------------------------------------
// Stub catalog content (cell_id is a placeholder · construct-mongolian
// authoring lives at construct-mibera-codex#76 per Track A boundary)
// ---------------------------------------------------------------------------

const STUB_QUEST_ID = "munkh-introduction-v1";
const STUB_WORLD_SLUG = "mongolian";
const STUB_NPC_ID = "mongolian";

/**
 * Build the stub quest. The fields here are SUBSTRATE shapes — no curator
 * voice. The construct (LLM-bound) dereferences rubric_pointer at judgment
 * time per architect lock A4.
 */
const buildStubQuest = (): Quest =>
  ({
    quest_id: STUB_QUEST_ID as unknown as QuestId,
    npc_pointer: STUB_NPC_ID as unknown as NpcId,
    world_slug: STUB_WORLD_SLUG as unknown as WorldSlug,
    title: "Why did you come?",
    prompt:
      "Share why you came · what brought you to the steppe today. A few lines is enough · the wind carries everything you do not say.",
    rubric_pointer: {
      type: "codex_ref",
      construct_slug: "construct-mongolian",
      cell_id: "stub-v1-munkh-quest",
    },
    badge_spec: {
      family_id: "mongolian-petroglyph-stub" as unknown as BadgeFamilyId,
      display_name: "First Mark on the Steppe",
      prompt_seed:
        "A simple petroglyph carved into weathered stone · the first mark a traveler leaves on Mongolian soil.",
      format_hint: "webp",
    },
    published_at: new Date("2026-05-04T00:00:00Z").toISOString(),
    step_count: 1,
    contract_version: "1.0.0",
  }) as Quest;

// ---------------------------------------------------------------------------
// Bootstrap options
// ---------------------------------------------------------------------------

export interface MemoryDevQuestRuntimeOptions {
  /**
   * Discord guild ID the dev/QA server uses. The stub world manifest
   * declares this as the only `guild_ids` entry so resolveWorldForGuild
   * matches it. If undefined or empty string, the stub world manifest
   * declares NO guild_ids · the resolver returns null for every guild
   * · /quest returns the polite "no quest path yet" reply.
   */
  readonly devGuildId?: string;
  /**
   * Loaded characters (from character-loader). Used to construct the
   * CharacterRegistry · resolveDisplayName maps NpcId → displayName.
   */
  readonly characters: readonly CharacterConfig[];
}

// ---------------------------------------------------------------------------
// CharacterRegistry · NpcId → displayName
// ---------------------------------------------------------------------------

const buildCharacterRegistry = (
  characters: readonly CharacterConfig[],
): CharacterRegistry => {
  const map = new Map<string, string>();
  for (const c of characters) {
    if (c.displayName) map.set(c.id, c.displayName);
  }
  return {
    resolveDisplayName: (npc_id: string) => map.get(npc_id),
  };
};

// ---------------------------------------------------------------------------
// QuestCatalog · in-memory single-quest catalog scoped to STUB_WORLD_SLUG
// ---------------------------------------------------------------------------

const buildMemoryCatalog = (): QuestCatalog => {
  const stub = buildStubQuest();
  return {
    listAvailableQuests: (worldSlug: string) =>
      Effect.succeed(worldSlug === STUB_WORLD_SLUG ? [stub] : []),
    findQuest: (worldSlug: string, quest_id: string) =>
      Effect.succeed(
        worldSlug === STUB_WORLD_SLUG && quest_id === STUB_QUEST_ID
          ? stub
          : undefined,
      ),
  };
};

// ---------------------------------------------------------------------------
// resolvePlayer · Discord interaction → PlayerIdentity (anon-default per D4)
// ---------------------------------------------------------------------------

const DISCORD_ID_PATTERN = /^\d{17,20}$/;

const buildResolvePlayer = (): ((
  interaction: DiscordInteraction,
) => PlayerIdentity | null) => {
  return (interaction: DiscordInteraction): PlayerIdentity | null => {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!userId) return null;
    if (!DISCORD_ID_PATTERN.test(userId)) return null;
    return {
      type: "anon",
      discord_id: userId as unknown as DiscordId,
    };
  };
};

// ---------------------------------------------------------------------------
// World manifest stub
// ---------------------------------------------------------------------------

const buildWorldManifests = (
  devGuildId: string | undefined,
): readonly WorldManifestQuestSubset[] => {
  const guild_ids =
    devGuildId && devGuildId.trim().length > 0 ? [devGuildId] : [];
  return [
    {
      slug: STUB_WORLD_SLUG,
      quest_namespace: "mongolian-stub",
      quest_engine_config: {
        questAcceptanceMode: "open",
        submissionStyle: "inline_thread",
        positiveFrictionDelayMs: 12000,
      },
      guild_ids,
    },
  ];
};

// ---------------------------------------------------------------------------
// Pg pool factory · always null (memory adapter only)
// ---------------------------------------------------------------------------

const memoryOnlyPgPools: WorldPgPoolFactory = {
  poolForWorld: () => null,
};

// ---------------------------------------------------------------------------
// Voice profile · empty stub. phaseToNarrative falls back to substrate
// default cadence per CMP-boundary T4. Track A (Gumi) populates per-phase
// cadence in persona.yaml/character.json voice_cadence post-handoff.
// ---------------------------------------------------------------------------

const emptyVoiceProfile: CuratorVoiceProfile = {};

// ---------------------------------------------------------------------------
// Public constructor
// ---------------------------------------------------------------------------

/**
 * Build a memory-mode QuestRuntime suitable for Discord dev-guild QA.
 *
 * Backed by:
 *   - in-memory catalog with one stub quest (`munkh-introduction-v1`)
 *   - one stub world manifest scoped to `devGuildId` (if provided)
 *   - memory QuestStatePort (no Pg) · state lives in-process · resets on bot restart
 *   - anon-only player identity (per PRD D4 anon-allowed default)
 *   - empty voice profile · substrate cadence fallback
 *
 * Returns a QuestRuntime the bot wires via `setQuestRuntime` at boot.
 */
export const buildMemoryDevQuestRuntime = (
  opts: MemoryDevQuestRuntimeOptions,
): QuestRuntime => {
  return {
    worldManifests: buildWorldManifests(opts.devGuildId),
    catalog: buildMemoryCatalog(),
    characters: buildCharacterRegistry(opts.characters),
    voice: emptyVoiceProfile,
    pgPools: memoryOnlyPgPools,
    resolvePlayer: buildResolvePlayer(),
  };
};

// Re-export the stub identifiers for tests + observability.
export const MEMORY_DEV_STUB_QUEST_ID = STUB_QUEST_ID;
export const MEMORY_DEV_STUB_WORLD_SLUG = STUB_WORLD_SLUG;
export const MEMORY_DEV_STUB_NPC_ID = STUB_NPC_ID;
