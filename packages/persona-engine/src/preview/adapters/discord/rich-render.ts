// cycle-008 S9 (g30) · Discord rich-surface renderers (embed · components-v2).
//
// DIG-grounded (dig-session-2026-05-23 · "Discord visual primitives"): the text tier
// (bold/code/ansi) is fragile (~35-char mobile wrap destroys it). The strong surfaces:
//   - Rich Embed: color sidebar (#57F287 up / #ED4245 down) + H1 hero metric (`# N`) +
//     footer metadata → a "dark cockpit billboard" parseable in a micro-glance. Mobile
//     collapses inline fields to one column, so lean on color + hero, not tables.
//   - Components V2: Container → TextDisplay header → Section rows (the 2025 layout engine).
// These are Discord-specific, so they live in the adapter (not core).

import type { DigestSnapshot } from '../../../domain/digest-snapshot.ts';
import type { DiscordEmbed } from '../../../deliver/embed.ts';
import { safeResolveZoneRichLabel, ZONE_REGISTRY } from '../../../domain/zone-registry.ts';
import { stripEmDashes } from '../../core/billboard-surface.ts';

const COLOR_UP = 0x57f287; // discord green
const COLOR_DOWN = 0xed4245; // discord red
const COLOR_FLAT: Record<string, number> = {
  stonehenge: 0x808890,
  'bear-cave': 0x9b6a3f,
  'el-dorado': 0xc9a44c,
  'owsley-lab': 0x6f4ea1,
};

function colorFor(s: DigestSnapshot): number {
  if (s.deltaPct !== null && Math.abs(s.deltaPct) >= 1) return s.deltaPct > 0 ? COLOR_UP : COLOR_DOWN;
  return COLOR_FLAT[s.zone] ?? 0x6f4ea1;
}

// Operator round-3 ("normal casing for onchain pls"): dimension shown in natural casing.
const DIM_DISPLAY: Record<string, string> = { onchain: 'Onchain', nft: 'NFT', og: 'OG', overall: 'Overall' };
export const dimDisplay = (d: string): string => DIM_DISPLAY[d] ?? d.charAt(0).toUpperCase() + d.slice(1);

/**
 * Build the data billboard as a Rich Embed — the dig's recommended "stateful billboard".
 * Hero metric as H1 in the description (parseable at a glance), supporting metrics as
 * inline fields, freshness in the footer, status as the sidebar color.
 */
export function buildBillboardEmbed(snapshot: DigestSnapshot): DiscordEmbed {
  const fields: NonNullable<DiscordEmbed['fields']> = [];
  if (snapshot.activeWallets !== undefined) {
    fields.push({ name: 'wallets', value: `**${snapshot.activeWallets}**`, inline: true });
  }
  if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
    const dir = snapshot.deltaPct > 0 ? '↑' : '↓';
    fields.push({ name: 'trend', value: `**${dir}${Math.abs(Math.round(snapshot.deltaPct))}%**`, inline: true });
  }
  return {
    color: colorFor(snapshot),
    title: safeResolveZoneRichLabel(snapshot.zone, 'rlhf-embed'),
    // H1 hero number + a quiet supporting line (no jargon — the "community-legible" ask)
    description: `# ${snapshot.totalEvents}\nonchain events · last ${snapshot.windowDays} days`,
    fields,
    footer: { text: `${snapshot.zone} · ${snapshot.windowDays}d rolling` },
  };
}

// ── Components V2 ────────────────────────────────────────────────────────────
// Minimal Container → TextDisplay layout. Component type ids per the Discord API:
//   10 = Text Display · 17 = Container · 14 = Separator
const COMPONENT_TEXT_DISPLAY = 10;
const COMPONENT_CONTAINER = 17;
const COMPONENT_SEPARATOR = 14;

/** Build the data billboard as a Components V2 container (requires the IS_COMPONENTS_V2 flag).
 *  Operator round-2 (rlhf-20260523-bc0590 · "damn near perfect, if only onchain/the dimension
 *  is a subtext"): zone name is the header; the dimension is demoted to `-#` grey subtext. */
export function buildBillboardComponentsV2(snapshot: DigestSnapshot): unknown[] {
  const reg = ZONE_REGISTRY[snapshot.zone];
  // header block: zone name (no dimension paren) + dimension as `-#` subtext + the hero number
  const head: string[] = [
    `## ${reg.emoji} ${reg.displayName}`,
    `-# ${dimDisplay(snapshot.dimension)}`,
    `# ${snapshot.totalEvents}`,
    `events · last ${snapshot.windowDays} days`,
  ];
  const body: string[] = [];
  if (snapshot.activeWallets !== undefined) body.push(`**${snapshot.activeWallets}** wallets active`);
  if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
    const dir = snapshot.deltaPct > 0 ? '↑' : '↓';
    body.push(`trend **${dir}${Math.abs(Math.round(snapshot.deltaPct))}%** vs prior ${snapshot.windowDays}d`);
  }
  return [
    {
      type: COMPONENT_CONTAINER,
      accent_color: colorFor(snapshot),
      components: [
        { type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(head.join('\n')) },
        { type: COMPONENT_SEPARATOR },
        { type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(body.join('\n')) || '·' },
      ],
    },
  ];
}

// The production enriched renderer (real ZoneDigest → Components V2) now lives in
// deliver/enriched-render.ts (prod core) so the dependency points inward (preview → prod,
// never prod → preview). Re-exported here for the RLHF tool's consumers (present.ts, the
// gallery, index.ts) which judge the prod renderer at Discord fidelity.
export { buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2 } from '../../../deliver/enriched-render.ts';
export type { EnrichedDigestOpts } from '../../../deliver/enriched-render.ts';
