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

// cycle-007 S1/T1.3 · ZONE_LABEL deleted — replaced by safeResolveZoneRichLabel from domain/zone-registry.ts.
// Per Flatline SDD SKP-003 (Phase 4): callers use the safe variant which catches UnknownZoneError + emits
// zone.resolution_failed warning + returns raw zone string as fallback (does NOT crash digest pipeline).
import { safeResolveZoneRichLabel, safeResolveZoneDisplayName } from '../domain/zone-registry.ts';
// cycle-007 S3/T3.3 · D3 + D5: medium-aware render constants via metricsForMedium.
// digitWidthSpaceChar (U+2007 FIGURE SPACE for Discord) defends against Android `gg sans`
// proportional-fallback regression that breaks ASCII-space monospace assumption.
import { metricsForMedium, DISCORD_WEBHOOK_DESCRIPTOR } from '../deliver/medium-extensions.ts';

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
  // cycle-007 S3/T3.3 · D5 figure-space padding (Bug B closure at CLASS level).
  // Pad character sourced from medium descriptor · Discord uses U+2007 FIGURE SPACE
  // (digit-width invariant across OpenType tabular figures even when Android `gg sans`
  // proportional fallback fires · per discord.js#3030 + community-reported regression).
  //
  // S0/T0.2 typography spike (mechanical proxy 2026-05-17) attested U+2007 as default.
  // S3 acceptance: operator screenshot from Discord Android shows aligned numeric column
  // (PP-2 SOFT gate · falls back to byte-snapshot test if operator unavailable per IMP-002
  // degraded path).
  const metrics = metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR);
  const PAD_CHAR = metrics.digitWidthSpaceChar;
  const PAD = 6;
  const padLabel = (s: string) => s.padEnd(9, PAD_CHAR);
  const rows: string[] = [];
  rows.push(`${padLabel('events')}${String(snapshot.totalEvents).padStart(PAD, PAD_CHAR)}`);
  if (snapshot.activeWallets !== undefined) {
    rows.push(`${padLabel('wallets')}${String(snapshot.activeWallets).padStart(PAD, PAD_CHAR)} active`);
  }
  rows.push(`${padLabel('change')}${formatDeltaPct(snapshot.deltaPct).padStart(PAD, PAD_CHAR)}`);
  if (snapshot.coldFactorCount > 0) {
    rows.push(`${padLabel('cold')}${String(snapshot.coldFactorCount).padStart(PAD, PAD_CHAR)} cold`);
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
    voiceContent: voice ? `${safeResolveZoneRichLabel(snapshot.zone, 'discord-render')}\n${voice}` : safeResolveZoneRichLabel(snapshot.zone, 'discord-render'),
    truthEmbed: {
      color: ZONE_COLORS[snapshot.zone],
      fields,
      footer: { text: `digest · generated at ${snapshot.generatedAt} · zone:${safeResolveZoneDisplayName(snapshot.zone, 'discord-render-footer')}` },
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

/**
 * cycle-008 T3.8/T3.9 · the data BILLBOARD rows (beat 2 of the two-beat post).
 *
 * Cadence-honesty (FR-38): the window total is labeled `<N>d rolling` so it can
 * never be mistaken for "since you last looked" on a sub-window cadence. The true
 * "since last post" delta (voice-memory-sourced) is DEFERRED until the
 * VoiceMemoryPort is wired into the render path — `digest-orchestrator.ts:70`
 * stubs it today (`void (deps.voiceMemory ?? ...)`), and the standalone
 * `compose/voice-memory.ts` writer is orphaned (zero callers). This is T3.8's
 * AC(e) graceful-degradation path: a clearly-labeled rolling figure, never a
 * wrong fresh number. The fresh delta lights up when voice-memory is wired
 * (rides with the deferred cron-migration · T3.3).
 *
 * Returns the billboard as discrete lines: `[header, ...aligned label/value rows]`.
 * Column alignment uses U+2007 FIGURE SPACE (digit-width invariant — the same
 * technique as `renderSnapshotField` above). The caller (`plainToPayload`) bolds
 * each line; data state ("all quiet") stays in the voice beat, not the billboard.
 */
function buildSubstrateFacts(snapshot: DigestSnapshot): ReadonlyArray<string> {
  const header = safeResolveZoneRichLabel(snapshot.zone, 'discord-render');
  const PAD_CHAR = metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR).digitWidthSpaceChar;
  const rows: Array<readonly [string, string]> = [
    [`${snapshot.windowDays}d rolling`, String(snapshot.totalEvents)],
  ];
  if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
    rows.push(['change', formatDeltaPct(snapshot.deltaPct)]);
  }
  if (snapshot.activeWallets !== undefined) {
    rows.push(['wallets warm', String(snapshot.activeWallets)]);
  }
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const lines = rows.map(
    ([label, value]) => `${label.padEnd(labelWidth + 2, PAD_CHAR)}${value}`,
  );
  return [header, ...lines];
}

export function renderMicro(snapshot: DigestSnapshot, augment?: VoiceAugment): MicroMessage {
  return {
    voiceContent: voiceLine(augment) || `${safeResolveZoneRichLabel(snapshot.zone, 'discord-render')} · checking in`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderLoreDrop(snapshot: DigestSnapshot, augment?: VoiceAugment): LoreDropMessage {
  return {
    voiceContent: voiceLine(augment) || `${safeResolveZoneRichLabel(snapshot.zone, 'discord-render')} · from the codex`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderQuestion(snapshot: DigestSnapshot, augment?: VoiceAugment): QuestionMessage {
  return {
    voiceContent: voiceLine(augment) || `${safeResolveZoneRichLabel(snapshot.zone, 'discord-render')} · ?`,
    truthFields: buildSubstrateFacts(snapshot),
  };
}

export function renderWeaver(
  snapshot: DigestSnapshot,
  crossZone: ReadonlyArray<DigestSnapshot>,
  augment?: VoiceAugment,
): WeaverMessage {
  const fields: DeterministicEmbed['fields'] = crossZone.slice(0, 4).map((z) => ({
    name: safeResolveZoneRichLabel(z.zone, 'discord-render'),
    value: `\`\`\`\nevents ${String(z.totalEvents).padStart(8, ' ')} / ${z.windowDays}d\nchange   ${formatDeltaPct(z.deltaPct).padStart(8, ' ')}\n\`\`\``,
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
    voiceContent: voiceLine(augment) || `🚨 ${safeResolveZoneRichLabel(snapshot.zone, 'discord-render')} · callout`,
    truthEmbed: {
      color: 0xe74c3c,
      fields: [
        {
          name: 'snapshot',
          value: `\`\`\`\nevents ${snapshot.totalEvents} / ${snapshot.windowDays}d\nchange   ${formatDeltaPct(snapshot.deltaPct)}\n\`\`\``,
          inline: false,
        },
      ],
      footer: { text: `callout · ${snapshot.generatedAt} · zone:${safeResolveZoneDisplayName(snapshot.zone, 'discord-render-footer')}` },
    },
  };
}

// cycle-007 S7 · G-6 leak closure: presentation const exposes payload-conversion methods.
// Orchestrators consume these via PresentationPort instead of importing to*Payload directly
// from live/discord-webhook.live.ts (which violates the substrate-presentation seam).
import {
  toDigestPayload,
  toMicroPayload,
  toLoreDropPayload,
  toQuestionPayload,
  toWeaverPayload,
  toCalloutPayload,
} from './discord-webhook.live.ts';

export const presentation = {
  renderDigest,
  renderActivityPulse,
  renderMicro,
  renderLoreDrop,
  renderQuestion,
  renderWeaver,
  renderCallout,
  // cycle-007 S7 · payload-conversion exposed via port (G-6 leak closure)
  toDigestPayload,
  toMicroPayload,
  toLoreDropPayload,
  toQuestionPayload,
  toWeaverPayload,
  toCalloutPayload,
};
