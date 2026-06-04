/**
 * shadow/public-role-board-cv2.ts — the PUBLIC, world-themed, VOICELESS live role
 * board render: a `MemberRosterResult` → a Discord Components-V2 (CV2) message
 * for EVERYONE in the server (cycle public-role-board, the experiment surface).
 *
 * ── WHY THIS, NOT member-dashboard-cv2.ts ────────────────────────────────────
 * `member-dashboard-cv2.ts` is the EPHEMERAL CM-admin dashboard: a per-member
 * before→after table (UNLINKED / UNTIERED / ADD / KEEP rows + a proposed-role
 * AFTER cell), with an "apply" intent downstream. Audience: the community
 * manager. This module is the PUBLIC counterpart from the same roster: a
 * persistent status display of the tier LANDSCAPE — how many members sit at each
 * rung of the tier ladder + an adoption line — framed for the whole server, with
 * NO per-member admin actions and NO Apply affordance. Both consume the SAME
 * `MemberRosterResult` (member-roster.ts); only the audience + framing differ.
 * See grimoires/loa/context/2026-06-04-cm-operating-surface-medium-parity.md
 * ("Two role surfaces over one roster").
 *
 * ── READ-ONLY · ZERO WRITES · ZERO ROLE MUTATIONS ────────────────────────────
 * This is a PURE render function (`MemberRosterResult` → CV2 component JSON). It
 * holds NO onboarding logic, mutates NO roles, fires no events, makes no Discord
 * call. The post script (`apps/bot/scripts/post-role-board.ts`) sends the output.
 * It surfaces ONLY aggregate counts — never a per-member action.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * No persona-engine voice import. Every string is a structural label, a count,
 * or a world-supplied DISPLAY NAME. This is the operating surface, not a
 * character. It SHOULD feel like the world (honey-gold accent + glyph ladder +
 * lore tier names) — but the lore names come from DATA (the role-map's
 * `display_name` per rule), not hardcoded, so another world reskins the same
 * board by mounting its own role-map + accent.
 *
 * ── WORLD-CUSTOMIZABLE (data-driven, not hardcoded) ──────────────────────────
 * The tier ladder is built from the injected role-map rules — each rule's
 * `display_name` (the lore name a CM authored, e.g. "Sovereign") + its
 * `qualifies.min_tier` (the score-api tier id rows carry). The ordering comes
 * from an injected tier-rank resolver (defaults to the Purupuru ladder). The
 * accent is a parameter. A different world supplies its own role-map + accent +
 * (optionally) its own rank resolver — no code change.
 *
 * ── INJECTION GUARD (mirrors member-dashboard-cv2 / discrepancy-cv2) ──────────
 * The world TITLE (slug) and role DISPLAY NAMES are surfaced verbatim. Role
 * names are CM-authored config (lower risk) but a slug or a future
 * dashboard-authored name could carry mention/markdown syntax. We reuse
 * `escapeRoleName` (neutralizes mention syntax + markdown) + clamp +
 * `allowed_mentions: { parse: [] }` so no surfaced string can spoof the layout
 * or fire a mass-ping. The board is public — the injection surface is wider, so
 * the guard is mandatory, not optional.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type { RoleRule, RoleMapConfig } from "@freeside-worlds/shadow-substrate";
import type { MemberRosterResult } from "./member-roster.ts";
import { purupuruTierRank, type TierRankResolver } from "./purupuru-tiers.ts";

/** Warm honey-gold — the default world accent for the public board. */
export const ACCENT_HONEY = 0xe0a83d;

/** Max rendered display-name length before truncation (defense vs a long name). */
const MAX_NAME_CHARS = 48;
/** Conservative per-text-component char budget (well under Discord's ~4000). */
const MAX_TEXT_COMPONENT_CHARS = 3500;

/**
 * The honey-comb ladder glyphs, lowest rung → highest. A short, fixed palette
 * read bottom-up: the climb from the crowd to the world's apex. Index by the
 * tier's POSITION on the ladder (0 = lowest shown), clamped to the last glyph for
 * deeper ladders. Honey/element aesthetic without per-world hardcoding.
 */
const RUNG_GLYPHS = ["🐝", "🍯", "✨", "👑"] as const;

/** A filled / empty bar cell pair for the per-tier count bar (visual weight). */
const BAR_FILLED = "▰";
const BAR_EMPTY = "▱";
/** Max bar cells (the bar is a RELATIVE visual, scaled to the busiest tier). */
const BAR_CELLS = 12;

function clamp(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Render an attacker/world-supplied display string → a safe inline string. */
function safeText(raw: string): string {
  return clamp(escapeRoleName(raw), MAX_NAME_CHARS);
}

/** Title-case a world slug for the header (display only; escaped). */
function worldTitle(world: string): string {
  const cleaned = world.replace(/[-_]+/g, " ").trim();
  const titled = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  return safeText(titled.length > 0 ? titled : world);
}

type TextComponent = { type: 10; content: string };
type SeparatorComponent = { type: 14 };
type ContainerComponent = {
  type: 17;
  accent_color: number;
  components: Array<TextComponent | SeparatorComponent>;
};

function text(content: string): TextComponent {
  return { type: 10, content };
}
const sep: SeparatorComponent = { type: 14 };

/** One rung of the rendered ladder (a tier + how many members hold it). */
interface LadderRung {
  /** the score-api tier id (the join key against roster rows). */
  readonly tier: string;
  /** the lore display name (CM-authored, world-customizable). */
  readonly displayName: string;
  /** how many CURRENT linked members resolve to exactly this tier. */
  readonly count: number;
}

/** Context the public board carries beyond the roster result. */
export interface PublicRoleBoardContext {
  /** the world slug (themes the header; escaped before render). */
  readonly world: string;
  /**
   * the role-map whose rules supply the ladder (lore display names + tier ids).
   * DATA-DRIVEN: a different world reskins the board via its own map.
   */
  readonly roleMap: RoleMapConfig;
  /** the world accent (defaults to honey-gold). */
  readonly accent?: number;
  /** the tier-strength ordering (defaults to the Purupuru ladder). */
  readonly tierRank?: TierRankResolver;
  /** ISO timestamp stamped in the footer (defaults to now). */
  readonly generatedAt?: string;
}

/**
 * Build the ordered ladder rungs from the role-map rules + the roster rows. One
 * rung per tier rule, ordered by ascending strength rank (lowest rung first),
 * each annotated with how many CURRENT members resolve to exactly that tier.
 * Only the rules whose `qualifies.source === "tier"` contribute a rung.
 */
export function buildLadder(
  result: MemberRosterResult,
  roleMap: RoleMapConfig,
  rank: TierRankResolver,
): LadderRung[] {
  // count linked members at each EXACT resolved tier (untiered/unlinked excluded).
  const byTier = new Map<string, number>();
  for (const row of result.rows) {
    if (!row.linked || !row.tier) continue;
    const key = row.tier.toLowerCase();
    byTier.set(key, (byTier.get(key) ?? 0) + 1);
  }

  const tierRules = roleMap.rules.filter(
    (r: RoleRule): boolean => r.qualifies.source === "tier",
  );

  const rungs: LadderRung[] = tierRules.map((rule) => {
    const tier = rule.qualifies.min_tier;
    return {
      tier,
      displayName: rule.display_name,
      count: byTier.get(tier.toLowerCase()) ?? 0,
    };
  });

  // order by ascending strength rank (lowest rung first); unknown ranks sink to
  // the bottom deterministically by display name so the ladder is stable.
  return rungs.sort((a, b) => {
    const ra = rank(a.tier) ?? -Infinity;
    const rb = rank(b.tier) ?? -Infinity;
    if (ra !== rb) return ra - rb;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** Render the per-tier relative count bar (scaled to the busiest rung). */
function renderBar(count: number, max: number): string {
  if (max <= 0) return BAR_EMPTY.repeat(BAR_CELLS);
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((count / max) * BAR_CELLS)));
  // a non-zero count always shows at least one cell so a tier with members never
  // reads as empty after rounding.
  const cells = count > 0 ? Math.max(1, filled) : 0;
  return BAR_FILLED.repeat(cells) + BAR_EMPTY.repeat(BAR_CELLS - cells);
}

/**
 * Render the ladder as a visual PROGRESSION (highest rung at the TOP — the apex
 * the climb leads to — down to the crowd). Each line:
 *   <rung-glyph> **<lore name>**  <bar>  <count>
 */
function renderLadderLines(rungs: readonly LadderRung[]): string {
  if (rungs.length === 0) return "_(no tiers configured)_";
  const max = rungs.reduce((m, r) => Math.max(m, r.count), 0);
  // present highest-first (apex at top): reverse the ascending-rank order.
  const topFirst = [...rungs].reverse();
  const lines = topFirst.map((rung, i) => {
    // glyph by ladder POSITION (apex gets the crown); index from the top.
    const fromTop = i;
    const glyphIdx = Math.max(0, RUNG_GLYPHS.length - 1 - fromTop);
    const glyph = RUNG_GLYPHS[Math.min(glyphIdx, RUNG_GLYPHS.length - 1)]!;
    const name = safeText(rung.displayName);
    const bar = renderBar(rung.count, max);
    const noun = rung.count === 1 ? "member" : "members";
    return `${glyph} **${name}**  ${bar}  \`${rung.count}\` ${noun}`;
  });
  return lines.join("\n");
}

/** The adoption line: "X of Y members have linked a wallet" + a share of total. */
function renderAdoptionLine(result: MemberRosterResult): string {
  const { members, linked } = result.summary;
  if (members === 0) return "_No members yet._";
  const pct = Math.round((linked / members) * 100);
  const noun = members === 1 ? "member" : "members";
  return `🔗 **${linked}** of **${members}** ${noun} have linked a wallet  ·  ${pct}% onboarded`;
}

/**
 * Render a `MemberRosterResult` as the PUBLIC role-board CV2 container component
 * (the single top-level component). The caller wraps it via
 * {@link publicRoleBoardCV2Payload}.
 *
 * STRUCTURAL ONLY: a world-themed header, the tier ladder (lore names + per-tier
 * counts as a relative bar), and a single adoption line. No persona, no voice,
 * no per-member action, no Apply affordance. READ-ONLY.
 */
export function renderPublicRoleBoardCV2(
  result: MemberRosterResult,
  ctx: PublicRoleBoardContext,
): ContainerComponent {
  const accent = ctx.accent ?? ACCENT_HONEY;
  const rank = ctx.tierRank ?? purupuruTierRank;
  const generatedAt = ctx.generatedAt ?? new Date().toISOString();
  const title = worldTitle(ctx.world);

  const rungs = buildLadder(result, ctx.roleMap, rank);
  const tieredCount = rungs.reduce((m, r) => m + r.count, 0);
  const ladderBody = clampBody(renderLadderLines(rungs));

  const components: Array<TextComponent | SeparatorComponent> = [
    text(`# 🍯 ${title} — the tier landscape`),
    text(`_A live look at where the community stands. Read-only · refreshed periodically._`),
    sep,
    text(`## The ladder\n${ladderBody}`),
    sep,
    text(
      `${renderAdoptionLine(result)}\n` +
        `🏅 **${tieredCount}** ${tieredCount === 1 ? "member has" : "members have"} earned a tier`,
    ),
    text(`_updated ${escapeRoleName(generatedAt)}_`),
  ];

  return { type: 17, accent_color: accent, components };
}

/** Hard-clamp a rendered body to the per-text-component budget (defense). */
function clampBody(body: string): string {
  return body.length > MAX_TEXT_COMPONENT_CHARS
    ? `${body.slice(0, MAX_TEXT_COMPONENT_CHARS - 1)}…`
    : body;
}

/** The full CV2 message payload (flags + components + inert mentions). */
export function publicRoleBoardCV2Payload(
  result: MemberRosterResult,
  ctx: PublicRoleBoardContext,
): {
  flags: number;
  components: ContainerComponent[];
  allowed_mentions: { parse: never[] };
} {
  return {
    flags: IS_COMPONENTS_V2,
    components: [renderPublicRoleBoardCV2(result, ctx)],
    // INJECTION GUARD: every mention is inert — a world slug / lore role name
    // surfaced on the board cannot fire an @everyone / role / user ping.
    allowed_mentions: { parse: [] },
  };
}
