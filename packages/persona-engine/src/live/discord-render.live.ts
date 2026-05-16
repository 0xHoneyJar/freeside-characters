import type { DigestSnapshot, DigestFactorSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestMessage, DeterministicEmbed } from '../domain/digest-message.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { ActivityPulse, ActivityPulseMessage } from '../domain/activity-pulse.ts';

const ZONE_COLORS = {
  stonehenge: 0x808890,
  'bear-cave': 0x9b6a3f,
  'el-dorado': 0xc9a44c,
  'owsley-lab': 0x6f4ea1,
} as const;

const ZONE_LABEL = {
  stonehenge: '🗿 Stonehenge',
  'bear-cave': '🐻 Bear Cave (OG)',
  'el-dorado': '⛏️ El Dorado (NFT)',
  'owsley-lab': '🧪 Owsley Lab (Onchain)',
} as const;

const EMBED_FIELD_CHAR_CAP = 1024;
const DEFAULT_MAX_FACTORS = 19;
const OVERFLOW_TOKEN = '…and N more silent';

function escapeDiscordMarkdown(text: string): string {
  return text.replace(/([_`*~|>])/g, '\\$1');
}

function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return '·';
  if (Math.abs(deltaPct) < 1) return 'steady';
  const rounded = Math.round(deltaPct);
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

function renderSnapshotField(snapshot: DigestSnapshot): DeterministicEmbed['fields'][number] {
  const rows: string[] = [];
  rows.push(`events    ${String(snapshot.totalEvents).padStart(8, ' ')} / ${snapshot.windowDays}d`);
  if (snapshot.activeWallets !== undefined) {
    rows.push(`wallets   ${String(snapshot.activeWallets).padStart(8, ' ')} active`);
  }
  rows.push(`w/w       ${formatDeltaPct(snapshot.deltaPct).padStart(8, ' ')}`);
  if (snapshot.coldFactorCount > 0) {
    rows.push(`cold      ${String(snapshot.coldFactorCount).padStart(8, ' ')} factors`);
  }
  return {
    name: `${snapshot.windowDays}d snapshot`,
    value: `\`\`\`\n${rows.join('\n')}\n\`\`\``,
    inline: false,
  };
}

function renderTopHeader(): string {
  return [
    'factor'.padEnd(18, ' '),
    'events'.padStart(6, ' '),
    'wallets'.padStart(8, ' '),
    'delta'.padStart(7, ' '),
    'rank'.padStart(4, ' '),
  ].join(' ');
}

function renderTopRow(factor: DigestFactorSnapshot): string {
  const safeName = escapeDiscordMarkdown(factor.displayName);
  const nameCol = safeName.length > 18 ? `${safeName.slice(0, 17)}…` : safeName;
  const wallets = factor.factorStats?.cohort?.unique_actors;
  const rank = factor.factorStats?.magnitude?.current_percentile_rank;
  return [
    nameCol.padEnd(18, ' '),
    String(factor.total).padStart(6, ' '),
    (wallets === undefined || wallets === null ? '?' : String(wallets)).padStart(8, ' '),
    formatDeltaPct(factor.deltaPct).padStart(7, ' '),
    (rank === undefined || rank === null ? '·' : String(rank)).padStart(4, ' '),
  ].join(' ');
}

function packRows(rows: ReadonlyArray<string>, totalAvailable: number): string {
  let acc = '';
  let packed = 0;
  for (const row of rows) {
    const sep = acc ? '\n' : '';
    const remaining = totalAvailable - packed - 1;
    const overflowSlot = remaining > 0 ? `\n${OVERFLOW_TOKEN.replace('N', String(remaining))}` : '';
    if (acc.length + sep.length + row.length + overflowSlot.length > EMBED_FIELD_CHAR_CAP) {
      const skipped = totalAvailable - packed;
      return `${acc}${acc ? '\n' : ''}${OVERFLOW_TOKEN.replace('N', String(skipped))}`;
    }
    acc += sep + row;
    packed += 1;
  }
  const skipped = totalAvailable - packed;
  if (skipped > 0) {
    return `${acc}${acc ? '\n' : ''}${OVERFLOW_TOKEN.replace('N', String(skipped))}`;
  }
  return acc;
}

function renderTopField(snapshot: DigestSnapshot): DeterministicEmbed['fields'][number] | null {
  const rows = snapshot.topFactors
    .slice(0, DEFAULT_MAX_FACTORS)
    .map((factor) => renderTopRow(factor));
  const packed = packRows(rows, snapshot.topFactors.length);
  if (!packed) return null;
  return {
    name: `top this ${snapshot.windowDays}d`,
    value: `\`\`\`\n${renderTopHeader()}\n${packed}\n\`\`\``,
    inline: false,
  };
}

function renderColdField(snapshot: DigestSnapshot): DeterministicEmbed['fields'][number] | null {
  const tags = snapshot.coldFactors
    .slice(0, 30)
    .map((factor) => escapeDiscordMarkdown(factor.displayName))
    .join(' · ');
  if (!tags) return null;
  return { name: 'cold', value: tags, inline: false };
}

export function renderDigest(snapshot: DigestSnapshot, augment?: VoiceAugment): DigestMessage {
  const fields = [
    renderSnapshotField(snapshot),
    renderTopField(snapshot),
    renderColdField(snapshot),
  ].filter((field): field is DeterministicEmbed['fields'][number] => field !== null);

  const voice = [augment?.header, augment?.outro]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join('\n');

  return {
    voiceContent: voice ? `${ZONE_LABEL[snapshot.zone]}\n${voice}` : ZONE_LABEL[snapshot.zone],
    truthEmbed: {
      color: ZONE_COLORS[snapshot.zone],
      fields,
      footer: { text: `digest · generated at ${snapshot.generatedAt} · zone:${snapshot.zone}` },
    },
  };
}

export function renderActivityPulse(pulse: ActivityPulse): ActivityPulseMessage {
  const lines = pulse.events.slice(0, 10).flatMap((event) => [
    `${shortWallet(event.wallet)} → ${escapeDiscordMarkdown(event.description)}`,
    `${escapeDiscordMarkdown(event.factor_display_name)} · ${event.dimension} · ${event.timestamp}`,
  ]);
  return {
    content: lines.length > 0 ? lines.join('\n') : 'no recent events in the ledger.',
  };
}

function shortWallet(wallet: string): string {
  return wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

export const presentation = {
  renderDigest,
  renderActivityPulse,
};
