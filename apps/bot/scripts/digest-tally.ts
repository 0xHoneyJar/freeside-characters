#!/usr/bin/env bun
/**
 * digest-tally.ts — operator-side reaction tally for "what sticks".
 *
 * Fetches recent messages from each zone channel + reads the reaction
 * counts on each. Aggregates per-zone + globally. Surfaces which
 * digest posts resonated.
 *
 * Not a live cron — operator runs this manually (or via a future
 * `/digest-tally` slash command) when they want the signal.
 *
 * Output:
 *   - stdout markdown table (per-zone breakdown)
 *   - .run/reactions/tally-<ts>.json (machine-readable archive)
 *
 * Run: bun run apps/bot/scripts/digest-tally.ts [--days N]
 *
 * Refs:
 *   grimoires/loa/context/track-2026-05-14-signaling-primitive-reaction-bar.md
 *   packages/persona-engine/src/deliver/reaction-bar.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig, getZoneChannelId } from '@freeside-characters/persona-engine/config';
import {
  REACTION_BAR_EMOJI,
} from '@freeside-characters/persona-engine/deliver/reaction-bar';

const ZONES: Array<'stonehenge' | 'bear-cave' | 'el-dorado' | 'owsley-lab'> = [
  'stonehenge',
  'bear-cave',
  'el-dorado',
  'owsley-lab',
];

interface DigestTally {
  messageId: string;
  channelId: string;
  zone: string;
  timestamp: string;
  reactions: Record<string, number>;
  /** Total reactions across the bar (sum of REACTION_BAR_EMOJI counts). */
  total: number;
  /** Subtracts the bot's own seed reaction (1 per emoji) so community count is visible. */
  communityTotal: number;
}

function parseArgs(): { days: number; channel?: string } {
  const args = process.argv.slice(2);
  let days = 28; // 4 weeks default
  let channel: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--channel' && args[i + 1]) {
      channel = args[i + 1];
      i++;
    }
  }
  return { days, channel };
}

async function tallyChannel(
  client: Client,
  channelId: string,
  zone: string,
  sinceTimestamp: number,
): Promise<DigestTally[]> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !('messages' in channel)) {
    console.error(`[tally] channel ${channelId} (${zone}) not accessible`);
    return [];
  }
  // @ts-expect-error — channel.messages exists on text channels
  const messages = await channel.messages.fetch({ limit: 100 });
  const tallies: DigestTally[] = [];
  for (const [, msg] of messages) {
    // Only count messages within the time window
    if (msg.createdTimestamp < sinceTimestamp) continue;
    // Only count messages with at least one REACTION_BAR_EMOJI reaction
    // (filters out non-digest channel chatter).
    const hasBarReaction = REACTION_BAR_EMOJI.some((e) =>
      msg.reactions.cache.find((r) => r.emoji.name === e),
    );
    if (!hasBarReaction) continue;
    const reactions: Record<string, number> = {};
    let total = 0;
    let communityTotal = 0;
    for (const emoji of REACTION_BAR_EMOJI) {
      const reaction = msg.reactions.cache.find((r) => r.emoji.name === emoji);
      const count = reaction?.count ?? 0;
      reactions[emoji] = count;
      total += count;
      // Bot auto-reacts once per emoji, so community count = total - 1
      // (when reaction count > 0; else 0).
      if (count > 0) communityTotal += count - 1;
    }
    tallies.push({
      messageId: msg.id,
      channelId,
      zone,
      timestamp: new Date(msg.createdTimestamp).toISOString(),
      reactions,
      total,
      communityTotal,
    });
  }
  return tallies;
}

function renderTable(tallies: DigestTally[]): string {
  const lines: string[] = [];
  const headerEmoji = REACTION_BAR_EMOJI.join(' | ');
  lines.push(`| zone | timestamp | ${headerEmoji} | community total |`);
  lines.push(`|------|-----------|${REACTION_BAR_EMOJI.map(() => '----').join('|')}|----|`);
  for (const t of tallies) {
    const counts = REACTION_BAR_EMOJI.map((e) => String(t.reactions[e] ?? 0)).join(' | ');
    lines.push(
      `| ${t.zone} | ${t.timestamp.slice(0, 10)} | ${counts} | ${t.communityTotal} |`,
    );
  }
  return lines.join('\n');
}

function renderZoneAggregate(tallies: DigestTally[]): string {
  const byZone: Record<string, { total: Record<string, number>; communityTotal: number; count: number }> = {};
  for (const t of tallies) {
    if (!byZone[t.zone]) {
      byZone[t.zone] = {
        total: Object.fromEntries(REACTION_BAR_EMOJI.map((e) => [e, 0])),
        communityTotal: 0,
        count: 0,
      };
    }
    byZone[t.zone]!.count += 1;
    byZone[t.zone]!.communityTotal += t.communityTotal;
    for (const emoji of REACTION_BAR_EMOJI) {
      byZone[t.zone]!.total[emoji] = (byZone[t.zone]!.total[emoji] ?? 0) + (t.reactions[emoji] ?? 0);
    }
  }
  const lines: string[] = [];
  lines.push('## Per-zone aggregate (rolling window)');
  lines.push('');
  lines.push(`| zone | digests | ${REACTION_BAR_EMOJI.join(' | ')} | community total |`);
  lines.push(`|------|---------|${REACTION_BAR_EMOJI.map(() => '----').join('|')}|----|`);
  for (const [zone, agg] of Object.entries(byZone)) {
    const counts = REACTION_BAR_EMOJI.map((e) => String(agg.total[e] ?? 0)).join(' | ');
    lines.push(`| ${zone} | ${agg.count} | ${counts} | ${agg.communityTotal} |`);
  }
  return lines.join('\n');
}

/**
 * Renders KEEPER-flagged sample-size warning when total digest count
 * is below the noise-floor threshold for inference. Threshold of 8
 * digests (~2 weeks of normal cadence) is the operator-judgment line
 * where pattern emergence is meaningful vs single-member skew.
 */
function renderSampleSizeWarning(tallies: DigestTally[]): string | null {
  const NOISE_FLOOR = 8;
  if (tallies.length >= NOISE_FLOOR) return null;
  return [
    '## ⚠ Sample-size warning (KEEPER 2026-05-14 review)',
    '',
    `Only ${tallies.length} digest${tallies.length === 1 ? '' : 's'} with reaction-bar in window.`,
    `Threshold for meaningful pattern emergence: ≥${NOISE_FLOOR} digests + ≥3 active reactors.`,
    'At this scale, a single heavily-engaged member skews the tally. ',
    'Read as **anecdote, not pattern**. Extend window with --days N or wait for more posts.',
  ].join('\n');
}

/**
 * Compares the current-window tally against the prior-window of equal
 * length. Per KEEPER 2026-05-14 review: without baseline + delta, every
 * tally read is a snapshot rather than a trend. Structural memory of
 * "where we were last window" is the load-bearing signal for operator
 * doctrine-drift detection.
 */
async function fetchPriorWindowTallies(
  client: Client,
  filterChannel: string | undefined,
  days: number,
): Promise<DigestTally[]> {
  const config = loadConfig();
  const priorStart = Date.now() - 2 * days * 24 * 60 * 60 * 1000;
  const priorEnd = Date.now() - days * 24 * 60 * 60 * 1000;
  const allPrior: DigestTally[] = [];
  for (const zone of ZONES) {
    const channelId = getZoneChannelId(config, zone);
    if (!channelId) continue;
    if (filterChannel && filterChannel !== channelId) continue;
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !('messages' in channel)) continue;
    // @ts-expect-error — channel.messages on text channels
    const messages = await channel.messages.fetch({ limit: 100 });
    for (const [, msg] of messages) {
      if (msg.createdTimestamp < priorStart || msg.createdTimestamp >= priorEnd) continue;
      const hasBarReaction = REACTION_BAR_EMOJI.some((e) =>
        msg.reactions.cache.find((r) => r.emoji.name === e),
      );
      if (!hasBarReaction) continue;
      const reactions: Record<string, number> = {};
      let total = 0;
      let communityTotal = 0;
      for (const emoji of REACTION_BAR_EMOJI) {
        const reaction = msg.reactions.cache.find((r) => r.emoji.name === emoji);
        const count = reaction?.count ?? 0;
        reactions[emoji] = count;
        total += count;
        if (count > 0) communityTotal += count - 1;
      }
      allPrior.push({
        messageId: msg.id,
        channelId,
        zone,
        timestamp: new Date(msg.createdTimestamp).toISOString(),
        reactions,
        total,
        communityTotal,
      });
    }
  }
  return allPrior;
}

function renderDelta(
  current: DigestTally[],
  prior: DigestTally[],
  days: number,
): string {
  // Compute aggregate per-emoji counts for each window.
  const aggregate = (tallies: DigestTally[]) => {
    const agg: Record<string, number> = Object.fromEntries(
      REACTION_BAR_EMOJI.map((e) => [e, 0]),
    );
    let communityTotal = 0;
    for (const t of tallies) {
      for (const emoji of REACTION_BAR_EMOJI) {
        agg[emoji] = (agg[emoji] ?? 0) + (t.reactions[emoji] ?? 0);
      }
      communityTotal += t.communityTotal;
    }
    return { perEmoji: agg, communityTotal, digestCount: tallies.length };
  };
  const curr = aggregate(current);
  const prev = aggregate(prior);

  const lines: string[] = [];
  lines.push('## Delta vs prior window (KEEPER 2026-05-14 structural-memory fix)');
  lines.push('');
  lines.push(`Comparing current ${days}-day window against prior ${days}-day window.`);
  lines.push('');
  lines.push(`| metric | current | prior | Δ count | Δ % |`);
  lines.push(`|--------|---------|-------|---------|-----|`);

  const fmtDelta = (curr: number, prev: number): string => {
    if (prev === 0) return curr > 0 ? '(new)' : '(0→0)';
    const pct = ((curr - prev) / prev) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  };

  for (const emoji of REACTION_BAR_EMOJI) {
    const c = curr.perEmoji[emoji] ?? 0;
    const p = prev.perEmoji[emoji] ?? 0;
    lines.push(`| ${emoji} | ${c} | ${p} | ${c - p > 0 ? '+' : ''}${c - p} | ${fmtDelta(c, p)} |`);
  }
  lines.push(
    `| digest count | ${curr.digestCount} | ${prev.digestCount} | ${curr.digestCount - prev.digestCount > 0 ? '+' : ''}${curr.digestCount - prev.digestCount} | ${fmtDelta(curr.digestCount, prev.digestCount)} |`,
  );
  lines.push(
    `| community total | ${curr.communityTotal} | ${prev.communityTotal} | ${curr.communityTotal - prev.communityTotal > 0 ? '+' : ''}${curr.communityTotal - prev.communityTotal} | ${fmtDelta(curr.communityTotal, prev.communityTotal)} |`,
  );
  return lines.join('\n');
}

async function main() {
  const { days, channel: filterChannel } = parseArgs();
  const config = loadConfig();

  if (!config.DISCORD_BOT_TOKEN) {
    console.error('digest-tally: DISCORD_BOT_TOKEN required');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', (err) => reject(err));
    client.login(config.DISCORD_BOT_TOKEN);
  });

  const sinceTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
  const allTallies: DigestTally[] = [];

  for (const zone of ZONES) {
    const channelId = getZoneChannelId(config, zone);
    if (!channelId) {
      console.error(`[tally] zone ${zone} not channel-mapped, skipping`);
      continue;
    }
    if (filterChannel && filterChannel !== channelId) continue;
    const tallies = await tallyChannel(client, channelId, zone, sinceTimestamp);
    allTallies.push(...tallies);
  }

  await client.destroy();

  if (allTallies.length === 0) {
    console.log(`\nNo digests with reaction-bar found in the last ${days} days.`);
    console.log('(Reactions are auto-attached only when DIGEST_REACTION_BAR_ENABLED=true.)');
    await client.destroy();
    return;
  }

  // Sort by timestamp desc
  allTallies.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Fetch prior-window tallies for delta comparison.
  // Re-login because main login already destroyed.
  const deltaClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  await new Promise<void>((resolve, reject) => {
    deltaClient.once('ready', () => resolve());
    deltaClient.once('error', (err) => reject(err));
    deltaClient.login(config.DISCORD_BOT_TOKEN);
  });
  const priorTallies = await fetchPriorWindowTallies(deltaClient, filterChannel, days);
  await deltaClient.destroy();

  const output: string[] = [];
  output.push(`# Reaction-bar tally (last ${days} days · ${allTallies.length} digests)`);
  output.push('');
  // KEEPER sample-size warning comes FIRST so operator reads noise-floor caveats before patterns.
  const warning = renderSampleSizeWarning(allTallies);
  if (warning) {
    output.push(warning);
    output.push('');
  }
  output.push('## Per-digest detail');
  output.push('');
  output.push(renderTable(allTallies));
  output.push('');
  output.push(renderZoneAggregate(allTallies));
  output.push('');
  output.push(renderDelta(allTallies, priorTallies, days));
  output.push('');
  output.push('## Reaction key');
  output.push('- 👀 useful · "noticed" · landed');
  output.push('- 🤔 unclear · signal real but framing missed');
  output.push('- 🪲 bug · raw data wrong (verification-class signal · pairs with score-mibera#115)');
  output.push('');
  output.push('Bot auto-reacts with 1 of each on digest post. Community totals subtract those bot reactions.');
  output.push('');
  output.push('## On reading the tally (operator doctrine)');
  output.push('');
  output.push('Per OSTROM 2026-05-14 review: this tally informs **doctrine**, not ranking. High-👀 posts do NOT auto-promote.');
  output.push('Community members should know reactions affect future post framing, not immediate visibility. If they don\'t,');
  output.push('they\'ll game reactions like Reddit upvotes. **Surface this framing to the channel in a pinned message.**');
  output.push('');
  output.push('Posts with 0 reactions across all 3 categories ARE the "didn\'t carry" signal — silence is data (KEEPER).');

  const report = output.join('\n');
  console.log('\n' + report + '\n');

  // Archive machine-readable
  mkdirSync('.run/reactions', { recursive: true });
  const archivePath = `.run/reactions/tally-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(
    archivePath,
    JSON.stringify({
      days,
      generatedAt: new Date().toISOString(),
      tallies: allTallies,
    }, null, 2),
  );
  console.log(`Archived to: ${archivePath}\n`);
}

main().catch((err) => {
  console.error('digest-tally error:', err);
  process.exit(1);
});
