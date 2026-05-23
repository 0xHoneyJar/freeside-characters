// cycle-008 S9 → production · enriched digest renderer (Components V2).
//
// The 5/5 RLHF-validated digest format, as a PURE function over a real ZoneDigest.
// Lives in deliver/ (prod core) — the RLHF tool in preview/ re-imports it, so the
// dependency points inward (preview → prod), never the reverse.
//
// Maps live `raw_stats` → the enriched layout: hero event count, factor movers,
// spotlight, wallets-warm footer. Names + spotlight identity are injected from the
// edge (resolveFactorName from the score factor catalog, resolveHandle from
// freeside_auth) per the hexagonal name-authority-at-the-boundary rule.

import type { ZoneDigest } from '../score/types.ts';
import { getWindowEventCount, getWindowWalletCount } from '../score/types.ts';
import { ZONE_REGISTRY } from '../domain/zone-registry.ts';

/** Discord message flag enabling Components V2 (1 << 15). */
export const IS_COMPONENTS_V2 = 1 << 15;

// Component type ids per the Discord API.
const COMPONENT_TEXT_DISPLAY = 10;
const COMPONENT_CONTAINER = 17;
const COMPONENT_SEPARATOR = 14;
const SECTION_TYPE = 9;
const THUMBNAIL_TYPE = 11;

// Zone accent colors (the flat/no-delta palette — the enriched card is a billboard,
// not an up/down alert, so it uses the zone's identity color).
const ZONE_ACCENT: Record<string, number> = {
  stonehenge: 0x808890,
  'bear-cave': 0x9b6a3f,
  'el-dorado': 0xc9a44c,
  'owsley-lab': 0x6f4ea1,
};

// Dimension shown in natural casing (operator round-3 · "normal casing for onchain").
const DIM_DISPLAY: Record<string, string> = { onchain: 'Onchain', nft: 'NFT', og: 'OG', overall: 'Overall' };
export const dimDisplay = (d: string): string => DIM_DISPLAY[d] ?? d.charAt(0).toUpperCase() + d.slice(1);

/** Replace em/en dashes with a period (operator: a dash standing in for a period reads as one). */
function stripEmDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, '. ');
}

/** factor_id "onchain:lp_provide" → "Lp Provide" (last-resort fallback; canonical names come from the MCP). */
export function prettyFactorName(factorId: string): string {
  const tail = factorId.includes(':') ? factorId.split(':').slice(1).join(':') : factorId;
  return tail.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shorten a 0x wallet to 0xAB00…00Cd (spotlight fallback when no handle resolves). */
function shortenWallet(wallet: string): string {
  if (!wallet.startsWith('0x') || wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Derive the displayed window length (days) from the digest's own bounds — never hardcode. */
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
   * `display_name` on PulseDimensionFactor; `raw_stats.factor_trends` carries only factor_id, so
   * the caller injects the name dictionary from the edge. Prettify is the last-resort fallback.
   */
  readonly resolveFactorName?: (factorId: string) => string;
}

/** Build the enriched digest as a Components V2 container (send with the IS_COMPONENTS_V2 flag). */
export function buildEnrichedDigestComponentsV2(zd: ZoneDigest, opts: EnrichedDigestOpts = {}): unknown[] {
  const r = ZONE_REGISTRY[zd.zone];
  const events = getWindowEventCount(zd.raw_stats);
  const wallets = getWindowWalletCount(zd.raw_stats);
  const handle = opts.resolveHandle ?? shortenWallet;
  const factorName = opts.resolveFactorName ?? prettyFactorName;
  const days = windowDaysOf(zd);

  // movers = factor_trends by multiplier (the factor-style movers the operator liked)
  const movers = [...zd.raw_stats.factor_trends]
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 3)
    .map((f) => `${f.multiplier >= 1 ? '↑' : '↓'} **${factorName(f.factor_id)}**`)
    .join('   ·   ');

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
  // wallets-warm footer: omit when 0 (the live pulse path can report 0 → never show "0 wallets warm")
  if (wallets > 0) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: `-# ${wallets} wallets warm` });
  }

  return [{ type: COMPONENT_CONTAINER, accent_color: ZONE_ACCENT[zd.zone] ?? 0x6f4ea1, components: blocks }];
}
