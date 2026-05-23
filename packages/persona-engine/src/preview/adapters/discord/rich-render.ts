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

/** Discord message flag enabling Components V2 (1 << 15). */
export const IS_COMPONENTS_V2 = 1 << 15;

// ── production renderer: real ZoneDigest → enriched Components V2 ───────────────
// The bridge from the RLHF tool (representative data) to production (real score-mcp data).
// Maps a live ZoneDigest's raw_stats → the 5/5 enriched layout. PURE — wired into delivery +
// gated behind a flag in the rollout sprint (see the open-loops issue); zero prod files touched
// here. KNOWN GAPS (issue): factor_id→display-name needs the score factor catalog (prettified
// here); spotlight pfp needs an async freeside_auth.pfp_url resolve (injectable below).

import type { ZoneDigest } from '../../../score/types.ts';
import { getWindowEventCount, getWindowWalletCount } from '../../../score/types.ts';
import { shortenWallet } from '../../../live/discord-render.live.ts';

/** factor_id "onchain:lp_provide" → "Lp Provide" (placeholder until the score catalog is wired). */
function prettyFactor(factorId: string): string {
  const tail = factorId.includes(':') ? factorId.split(':').slice(1).join(':') : factorId;
  return tail.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive the displayed window length (days) from the digest's own window bounds.
 *  GPT-review (code-findings-1): never hardcode the window — a 30d digest must not read "7 days". */
function windowDaysOf(zd: ZoneDigest): number {
  const start = Date.parse(zd.window_start);
  const end = Date.parse(zd.window_end);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.max(1, Math.round((end - start) / 86_400_000));
  }
  return 7; // validated fallback only when bounds are missing/malformed
}

export interface EnrichedDigestOpts {
  /** Resolve a wallet → display handle (freeside_auth). Default: shortened 0x…. */
  readonly resolveHandle?: (wallet: string) => string;
  /** Resolve a wallet → pfp/NFT image url (freeside_auth.pfp_url). When present, a Thumbnail. */
  readonly resolvePfp?: (wallet: string) => string | null;
  /**
   * Resolve a factor_id → display name. CANONICAL SOURCE IS THE MCP — score-mcp provides
   * `display_name` on PulseDimensionFactor (score/types.ts:397 · mapped at score-mcp.live.ts:144);
   * `raw_stats.factor_trends` carries only factor_id, so the caller injects the name dictionary
   * from the edge (hexagonal: name-authority lives at the MCP/API boundary, not in this renderer).
   * The prettify fallback is last-resort only, for factor_ids absent from the catalog.
   */
  readonly resolveFactorName?: (factorId: string) => string;
}

export function buildEnrichedDigestComponentsV2(zd: ZoneDigest, opts: EnrichedDigestOpts = {}): unknown[] {
  const r = ZONE_REGISTRY[zd.zone];
  const events = getWindowEventCount(zd.raw_stats);
  const wallets = getWindowWalletCount(zd.raw_stats);
  const handle = opts.resolveHandle ?? shortenWallet;
  // factor display name: MCP-provided (the shared dictionary at the edge) · prettify is fallback
  const factorName = opts.resolveFactorName ?? prettyFactor;

  // movers = factor_trends by multiplier (the factor-style movers the operator liked)
  const movers = [...zd.raw_stats.factor_trends]
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 3)
    .map((f) => `${f.multiplier >= 1 ? '↑' : '↓'} **${factorName(f.factor_id)}**`)
    .join('   ·   ');

  const days = windowDaysOf(zd);
  const blocks: unknown[] = [
    { type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`## ${r.emoji} ${r.displayName}\n-# ${dimDisplay(r.dimension)}`) },
    { type: COMPONENT_TEXT_DISPLAY, content: `# ${events}\nevents · last ${days} days` },
  ];
  if (movers) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`### movers\n${movers}`) });
  }
  if (zd.raw_stats.spotlight) {
    const sp = zd.raw_stats.spotlight;
    const who = handle(sp.wallet);
    const reason = sp.reason === 'new_badge' ? 'earned a new badge' : 'climbed the ranks';
    const pfp = opts.resolvePfp?.(sp.wallet) ?? null;
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push(
      pfp
        ? { type: SECTION_TYPE, components: [{ type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`### ⚡ spotlight\n\`${who}\` ${reason}`) }], accessory: { type: THUMBNAIL_TYPE, media: { url: pfp } } }
        : { type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`### ⚡ spotlight\n\`${who}\` ${reason}`) },
    );
  }
  blocks.push({ type: COMPONENT_SEPARATOR });
  blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: `-# ${wallets} wallets warm` });

  return [{ type: COMPONENT_CONTAINER, accent_color: colorFor({ zone: zd.zone, deltaPct: null } as DigestSnapshot), components: blocks }];
}

const SECTION_TYPE = 9;
const THUMBNAIL_TYPE = 11;
