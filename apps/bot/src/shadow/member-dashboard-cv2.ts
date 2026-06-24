/**
 * shadow/member-dashboard-cv2.ts — the VOICELESS, MEMBER-CENTRIC CM dashboard
 * render: a `MemberRosterResult` → a Discord Components-V2 (CV2) message (bd-l08;
 * redesigned bd-xaa: ARTISAN + KEEPER weight-gradient pass).
 *
 * ── WHY THIS, NOT role-sync-result-cv2.ts ────────────────────────────────────
 * `role-sync-result-cv2.ts` renders the LEADERBOARD-centric
 * `GoLiveOrchestrationResult` (per-role create/assign counts) — the latent/growth
 * view. The CM asked to "manage roles for the MEMBERS of our server by their
 * tier", which is a MEMBER-centric view: per member, their current managed
 * role(s) → the proposed tier role + a change indicator. This module is that
 * render. The leaderboard render stays for the LIVE-apply receipt.
 *
 * ── THE WEIGHT GRADIENT (ARTISAN + KEEPER redesign) ──────────────────────────
 * Heading depth IS the weight channel — a CM reads the page by visual mass, not
 * by parsing every count. Three tiers:
 *   • `#`  TITLE — the world this is about (the lightest semantic, heaviest type).
 *   • `##` THE STRONG CENTER — the one number that matters: would_add. A CM scans
 *          this and knows what the Apply button will do.
 *   • `###` ADD / KEEP groups — the actionable detail, change-aware.
 *   • `-#`  dim lines — trust frame, not-actionable collapse, adoption. These are
 *          context the CM needs but should NOT compete with the strong center.
 * The trust frame (SHADOW · zero writes · provenance) is ONE small dim line, not
 * a paragraph — it reassures without shouting.
 *
 * ── CHANGE-AWARE ROWS (no dead grammar) ──────────────────────────────────────
 * ADD rows lead with the PROPOSED role (the thing about to happen), not a dead
 * `_(none)_ →` arrow: `➕ **name** → \`role\` (tier N)`. KEEP rows compress to
 * `✅ **name** \`role\`` (no before→after — there is no change). The non-actionable
 * rows (untiered / unlinked / no-change) collapse to ONE dim count line — a CM
 * does not need a per-member list of people who are NOT getting a role.
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
 * or fire a mass-ping. The `purupuru:` namespace prefix is stripped from the
 * RENDERED code-span (post-escape, against the SAFE literal) for readability —
 * the underlying data keeps the full namespaced key.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type { MemberRosterResult, MemberTierRow } from "./member-roster.ts";
import { PURUPURU_NAMESPACE_PREFIX } from "./role-sync-seed-map.ts";
import type { RoleMapSource } from "./role-sync-seed-map.ts";

/** Warm honey for a SHADOW preview when the CM has authored the map. */
const ACCENT_SHADOW = 0x6f4ea1;
/** Alert amber when the run used the DEFAULT SEED (the CM should author a real map). */
const ACCENT_WARN = 0xe0a83d;

/** Max rendered name length before truncation (defense vs a pathological name). */
const MAX_NAME_CHARS = 48;
/** Conservative per-text-component char budget (well under Discord's ~4000). */
const MAX_TEXT_COMPONENT_CHARS = 3500;
/** Max member rows rendered PER change group before a `…and N more` affordance. */
const MAX_ROWS_PER_GROUP = 40;

function clamp(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Render an attacker-controllable display name → a safe inline string. */
function safeName(raw: string | undefined, discordId: string): string {
  const base = raw && raw.length > 0 ? raw : `member ${discordId}`;
  return clamp(escapeRoleName(base), MAX_NAME_CHARS);
}

/**
 * Render an attacker-controllable role key → a safe inline code span, with the
 * managed-role namespace prefix STRIPPED for readability. The strip runs AGAINST
 * THE ESCAPED (safe) literal — never the raw input — so a name that injects
 * markdown cannot survive by hiding behind the prefix. The data keeps the full
 * key; only the rendered span is shortened.
 */
function codeRole(raw: string): string {
  const escaped = escapeRoleName(raw);
  const stripped = escaped.startsWith(PURUPURU_NAMESPACE_PREFIX)
    ? escaped.slice(PURUPURU_NAMESPACE_PREFIX.length)
    : escaped;
  return `\`${clamp(stripped, MAX_NAME_CHARS)}\``;
}

/** ADD row: the proposed role LEADS (no dead `_(none)_ →` arrow). */
function renderAddRow(row: MemberTierRow): string {
  const name = safeName(row.display_name, row.discord_id);
  const role = row.proposed_role_key ? codeRole(row.proposed_role_key) : "`(role)`";
  const tierNote = row.tier ? ` (tier ${codeRole(row.tier)})` : "";
  return `➕ **${name}** → ${role}${tierNote}`;
}

/** KEEP row: compress — already correct, no before→after. */
function renderKeepRow(row: MemberTierRow): string {
  const name = safeName(row.display_name, row.discord_id);
  const role = row.proposed_role_key ? codeRole(row.proposed_role_key) : "`(role)`";
  return `✅ **${name}** ${role}`;
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
type ActionRowComponent = { type: 1; components: ButtonComponent[] };
type ButtonComponent = {
  type: 2;
  style: number;
  label: string;
  custom_id: string;
  disabled?: boolean;
};
type ContainerChild = TextComponent | SeparatorComponent | ActionRowComponent;
type ContainerComponent = {
  type: 17;
  accent_color: number;
  components: ContainerChild[];
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
  /**
   * OPTIONAL decision-fence affordance (bd-20x). When present, the dashboard
   * appends a full-weight Separator (the "decision fence") + an ActionRow with
   * the Apply button. The button is content-addressed by the map hash so a stale
   * preview can never apply (the dispatch's stale-guard recomputes + compares).
   * SHADOW preview NEVER carries a one-click direct write — Apply opens a CONFIRM
   * step; the confirm is the only mutating path.
   */
  readonly apply?: ApplyAffordance;
}

/** The Apply affordance the dashboard renders as its last child (bd-20x). */
export interface ApplyAffordance {
  /** the first 12 hex of the canonical role-map hash — content-addresses the apply. */
  readonly mapHash12: string;
}

/** Button styles (mirror verify-card.ts BUTTON_PRIMARY = 1). */
const BUTTON_PRIMARY = 1;
const BUTTON_SECONDARY = 2;

/** The reserved interaction custom_id namespace for the role-sync apply flow. */
export const ROLE_SYNC_PREFIX = "rolesync:";

/**
 * Build the Apply button for the decision fence (bd-20x). PRIMARY + enabled when
 * there is something to apply (`would_add > 0`); SECONDARY + disabled with a
 * "Nothing to apply" label otherwise. The custom_id is content-addressed —
 * `rolesync:apply:<world>:<mapHash12>` — so a click is bound to the exact map the
 * preview was computed against (the dispatch stale-guard recomputes + compares).
 */
export function buildApplyButton(
  world: string,
  wouldAdd: number,
  mapHash12: string,
): ButtonComponent {
  if (wouldAdd <= 0) {
    return {
      type: 2,
      style: BUTTON_SECONDARY,
      label: "Nothing to apply",
      custom_id: `${ROLE_SYNC_PREFIX}apply:${world}:${mapHash12}`,
      disabled: true,
    };
  }
  return {
    type: 2,
    style: BUTTON_PRIMARY,
    label: `Apply (${wouldAdd})`,
    custom_id: `${ROLE_SYNC_PREFIX}apply:${world}:${mapHash12}`,
  };
}

/**
 * Render a `MemberRosterResult` as a CV2 container component (the single
 * top-level component). The caller wraps it via {@link memberDashboardCV2Payload}.
 *
 * THE WEIGHT GRADIENT (top → bottom):
 *   # Title → -# trust frame → ## strong center → ### ADD → ### KEEP →
 *   -# not-actionable → -# adoption → [decision fence Separator + ActionRow]
 */
export function renderMemberDashboardCV2(
  result: MemberRosterResult,
  ctx: MemberDashboardContext,
): ContainerComponent {
  const s = result.summary;
  const isSeed = ctx.mapSource === "default-seed";

  // GROUNDING FIX (bd-xaa): MemberRosterSummary has NO no_change field — derive it.
  const noChange = Math.max(
    0,
    s.members - s.would_add - s.keep - s.unlinked - s.untiered,
  );
  const notActionable = s.unlinked + s.untiered + noChange;

  const accent = isSeed ? ACCENT_WARN : ACCENT_SHADOW;
  const provenanceLabel = isSeed ? "default seed" : "CM-authored";

  // ── TITLE (the lightest semantic, the heaviest type) ──────────────────────
  const components: ContainerChild[] = [
    text(`# Member roles — \`${ctx.world}\``),
  ];

  // ── TRUST FRAME — ONE small dim line. ⚠ overridable token only on seed. ────
  const seedToken = isSeed ? " · ⚠ default seed (overridable)" : "";
  components.push(text(`-# SHADOW preview · zero writes · map: ${provenanceLabel}${seedToken}`));

  components.push(sep);

  // ── THE STRONG CENTER — the one number that matters. ──────────────────────
  components.push(
    text(
      `## ${s.would_add} would gain a role\n` +
        `\`${s.keep}\` already correct · ${notActionable} not actionable`,
    ),
  );

  // ── ADD group (### — actionable detail, change-aware, proposed leads). ─────
  const addRows = result.rows.filter((r) => r.change === "ADD");
  if (addRows.length > 0) {
    const body = boundedRows(
      addRows.map(renderAddRow),
      MAX_ROWS_PER_GROUP,
      MAX_TEXT_COMPONENT_CHARS,
    );
    components.push(text(`### Would gain a role (${addRows.length})\n${body}`));
  }

  // ── KEEP group (### — compressed; already correct). ───────────────────────
  const keepRows = result.rows.filter((r) => r.change === "KEEP");
  if (keepRows.length > 0) {
    const body = boundedRows(
      keepRows.map(renderKeepRow),
      MAX_ROWS_PER_GROUP,
      MAX_TEXT_COMPONENT_CHARS,
    );
    components.push(text(`### Already correct (${keepRows.length})\n${body}`));
  }

  // ── NON-ACTIONABLE — ONE dim collapse line (NO per-member rows). ──────────
  if (notActionable > 0) {
    components.push(
      text(
        `-# Not actionable — ${s.untiered} untiered · ${s.unlinked} unlinked · ${noChange} no change`,
      ),
    );
  }

  // ── ADOPTION (KEEPER) — dim; omitted when fully linked. ───────────────────
  if (s.linked < s.members) {
    components.push(
      text(`-# ${s.linked} of ${s.members} members have linked a wallet`),
    );
  }

  // ── DECISION FENCE — full-weight Separator + the Apply ActionRow (bd-20x). ─
  // SHADOW preview NEVER carries a one-click direct write — the button opens a
  // CONFIRM step (handled by role-sync-dispatch.ts). When the caller omits the
  // affordance (e.g. a pure render with no interaction surface), no fence/button.
  if (ctx.apply) {
    components.push(sep);
    components.push({
      type: 1,
      components: [buildApplyButton(ctx.world, s.would_add, ctx.apply.mapHash12)],
    });
  }

  return { type: 17, accent_color: accent, components };
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

// ─── The two-step Apply CONFIRM card (bd-20x) ────────────────────────────────

/** Context the confirm card carries. */
export interface ApplyConfirmContext {
  readonly world: string;
  /** provenance of the role-map: CM-authored vs default seed. */
  readonly mapSource: RoleMapSource;
  /** the first 12 hex of the FR-7 map hash — content-addresses the confirm. */
  readonly mapHash12: string;
}

/**
 * Render the CONFIRM card (the second step of Apply→Confirm→LIVE). NON-mutating:
 * this is the UPDATE_MESSAGE re-render after a CM clicks Apply. It shows ONLY the
 * ADD-only count + the role(s) about to be granted, the map hash + provenance, and
 * the explicit invariant that the apply does NOT touch Keep / Unlinked / Untiered.
 * Two buttons: PRIMARY confirm (the ONLY mutating custom_id) + SECONDARY cancel.
 *
 * The accent is the LIVE/applied amber (this card is the gate before a real write),
 * distinct from the SHADOW honey of the preview, so the CM sees they are at the
 * boundary.
 */
export function renderApplyConfirmCV2(
  result: MemberRosterResult,
  ctx: ApplyConfirmContext,
): ContainerComponent {
  const s = result.summary;
  const isSeed = ctx.mapSource === "default-seed";
  const provenanceLabel = isSeed ? "default seed" : "CM-authored";

  // ADD-only — the roles about to be granted, aggregated by proposed role.
  const addRows = result.rows.filter((r) => r.change === "ADD");
  const byRole = new Map<string, number>();
  for (const r of addRows) {
    if (!r.proposed_role_key) continue;
    byRole.set(r.proposed_role_key, (byRole.get(r.proposed_role_key) ?? 0) + 1);
  }
  const roleLines = boundedRows(
    [...byRole.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, n]) => `• ${codeRole(role)} — ${n} member${n === 1 ? "" : "s"}`),
    MAX_ROWS_PER_GROUP,
    MAX_TEXT_COMPONENT_CHARS,
  );

  const components: ContainerChild[] = [
    text(`# Confirm — grant ${s.would_add} role${s.would_add === 1 ? "" : "s"} on \`${ctx.world}\``),
    text(`-# This WILL write to Discord (LIVE) · map: ${provenanceLabel} · \`${ctx.mapHash12}…\``),
    sep,
    text(`## Roles to grant (${s.would_add})\n${roleLines}`),
    // the load-bearing scope invariant — the apply is ADD-only.
    text("-# This does not touch Keep / Unlinked / Untiered."),
    sep,
    {
      type: 1,
      components: [
        {
          type: 2,
          style: BUTTON_PRIMARY,
          label: `Confirm — grant ${s.would_add} roles`,
          custom_id: `${ROLE_SYNC_PREFIX}confirm:${ctx.world}:${ctx.mapHash12}`,
          // would_add === 0 ⇒ nothing to confirm; disable + relabel.
          ...(s.would_add <= 0 ? { disabled: true, label: "Nothing to grant" } : {}),
        },
        {
          type: 2,
          style: BUTTON_SECONDARY,
          label: "Cancel",
          custom_id: `${ROLE_SYNC_PREFIX}cancel:${ctx.world}:${ctx.mapHash12}`,
        },
      ],
    },
  ];

  return { type: 17, accent_color: ACCENT_WARN, components };
}

/** The full CONFIRM-card CV2 payload (flags + components + inert mentions). */
export function applyConfirmCV2Payload(
  result: MemberRosterResult,
  ctx: ApplyConfirmContext,
): {
  flags: number;
  components: ContainerComponent[];
  allowed_mentions: { parse: never[] };
} {
  return {
    flags: IS_COMPONENTS_V2,
    components: [renderApplyConfirmCV2(result, ctx)],
    allowed_mentions: { parse: [] },
  };
}
