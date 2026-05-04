/**
 * quest-dispatch.ts — bridge from freeside-characters bot dispatch into
 * `@freeside-quests/discord-renderer` (cycle-Q · sprint-3 · Q3.5).
 *
 * Per SDD §5.5 + §7.3: the bot consumer constructs the per-guild context
 * (catalog · characters · voice · player) + provides the QuestStatePort
 * Layer, then invokes `dispatchQuestInteraction`.
 *
 * The 937-line dispatch.ts is sensitive (anti-spam guard · circuit breaker ·
 * 14m30s timeout). This module intercepts BEFORE the per-character
 * resolution in dispatch.ts and BEFORE the server.ts fallback for
 * MessageComponent / ModalSubmit · keeps the existing flow untouched
 * for non-quest interactions.
 *
 * NOTE: The runtime composition (catalog source · auth resolution ·
 * voice profile loading · world-manifest source) is operator-paced.
 * Sprint-3 ships a `noQuestRuntime` default that makes the interceptor
 * a no-op until operator wires the runtime. The bot continues to behave
 * exactly as before when `noQuestRuntime` is in effect.
 */

import { Effect, Layer } from "effect";
import {
  dispatchQuestInteraction,
  type CharacterRegistry,
  type CuratorVoiceProfile,
  type EngineConfigShape,
  type QuestCatalog,
} from "@freeside-quests/discord-renderer";
import { QuestStatePort } from "@freeside-quests/engine";
import type { PlayerIdentity } from "@freeside-quests/protocol";
import type {
  DiscordInteraction,
  DiscordInteractionResponse,
} from "./types.ts";
import {
  buildQuestStatePortLayerForGuild,
  type WorldPgPoolFactory,
} from "../quest-runtime.ts";
import type { WorldManifestQuestSubset } from "../world-resolver.ts";
import {
  buildEngineConfigForWorld,
  resolveWorldForGuild,
} from "../world-resolver.ts";

// ---------------------------------------------------------------------------
// Quest runtime — the per-bot binding to the quest substrate
// ---------------------------------------------------------------------------

/**
 * Per-bot runtime for the quest substrate. The bot consumer (this package)
 * constructs this once at boot from CHARACTERS env + world-manifest sources +
 * runtime config (Pg pool factory). Sprint-3 ships an in-memory default for
 * dev guilds; operators wire the production runtime when world-manifest +
 * Pg env vars are populated.
 *
 * The runtime is INJECTED at `dispatchSlashCommand` invocation time so the
 * dispatch.ts surgery is a 3-line interception block, not a refactor.
 */
export interface QuestRuntime {
  readonly worldManifests: readonly WorldManifestQuestSubset[];
  readonly catalog: QuestCatalog;
  readonly characters: CharacterRegistry;
  readonly voice: CuratorVoiceProfile;
  readonly pgPools: WorldPgPoolFactory;
  readonly resolvePlayer: (
    interaction: DiscordInteraction,
  ) => PlayerIdentity | null;
}

/**
 * No-op runtime — makes the quest interceptor return null (defer to
 * existing dispatch). Used until the operator wires the production
 * runtime (catalog + world-manifest + Pg pools).
 */
export const noQuestRuntime: QuestRuntime = {
  worldManifests: [],
  catalog: {
    listAvailableQuests: () => Effect.succeed([]),
    findQuest: () => Effect.succeed(undefined),
  },
  characters: { resolveDisplayName: () => undefined },
  voice: {},
  pgPools: { poolForWorld: () => null },
  resolvePlayer: () => null,
};

// ---------------------------------------------------------------------------
// Interceptor
// ---------------------------------------------------------------------------

const isQuestSlashCommand = (interaction: DiscordInteraction): boolean =>
  interaction.type === 2 /* APPLICATION_COMMAND */ &&
  interaction.data?.name === "quest";

const isQuestButton = (interaction: DiscordInteraction): boolean => {
  if (interaction.type !== 3 /* MESSAGE_COMPONENT */) return false;
  const customId =
    (interaction as unknown as {
      data?: { custom_id?: string };
    }).data?.custom_id ?? "";
  return customId.startsWith("quest_");
};

const isQuestModalSubmit = (interaction: DiscordInteraction): boolean => {
  if (interaction.type !== 5 /* MODAL_SUBMIT */) return false;
  const customId =
    (interaction as unknown as {
      data?: { custom_id?: string };
    }).data?.custom_id ?? "";
  return customId.startsWith("quest_submission_");
};

/**
 * Returns true if this interaction belongs to the quest substrate.
 *
 * Used by both dispatch.ts (slash commands) and server.ts (button +
 * modal_submit) to short-circuit the existing flow.
 */
export const isQuestInteraction = (
  interaction: DiscordInteraction,
): boolean =>
  isQuestSlashCommand(interaction) ||
  isQuestButton(interaction) ||
  isQuestModalSubmit(interaction);

/**
 * Run the quest dispatch pipeline. Returns the Discord interaction
 * response descriptor the caller serializes.
 *
 * If the runtime is the no-op default OR the guild can't be resolved,
 * returns a friendly ephemeral message — the bot doesn't crash on a
 * pre-config quest button click.
 *
 * The QuestStatePort Layer is composed per-guild via
 * `buildQuestStatePortLayerForGuild` — memory adapter for dev guilds
 * (or guilds without a Pg pool), postgres for production worlds.
 */
export const handleQuestInteraction = async (
  interaction: DiscordInteraction,
  runtime: QuestRuntime,
): Promise<DiscordInteractionResponse> => {
  const guildId = interaction.guild_id;
  if (!guildId) {
    return ephemeralReply("quests are guild-only · try again in a server");
  }

  const player = runtime.resolvePlayer(interaction);
  if (!player) {
    return ephemeralReply("could not resolve your identity · contact ops");
  }

  const world = resolveWorldForGuild(guildId, runtime.worldManifests);
  if (!world) {
    return ephemeralReply("this server has no quest path yet");
  }
  const config: EngineConfigShape | null = buildEngineConfigForWorld(world);
  if (!config) {
    return ephemeralReply("the path is being prepared · check back soon");
  }

  const portLayer = buildQuestStatePortLayerForGuild(
    guildId,
    runtime.worldManifests,
    runtime.pgPools,
  );

  // Cast: the dispatcher accepts the discord-api-types union, our internal
  // DiscordInteraction is a structural subset.
  const response = await Effect.runPromise(
    dispatchQuestInteraction({
      interaction: interaction as unknown as Parameters<
        typeof dispatchQuestInteraction
      >[0]["interaction"],
      config,
      catalog: runtime.catalog,
      characters: runtime.characters,
      voice: runtime.voice,
      player,
    }).pipe(Effect.provide(portLayer)),
  );

  return response as unknown as DiscordInteractionResponse;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ephemeralReply = (text: string): DiscordInteractionResponse => ({
  type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
  data: { content: text, flags: 64 },
});

// Prevent unused import warnings while keeping the imports for future
// wiring (Layer + QuestStatePort surface · operator runtime hookup).
void Layer;
void QuestStatePort;
