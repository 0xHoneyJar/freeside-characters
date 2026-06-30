/**
 * ingestion/discord-roster-producer.ts — the Discord ingestion angle
 * (cycle-010 S1.5; SDD §4.1a). Maps the guild roster → `discord.member.snapshot.v1`.
 *
 * Wraps a READ-ONLY member reader (injected, so tests are network-free; the live
 * wiring backs it with `member-source.live.ts` → `guild.members.fetch`, the
 * opcode-8-cached read). It NEVER mutates Discord. Phase A, required.
 *
 * VOICELESS: structural read → events. No persona.
 */
import type { GuildMemberRef } from "../member-roster.ts";
import { makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { SourceProducer, WorldRef } from "./source-producer.ts";

/** Injected, network-free roster reader (live adapter = member-source.live.ts). */
export type RosterReader = (world: WorldRef) => Promise<ReadonlyArray<GuildMemberRef>>;

export interface DiscordRosterProducerDeps {
  readonly readRoster: RosterReader;
  /** ISO timestamp of the snapshot; injected for deterministic tests. */
  readonly observedAt: () => string;
}

export function makeDiscordRosterProducer(
  deps: DiscordRosterProducerDeps,
): SourceProducer {
  return {
    kind: "discord",
    criticality: "required",
    phase: "A",
    async produce(world: WorldRef): Promise<ReadonlyArray<ShadowEvent>> {
      const members = await deps.readRoster(world);
      const observed_at = deps.observedAt();
      return members.map((m: GuildMemberRef) =>
        makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
          "discord.member.snapshot.v1",
          {
            discord_user_id: m.discord_id,
            display_name: m.display_name,
            role_ids: [...m.current_managed_roles],
          },
          {
            community_id: world.community_id,
            source: "discord",
            truth_status: "observed_only",
            observed_at,
            emitted_at: observed_at,
          },
        ),
      );
    },
  };
}
