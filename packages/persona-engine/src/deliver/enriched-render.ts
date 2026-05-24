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

import type { ZoneDigest, Spotlight, TopMover } from '../score/index.ts';
import { getWindowEventCount, getWindowWalletCount } from '../score/index.ts';
import { ZONE_REGISTRY } from '../domain/zone-registry.ts';
import { escapeDiscordMarkdown } from './sanitize.ts';

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

// Acronyms that must stay uppercased in the prettify fallback (BB review · enriched-prettyfactor-
// acronym-case). Canonical names come from the MCP catalog; this only shapes the last-resort path.
const FACTOR_ACRONYMS = new Set(['lp', 'nft', 'og', 'p2p', 'dao', 'tvl', 'apr', 'apy', 'pol']);

/** factor_id "onchain:lp_provide" → "LP Provide" (last-resort fallback; canonical names come from the MCP). */
export function prettyFactorName(factorId: string): string {
  const tail = factorId.includes(':') ? factorId.split(':').slice(1).join(':') : factorId;
  return tail
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => (FACTOR_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Shorten a 0x wallet to 0xAB00…00Cd (spotlight fallback when no handle resolves). */
function shortenWallet(wallet: string): string {
  if (!wallet.startsWith('0x') || wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Spotlight reason text. For a rank climb, surface the ACTUAL movement (operator: a spotlight that
 *  doesn't show the rank change isn't much of a spotlight). Falls back to prose if no mover matches. */
function spotlightReason(sp: Spotlight, mover: TopMover | undefined): string {
  if (sp.reason === 'new_badge') {
    // name the badge + bold it (operator feedback 2026-05-23). details.badge_name is
    // curator/score-api data → escape before it enters markdown prose (same boundary as `who`).
    const name = typeof sp.details?.badge_name === 'string' ? sp.details.badge_name.trim() : '';
    return name ? `earned **${escapeDiscordMarkdown(name)}**` : 'earned a new badge';
  }
  if (mover && mover.prior_rank != null && mover.current_rank != null) {
    return `climbed #${mover.prior_rank} → #${mover.current_rank}`;
  }
  if (mover && mover.rank_delta) return `climbed ${Math.abs(mover.rank_delta)} ranks`;
  return 'climbed the ranks';
}

// ──────────────────────────────────────────────────────────────────────
// Multi-user spotlight (cycle-008 · the RLHF-winning V3 "leaderboard" direction)
// ──────────────────────────────────────────────────────────────────────
//
// The single ⚡ spotlight becomes a "spotlight · this week" board of N members.
// THE DATA-SHAPE TRUTH (grounded in score/types.ts): a climber from
// rank_changes.climbed is a `TopMover` — it carries rank deltas, NEVER a badge.
// So the board is honestly HIERARCHICAL: the curated hero may carry a named badge
// (Spotlight.reason === 'new_badge'); climbers carry rank movement ("climbed #84 →
// #7"). Option (b) layers a recent-badges join on top (resolveBadge) to upgrade a
// climber's line when that wallet earned a badge — but that join is sparse, so the
// rank line is always the fallback. The rank-delta IS the leaderboard signal.

/** N ≤ 3: legible, fits the Discord Container budget, scan-able (spec · ALEXANDER). */
export const SPOTLIGHT_CAP = 3;

/** One spotlight board entry: the spotlight (real for the hero, synthesized for climbers),
 *  its rank mover (for the "#X → #Y" line), hero flag, and whether WE synthesized it. */
export interface SpotlightEntry {
  readonly spotlight: Spotlight;
  readonly mover: TopMover | undefined;
  /** Entry #1 — the curated pick (or the top climber when no curated spotlight). Gets the ⚡. */
  readonly hero: boolean;
  /** True only for climbers we fabricated from rank_changes.climbed → badge-join eligible. */
  readonly synthesized: boolean;
}

export interface DerivedSpotlights {
  readonly entries: SpotlightEntry[];
  /** Climbers that didn't fit under the cap → the "-# +K more climbing" footer. */
  readonly moreCount: number;
}

const sameWallet = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Derive the ordered, deduped, capped spotlight board from a ZoneDigest.
 *
 * V2 hook: a curated `raw_stats.spotlights[]` (when score-api provides it) WINS over
 * derivation. V1 (today): [the single curated `spotlight` as hero, ...rank_changes.climbed
 * as synthesized rank_climb entries], deduped by wallet (the hero often re-appears in
 * climbed), capped at `cap`. Reversibility: drop the climber loop → the hero-only list
 * remains (one edit).
 */
export function deriveSpotlights(zd: ZoneDigest, cap = SPOTLIGHT_CAP): DerivedSpotlights {
  const rs = zd.raw_stats;
  const climbed = rs.rank_changes?.climbed ?? [];
  const moverFor = (wallet: string): TopMover | undefined =>
    climbed.find((m) => sameWallet(m.wallet, wallet)) ??
    rs.top_movers?.find((m) => sameWallet(m.wallet, wallet));

  const seen = new Set<string>();
  const all: SpotlightEntry[] = [];
  const push = (spotlight: Spotlight, mover: TopMover | undefined, synthesized: boolean): void => {
    const key = spotlight.wallet.toLowerCase();
    if (seen.has(key)) return; // dedup (case-insensitive) — hero re-appears in climbed
    seen.add(key);
    all.push({ spotlight, mover, hero: all.length === 0, synthesized });
  };

  const curated = rs.spotlights;
  if (curated && curated.length > 0) {
    // V2: curated array wins. Respect each entry's own reason (no badge-join override).
    for (const sp of curated) push(sp, moverFor(sp.wallet), false);
  } else {
    // V1: curated single spotlight (if any) is the hero; climbers fill the rest.
    if (rs.spotlight) push(rs.spotlight, moverFor(rs.spotlight.wallet), false);
    for (const m of climbed) {
      push({ wallet: m.wallet, reason: 'rank_climb', details: {} }, m, true);
    }
  }

  const entries = all.slice(0, cap);
  return { entries, moreCount: all.length - entries.length };
}

/** The reason text for an entry, applying the option-(b) badge-join. SINGLE SOURCE so the
 *  N=1 single block and the N≥2 board agree: a SYNTHESIZED climber with a resolveBadge match
 *  reads "earned **Badge**"; a curated pick keeps its own reason (badge escaped inside
 *  spotlightReason at the markdown boundary). */
function entryReason(entry: SpotlightEntry, opts: EnrichedDigestOpts): string {
  const badgeName = entry.synthesized ? (opts.resolveBadge?.(entry.spotlight.wallet) ?? null) : null;
  const sp: Spotlight = badgeName
    ? { ...entry.spotlight, reason: 'new_badge', details: { ...entry.spotlight.details, badge_name: badgeName } }
    : entry.spotlight;
  return spotlightReason(sp, entry.mover);
}

/** Render ONE board entry as a Section-with-Thumbnail (when a pfp resolves) or a bare
 *  TextDisplay (fail-soft: a null pfp degrades that one entry, never the digest). The hero
 *  gets the ⚡; climbers are lighter. Per-entry: handle escaped here, badge inside entryReason. */
function renderSpotlightSection(entry: SpotlightEntry, opts: EnrichedDigestOpts): unknown {
  const handle = opts.resolveHandle ?? shortenWallet;
  const who = escapeDiscordMarkdown(handle(entry.spotlight.wallet));
  const what = entryReason(entry, opts);
  const bolt = entry.hero ? '⚡ ' : '';
  const line = stripEmDashes(`${bolt}**${who}** ${what}`);
  const pfp = opts.resolvePfp?.(entry.spotlight.wallet) ?? null;
  return pfp
    ? { type: SECTION_TYPE, components: [{ type: COMPONENT_TEXT_DISPLAY, content: line }], accessory: { type: THUMBNAIL_TYPE, media: { url: pfp } } }
    : { type: COMPONENT_TEXT_DISPLAY, content: line };
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
   * Resolve a wallet → a recently-earned badge name, or null (cycle-008 · option b).
   * Applied ONLY to SYNTHESIZED climber entries (the ones derived from rank_changes.climbed):
   * a climber with a matching recent badge upgrades from a bare "climbed #X → #Y" line to
   * "earned **Badge**". Curated spotlights keep their own reason — score-api's pick wins.
   * The badge feed is a global earnings list; an unmatched climber falls back to the rank line.
   */
  readonly resolveBadge?: (wallet: string) => string | null;
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
  // handle() may resolve an external/untrusted identity (discord_username · mibera_id). EVERY sink
  // that puts handle() output into Discord prose MUST run it through escapeDiscordMarkdown first —
  // today the only sink is the spotlight `who` (below). Any new wallet-identity field (top movers,
  // climbers) must escape at its render site too. (FAGAN-thorough opus-skeptic cleanup · 2026-05-23)
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
    // window hoisted to the subtitle in parens (operator RLHF gen-2, 2026-05-24): the window
    // belongs at the top with the zone identity, not split onto the hero count's second line.
    { type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`## ${r.emoji} ${r.displayName}\n-# ${dimDisplay(r.dimension)} (last ${days} days)`) },
    { type: COMPONENT_TEXT_DISPLAY, content: `# ${events}\nevents` },
  ];
  if (movers) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: stripEmDashes(`-# Movers\n${movers}`) });
  }
  // Spotlight board (cycle-008 · the RLHF V3 multi-user direction). deriveSpotlights
  // returns 0..N entries; N=1 keeps the original single-spotlight block byte-for-byte
  // (backward-compatible); N≥2 renders the leaderboard. Multi is purely additive —
  // delete the N≥2 branch and the single path remains (reversibility).
  const { entries, moreCount } = deriveSpotlights(zd, SPOTLIGHT_CAP);
  if (entries.length === 1) {
    const entry = entries[0]!;
    // handle resolves to an external/untrusted identity (discord_username · mibera_id — both can
    // carry markdown chars: `mibera_acquire` would italicize mid-word). Escape at the presentation
    // boundary per the chat-medium-presentation-boundary doctrine + the CLAUDE.md sanitize invariant.
    // (allowed_mentions:{parse:[]} at the send layer already blocks pings; this closes the
    // markdown-distortion residual.) FAGAN-thorough gpt-reviewer · 2026-05-23.
    const who = escapeDiscordMarkdown(handle(entry.spotlight.wallet));
    // entryReason is a no-op for a curated hero (synthesized:false) → byte-identical to the
    // legacy single block; a lone synthesized climber gets the same badge-join as the board.
    const what = entryReason(entry, opts);
    const pfp = opts.resolvePfp?.(entry.spotlight.wallet) ?? null;
    // ⚡ moved off the header onto the featured user (gen-2): the lone spotlight IS the featured
    // one, so it carries the sole ⚡ — consistent with the board's hero marker.
    const line = stripEmDashes(`-# Spotlight\n⚡ **${who}** ${what}`);
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push(
      pfp
        ? { type: SECTION_TYPE, components: [{ type: COMPONENT_TEXT_DISPLAY, content: line }], accessory: { type: THUMBNAIL_TYPE, media: { url: pfp } } }
        : { type: COMPONENT_TEXT_DISPLAY, content: line },
    );
  } else if (entries.length >= 2) {
    // The leaderboard: one header sets the frame, then a Section per member (hero ⚡ +
    // escalating juice top-down), separators between, a "+K more climbing" footer when capped.
    blocks.push({ type: COMPONENT_SEPARATOR });
    // header drops the ⚡ + "· this week" (gen-2) and de-bolds to subtext (gen-3 · "don't bold
    // moves and spotlight"): the window lives in the hoisted subtitle, ⚡ marks the featured user,
    // and the bold weight goes to the data (handles + badges), not the section label.
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: '-# Spotlight' });
    entries.forEach((entry, i) => {
      if (i > 0) blocks.push({ type: COMPONENT_SEPARATOR });
      blocks.push(renderSpotlightSection(entry, opts));
    });
    if (moreCount > 0) {
      blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: `-# +${moreCount} more climbing` });
    }
  }
  // entries.length === 0 → no spotlight area (spotlight null + no climbers · unchanged).
  // members-warm footer: omit when 0 (the live pulse path can report 0 → never show "0 … warm").
  // "miberas" = the THJ community's member noun (operator: "we call them Miberas").
  if (wallets > 0) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: `-# ${wallets} miberas warm` });
  }

  return [{ type: COMPONENT_CONTAINER, accent_color: ZONE_ACCENT[zd.zone] ?? 0x6f4ea1, components: blocks }];
}
