/**
 * cli/member-graph.ts — RUN the multi-angle ingestion for a world and render the
 * member graph (cycle-010 "make it actually run"). One-shot:
 *
 *   bun run member-graph <world-slug> [--post <channel_id>]
 *   # e.g. bun run member-graph pythenian
 *
 * Wires the LIVE adapters from env and gracefully runs whatever is configured:
 *   • on-chain (sonar)  — SONAR_GRAPHQL_ENDPOINT + SONAR_GRAPHQL_ADMIN_SECRET (works standalone).
 *   • discord roster    — DISCORD_BOT_TOKEN (bot must be in the guild w/ GuildMembers intent).
 *   • identity links    — not yet wired (a follow); skipped with a note.
 *
 * VOICELESS: reads sources, renders structural CV2; mutates no roles. Read-only.
 */
import { readFileSync } from "node:fs";
import { Client, GatewayIntentBits, type Client as DiscordClient } from "discord.js";
import type { GuildMemberRef } from "../shadow/member-roster.ts";
import { makeMemberSourceLive } from "../shadow/member-source.live.ts";
import { makeWalletDiscordLinkLive } from "../shadow/wallet-discord-link.live.ts";
import {
  IngestionOrchestrator,
  InMemoryLedgerStore,
  ShadowLedger,
  makeDiscordRosterProducer,
  makeIdentityLinkProducer,
  makeIdentityLinkReaderLive,
  makeOnChainHolderProducer,
  manifestPathForWorld,
  memberGraphCV2Payload,
  missingFields,
  parseShadowOnboarding,
  renderMemberGraphCV2,
  summarizeGraph,
  type ResolvedWalletLink,
  type SourceProducer,
  type WorldRef,
} from "../shadow/ingestion/index.ts";

function worldRefFromManifest(slug: string): WorldRef {
  const cfg = parseShadowOnboarding(readFileSync(manifestPathForWorld(slug), "utf8"));
  const missing = missingFields(cfg);
  if (missing.length) {
    throw new Error(`manifest '${slug}' incomplete — missing: ${missing.join(", ")}`);
  }
  return {
    community_id: slug,
    world_slug: slug,
    guild_id: cfg.guild_id!,
    namespace_prefix: cfg.namespace_prefix!,
    watched_contracts: [...cfg.watched_contracts!],
    score_community_slug: cfg.score_community_slug!,
  };
}

/** Minimal, self-contained bot client (avoids the heavy bot boot). */
function makeGetBotClient(): () => Promise<DiscordClient | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  let client: DiscordClient | null = null;
  return async () => {
    if (!token) return null;
    if (client) return client;
    const c = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    await c.login(token);
    await new Promise<void>((res) => c.once("clientReady", () => res()).once("ready", () => res()));
    client = c;
    return client;
  };
}

/** Flatten the CV2 container's text components into plain text for stdout. */
function renderToText(container: ReturnType<typeof renderMemberGraphCV2>): string {
  return container.components
    .map((c) => ("content" in c ? c.content : "──────────"))
    .join("\n");
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: bun run member-graph <world-slug> [--post <channel_id>]");
    process.exit(2);
  }
  const postIdx = process.argv.indexOf("--post");
  const postChannel = postIdx >= 0 ? process.argv[postIdx + 1] : undefined;
  // --no-roster: keep the bot token (for --post) but SKIP the full guild.members
  // fetch (a large guild's roster is heavy/rate-limited — a capped run).
  const noRoster = process.argv.includes("--no-roster");

  const world = worldRefFromManifest(slug);
  console.error(`▸ world '${slug}' (guild ${world.guild_id}) · watched: ${world.watched_contracts.join(", ")}`);

  const getBotClient = makeGetBotClient();
  const ledger = new ShadowLedger(new InMemoryLedgerStore());
  const producers: SourceProducer[] = [];

  // on-chain (sonar) — the angle that works standalone.
  if (process.env.SONAR_GRAPHQL_ENDPOINT) {
    producers.push(
      makeOnChainHolderProducer({
        sonar: {
          endpoint: process.env.SONAR_GRAPHQL_ENDPOINT,
          adminSecret: process.env.SONAR_GRAPHQL_ADMIN_SECRET,
          maxHolders: Number(process.env.SONAR_MAX_HOLDERS ?? 10_000),
        },
        observedAt: () => new Date().toISOString(),
      }),
    );
  } else {
    console.error("  · on-chain angle SKIPPED (SONAR_GRAPHQL_ENDPOINT unset)");
  }

  // discord roster — live if a bot token is present (unless --no-roster).
  if (process.env.DISCORD_BOT_TOKEN && !noRoster) {
    const memberSource = makeMemberSourceLive(getBotClient, {
      resolve: (w) =>
        w === slug ? { guild_id: world.guild_id, namespace_prefix: world.namespace_prefix } : undefined,
    });
    const readRoster = (w: WorldRef): Promise<ReadonlyArray<GuildMemberRef>> => memberSource(w.world_slug);
    producers.push(makeDiscordRosterProducer({ readRoster, observedAt: () => new Date().toISOString() }));
  } else {
    const why = noRoster ? "--no-roster (capped run)" : "DISCORD_BOT_TOKEN unset";
    console.error(`  · discord roster angle SKIPPED (${why})`);
  }

  // identity links — resolve Phase-A candidate wallets via the blessed
  // freeside_auth / midi_profiles resolver (fail-soft: no DB → 0 links).
  const link = makeWalletDiscordLinkLive();
  const resolveWallets = async (wallets: ReadonlyArray<string>): Promise<ResolvedWalletLink[]> =>
    Promise.all(
      wallets.map(async (w) => ({
        wallet: w,
        discord_id: await link.resolve(w).catch(() => null),
      })),
    );
  producers.push(
    makeIdentityLinkProducer({
      readLinks: makeIdentityLinkReaderLive({
        resolveWallets,
        getCandidates: () => ledger.ledgerStore.subjects(world.community_id),
      }),
      observedAt: () => new Date().toISOString(),
    }),
  );

  const summary = await new IngestionOrchestrator(ledger, producers).run(world);
  const projection = ledger.getMemberGraph(world.community_id);
  const counts = summarizeGraph(projection);

  console.error(
    `▸ ingested ${summary.ingested} (dup ${summary.duplicates}, quarantined ${summary.quarantined}) · degraded=${summary.degraded}`,
  );
  console.error(`  sources: ${JSON.stringify(summary.source_freshness)}\n`);

  // render to stdout (the operator-visible graph).
  console.log(renderToText(renderMemberGraphCV2(projection, summary)));
  console.error(
    `\n▸ ${counts.total} members · 🔗 ${counts.identity_user} · 💬 ${counts.discord_member} · ⛓️ ${counts.wallet_only} · ⚠️ ${counts.unresolved}`,
  );

  // optional: post the CV2 to a channel.
  if (postChannel) {
    const client = await getBotClient();
    if (!client) {
      console.error("  · --post requested but no DISCORD_BOT_TOKEN — skipped");
    } else {
      const ch = await client.channels.fetch(postChannel);
      if (ch && "send" in ch) {
        const payload = memberGraphCV2Payload(projection, summary);
        await (ch as { send: (p: unknown) => Promise<unknown> }).send({
          ...payload,
          allowed_mentions: { parse: [] }, // never ping (defensive — addresses aren't mentions)
        });
        console.error(`  · posted member graph to channel ${postChannel}`);
      } else {
        console.error(`  · channel ${postChannel} not sendable (not found / no perms)`);
      }
    }
  }

  const client = await getBotClient();
  if (client) await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("member-graph failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
