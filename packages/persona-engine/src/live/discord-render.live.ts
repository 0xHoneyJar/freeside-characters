import type { DigestSnapshot, DigestFactorSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestMessage, DeterministicEmbed } from '../domain/digest-message.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { ActivityPulse, ActivityPulseMessage } from '../domain/activity-pulse.ts';
import type {
  MicroMessage,
  LoreDropMessage,
  QuestionMessage,
  WeaverMessage,
  CalloutMessage,
} from '../domain/post-messages.ts';

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
  // 2026-05-16 · tighten + consistency pass per operator feedback.
  // Drop redundant "/ 30d" suffix (header already says "30d snapshot").
  // Tighten value column from pad8 → pad6 for less whitespace gap.
  // Keep right-alignment so cross-row digit comparison stays readable.
  // Label column is uniform 9-char left-padded ("events   ", "wallets  ", "w/w      ", "cold     ").
  const PAD = 6;
  const padLabel = (s: string) => s.padEnd(9, ' ');
  const rows: string[] = [];
  rows.push(`${padLabel('events')}${String(snapshot.totalEvents).padStart(PAD, ' ')}`);
  if (snapshot.activeWallets !== undefined) {
    rows.push(`${padLabel('wallets')}${String(snapshot.activeWallets).padStart(PAD, ' ')} active`);
  }
  rows.push(`${padLabel('w/w')}${formatDeltaPct(snapshot.deltaPct).padStart(PAD, ' ')}`);
  if (snapshot.coldFactorCount > 0) {
    rows.push(`${padLabel('cold')}${String(snapshot.coldFactorCount).padStart(PAD, ' ')} cold`);
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

/**
 * cycle-006 S7 T7.1 · per PRD FR-7: wallet+description pairs in 2-line format.
 * - Line 1: `<short-wallet> → <description>`
 * - Line 2: `<factor> · <dimension> · <timestamp>`
 * - Blank line between events.
 * - Default 10 events per post.
 * - Truncate if total content exceeds DISCORD_CONTENT_CAP.
 */
const DISCORD_CONTENT_CAP = 3700; // ~90% of Discord 4000-char message limit
const PULSE_DEFAULT_EVENT_COUNT = 10;

export function renderActivityPulse(pulse: ActivityPulse): ActivityPulseMessage {
  if (pulse.events.length === 0) {
    return { content: 'no recent events in the ledger.' };
  }
  const blocks: string[] = [];
  let totalLen = 0;
  let truncated = false;
  for (const event of pulse.events.slice(0, PULSE_DEFAULT_EVENT_COUNT)) {
    const walletLine = `${shortenWallet(event.wallet)} → ${escapeDiscordMarkdown(event.description ?? '(no description)')}`;
    const metaLine = `${escapeDiscordMarkdown(event.factor_display_name)} · ${event.dimension} · ${event.timestamp}`;
    const block = `${walletLine}\n${metaLine}`;
    if (totalLen + block.length + 2 > DISCORD_CONTENT_CAP) {
      truncated = true;
      break;
    }
    blocks.push(block);
    totalLen += block.length + 2; // +2 for the blank-line separator
  }
  const content = blocks.join('\n\n');
  return { content: truncated ? `${content}\n\n…` : content };
}

/**
 * Shorten an Ethereum wallet to `0xXXXX…YYYY` (first-4 hex + ellipsis +
 * last-4 hex) per PRD FR-7. Non-hex / shorter strings pass through.
 */
export function shortenWallet(wallet: string): string {
  if (!wallet) return wallet;
  // Match 0x-prefix + at least 8 hex chars (so first-4 + last-4 don't overlap)
  if (/^0x[0-9a-fA-F]{8,}$/.test(wallet)) {
    return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  }
  // Non-hex passthrough — also handle long opaque IDs (>12 chars) defensively
  return wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

// ─────────────────────────────────────────────────────────────────────────────
// cycle-006 S3 · per-post-type renderers (embed-less + embed variants)
// ─────────────────────────────────────────────────────────────────────────────

function voiceLine(augment?: VoiceAugment): string {
  if (!augment) return '';
  return [augment.header, augment.outro].filter(Boolean).join('\n');
}

function buildSubstrateFacts(snapshot: DigestSnapshot): ReadonlyArray<string> {
  const facts: string[] = [];
  facts.push(`${ZONE_LABEL[snapshot.zone]} · ${snapshot.totalEvents} events / ${snapshot.windowDays}d`);
  if (snapshot.activeWallets !== undefined) {
    facts.push(`${snapshot.activeWallets} active wallets`);
  }
  return facts;
}

export function renderMicro(snapshot: DigestSnapshot, augment?: VoiceAugment): MicroMessage {
  return {
    voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · checking in`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderLoreDrop(snapshot: DigestSnapshot, augment?: VoiceAugment): LoreDropMessage {
  return {
    voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · from the codex`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderQuestion(snapshot: DigestSnapshot, augment?: VoiceAugment): QuestionMessage {
  return {
    voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · ?`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderWeaver(
  snapshot: DigestSnapshot,
  crossZone: ReadonlyArray<DigestSnapshot>,
  augment?: VoiceAugment,
): WeaverMessage {
  const fields: DeterministicEmbed['fields'] = crossZone.slice(0, 4).map((z) => ({
    name: ZONE_LABEL[z.zone],
    value: `\`\`\`\nevents ${String(z.totalEvents).padStart(8, ' ')} / ${z.windowDays}d\nw/w    ${formatDeltaPct(z.deltaPct).padStart(8, ' ')}\n\`\`\``,
    inline: true,
  }));
  return {
    voiceContent: voiceLine(augment) || 'weaving threads…',
    truthEmbed: {
      color: ZONE_COLORS[snapshot.zone],
      fields,
      footer: { text: `weaver · generated at ${snapshot.generatedAt}` },
    },
  };
}

export function renderCallout(snapshot: DigestSnapshot, augment?: VoiceAugment): CalloutMessage {
  return {
    voiceContent: voiceLine(augment) || `🚨 ${ZONE_LABEL[snapshot.zone]} · callout`,
    truthEmbed: {
      color: 0xe74c3c,
      fields: [
        {
          name: 'snapshot',
          value: `\`\`\`\nevents ${snapshot.totalEvents} / ${snapshot.windowDays}d\nw/w    ${formatDeltaPct(snapshot.deltaPct)}\n\`\`\``,
          inline: false,
        },
      ],
      footer: { text: `callout · ${snapshot.generatedAt} · zone:${snapshot.zone}` },
    },
  };
}

export const presentation = {
  renderDigest,
  renderActivityPulse,
  renderMicro,
  renderLoreDrop,
  renderQuestion,
  renderWeaver,
  renderCallout,
};
