/**
 * shadow/member-dashboard-cv2.ts — the VOICELESS, MEMBER-CENTRIC CM dashboard
 * render: a `MemberRosterResult` → a Discord Components-V2 (CV2) message (bd-l08).
 *
 * ── WHY THIS, NOT role-sync-result-cv2.ts ────────────────────────────────────
 * `role-sync-result-cv2.ts` renders the LEADERBOARD-centric
 * `GoLiveOrchestrationResult` (per-role create/assign counts) — the latent/growth
 * view. The CM asked to "manage roles for the MEMBERS of our server by their
 * tier", which is a MEMBER-centric before→after table: per member, their current
 * managed role(s) → the proposed tier role + a change indicator. This module is
 * that render. The leaderboard render stays for the LIVE-apply follow-up.
 *
 * ── A CM DASHBOARD (the operator asked for "as clear as possible") ────────────
 * The layout is a community-manager dashboard:
 *   • a header (world + SHADOW-preview note + role-map provenance);
 *   • summary counts (N members · N linked · N would-add · N unlinked · N untiered);
 *   • a per-member before→after list, grouped by change indicator so the
 *     actionable rows (ADD) lead, then KEEP, then the non-actionable
 *     (UNTIERED / UNLINKED / NO-CHANGE). Each row reads:
 *       <indicator> <member> · <current role(s)> → <proposed role>
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * Pure render (`MemberRosterResult` → CV2 component JSON). NO persona, NO voice,
 * NO narration, no Discord call, no event. There is no persona-engine import.
 * Every string is a structural label or a count.
 *
 * ── INJECTION GUARD (mirrors role-sync-result-cv2.ts / discrepancy-cv2.ts) ────
 * Member DISPLAY NAMES and role KEYS are attacker-controllable (a member sets
 * their own nick; a low-priv member can create a guild role named `@everyone`).
 * We reuse `escapeRoleName` (neutralizes mention syntax + markdown) + clamp +
 * `allowed_mentions: { parse: [] }` so a malicious name cannot spoof the layout
 * or fire a mass-ping.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type { MemberRosterResult, MemberTierRow, MemberChange } from "./member-roster.ts";
import type { RoleMapSource } from "./role-sync-seed-map.ts";

/** Warm honey for a SHADOW preview (this render is SHADOW-only). */
const ACCENT_SHADOW = 0x6f4ea1;

/** Max rendered name length before truncation (defense vs a pathological name). */
const MAX_NAME_CHARS = 48;
/** Conservative per-text-component char budget (well under Discord's ~4000). */
const MAX_TEXT_COMPONENT_CHARS = 3500;
/** Max member rows rendered PER change group before a `…and N more` affordance. */
const MAX_ROWS_PER_GROUP = 40;

/** Per-indicator glyph + label, ordered actionable-first for a CM. */
const CHANGE_META: ReadonlyArray<{ change: MemberChange; glyph: string; label: string }> = [
  { change: "ADD", glyph: "➕", label: "Would add" },
  { change: "KEEP", glyph: "✅", label: "Keep (already has the role)" },
  { change: "UNTIERED", glyph: "➖", label: "Untiered (no qualifying tier)" },
  { change: "UNLINKED", glyph: "🔗", label: "Unlinked (no linked wallet)" },
  { change: "NO-CHANGE", glyph: "·", label: "No change" },
];

function clamp(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Render an attacker-controllable display name → a safe inline string. */
function safeName(raw: string | undefined, discordId: string): string {
  const base = raw && raw.length > 0 ? raw : `member ${discordId}`;
  return clamp(escapeRoleName(base), MAX_NAME_CHARS);
}

/** Render an attacker-controllable role key → a safe inline code span. */
function codeRole(raw: string): string {
  return `\`${clamp(escapeRoleName(raw), MAX_NAME_CHARS)}\``;
}

/** Render the "current managed role(s)" cell (the BEFORE side). */
function renderCurrent(row: MemberTierRow): string {
  if (row.current_managed_roles.length === 0) return "_(none)_";
  return row.current_managed_roles.map(codeRole).join(", ");
}

/** Render the "proposed role" cell (the AFTER side). */
function renderProposed(row: MemberTierRow): string {
  if (row.proposed_role_key) return codeRole(row.proposed_role_key);
  if (!row.linked) return "_(unlinked)_";
  return "_(no role)_";
}

/** Render one member row: `<glyph> <name> · <current> → <proposed>`. */
function renderRow(row: MemberTierRow): string {
  const glyph = CHANGE_META.find((m) => m.change === row.change)?.glyph ?? "·";
  const name = safeName(row.display_name, row.discord_id);
  const tierNote = row.tier ? ` (tier ${codeRole(row.tier)})` : "";
  return `${glyph} **${name}**${tierNote} · ${renderCurrent(row)} → ${renderProposed(row)}`;
}

/**
 * Join already-rendered rows, stopping once `maxRows` or `maxChars` is hit,
 * appending a `…and N more` affordance. Mirrors `boundedJoin` in the sibling
 * renders (a large guild must not produce an oversized text component Discord
 * silently rejects).
 */
function boundedRows(rows: readonly string[], maxRows: number, maxChars: number): string {
  if (rows.length === 0) return "_(none)_";
  const kept: string[] = [];
  let len = 0;
  for (let i = 0; i < rows.length; i++) {
    const piece = rows[i]!;
    const remaining = rows.length - i;
    if ((kept.length >= maxRows || len + piece.length + 1 > maxChars) && kept.length > 0) {
      return `${kept.join("\n")}\n…and ${remaining} more`;
    }
    kept.push(piece);
    len += piece.length + 1;
  }
  return kept.join("\n");
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

/** Context the dashboard carries beyond the roster result. */
export interface MemberDashboardContext {
  readonly world: string;
  /** provenance of the role-map: CM-authored ("config-service") vs default seed. */
  readonly mapSource: RoleMapSource;
}

/**
 * Render a `MemberRosterResult` as a CV2 container component (the single
 * top-level component). The caller wraps it via {@link memberDashboardCV2Payload}.
 *
 * STRUCTURAL ONLY: header, summary counts, and per-member before→after rows
 * grouped by change indicator. No persona, no voice, no narration. SHADOW-only.
 */
export function renderMemberDashboardCV2(
  result: MemberRosterResult,
  ctx: MemberDashboardContext,
): ContainerComponent {
  const s = result.summary;

  const mapNote =
    ctx.mapSource === "default-seed"
      ? "_Role-map: **DEFAULT SEED** (CM-overridable — author the real map in the dashboard / config-service)._"
      : "_Role-map: CM-authored (config-service)._";

  const summaryLine =
    `**${s.members}** members · **${s.linked}** linked · ` +
    `**${s.would_add}** would-add · **${s.keep}** keep · ` +
    `**${s.unlinked}** unlinked · **${s.untiered}** untiered`;

  const components: Array<TextComponent | SeparatorComponent> = [
    text(`# Member roles — \`${ctx.world}\` (SHADOW preview)`),
    text(
      `_Preview only — ZERO writes. Each server member → their tier → their role._\n${mapNote}`,
    ),
    sep,
    text(`## Summary\n${summaryLine}`),
    sep,
  ];

  // group rows by change indicator, actionable-first.
  for (const meta of CHANGE_META) {
    const group = result.rows.filter((r) => r.change === meta.change);
    if (group.length === 0) continue;
    const body = boundedRows(group.map(renderRow), MAX_ROWS_PER_GROUP, MAX_TEXT_COMPONENT_CHARS);
    components.push(text(`## ${meta.glyph} ${meta.label} (${group.length})\n${body}`));
  }

  return { type: 17, accent_color: ACCENT_SHADOW, components };
}

/** The full CV2 message payload (flags + components + inert mentions). */
export function memberDashboardCV2Payload(
  result: MemberRosterResult,
  ctx: MemberDashboardContext,
): {
  flags: number;
  components: ContainerComponent[];
  allowed_mentions: { parse: never[] };
} {
  return {
    flags: IS_COMPONENTS_V2,
    components: [renderMemberDashboardCV2(result, ctx)],
    // INJECTION GUARD: every mention is inert — an attacker-named role / nick
    // surfaced in the rows cannot fire an @everyone / role / user ping.
    allowed_mentions: { parse: [] },
  };
}
