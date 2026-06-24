/**
 * shadow/role-sync-result-cv2.ts — VOICELESS structural render of a
 * `GoLiveOrchestrationResult` as a Discord Components-V2 (CV2) message (bd-71y).
 *
 * ── WHY THIS, NOT discrepancy-cv2.ts ─────────────────────────────────────────
 * `discrepancy-cv2.ts` renders the substrate's `Discrepancy` read-model (a
 * before/after roster diff produced by the pure `diff`). The role-sync TRIGGER
 * invokes `runTierRoleGoLive`, which returns a `GoLiveOrchestrationResult` — the
 * assembled WriteIntentBatch (create + assign ops) + the gate's job state +
 * structural counts (created / assigned / skipped_unlinked / skipped_unqualified
 * / skipped_invalid / collapsed). That is what a CM needs to SEE after running
 * the sync: who'd get / has which role, how many, what was skipped and why. This
 * module renders THAT result structurally, reusing the EXACT CV2 grammar +
 * injection guards as discrepancy-cv2.ts.
 *
 * ── VOICELESS (the load-bearing constraint, bd-71y / voiceless-building brief) ─
 * This is a PURE render function (`GoLiveOrchestrationResult` → CV2 component
 * JSON). It holds NO persona, NO voice, NO narration, NO onboarding logic, fires
 * no events, makes no Discord call. Every string is a structural label or a
 * count. There is no persona-engine import anywhere in this module. The CM
 * controls the real messaging via config; this is the substrate-truth structural
 * render only.
 *
 * ── INJECTION GUARD (mirrors discrepancy-cv2.ts) ─────────────────────────────
 * Role NAMES (`role_key`) flow from the role-map (CM-authored or seed) AND from
 * the live roster — attacker-controllable in the general case. We reuse
 * `escapeRoleName` + clamp + `allowed_mentions: { parse: [] }` so a malicious
 * role name cannot spoof the layout or fire a mass-ping.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type { GoLiveOrchestrationResult } from "./go-live-orchestrator.ts";
import type { RoleMapSource } from "./role-sync-seed-map.ts";

/** Accent: warm honey for a SHADOW preview, applied-amber for a LIVE run. */
const ACCENT_SHADOW = 0x6f4ea1;
const ACCENT_LIVE = 0xe0a83d;

/** Max rendered role-name length before truncation (defense vs a pathological name). */
const MAX_ROLE_NAME_CHARS = 64;
/** Conservative per-text-component char budget (well under Discord's ~4000). */
const MAX_TEXT_COMPONENT_CHARS = 3500;

function clampRoleName(name: string): string {
  return name.length > MAX_ROLE_NAME_CHARS ? `${name.slice(0, MAX_ROLE_NAME_CHARS - 1)}…` : name;
}

/** Render a raw (attacker-controllable) role name → a safe inline code span. */
function codeName(raw: string): string {
  return `\`${clampRoleName(escapeRoleName(raw))}\``;
}

/**
 * Join already-rendered lines with `joiner`, stopping once the running length
 * would exceed `maxChars`, appending a `…and N more` affordance for the omitted
 * remainder. Mirrors `boundedJoin` in discrepancy-cv2.ts (a many-role guild must
 * not produce an oversized text component Discord silently rejects).
 */
function boundedJoin(items: readonly string[], joiner: string, maxChars: number, empty: string): string {
  if (items.length === 0) return empty;
  const kept: string[] = [];
  let len = 0;
  for (let i = 0; i < items.length; i++) {
    const piece = items[i]!;
    const remaining = items.length - i;
    const moreSuffix = `${joiner}…and ${remaining} more`;
    const projected = len + (kept.length ? joiner.length : 0) + piece.length;
    if (projected > maxChars && kept.length > 0) {
      return kept.join(joiner) + moreSuffix;
    }
    kept.push(piece);
    len = projected;
  }
  return kept.join(joiner);
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

/** Extra context the structural render carries beyond the orchestration result. */
export interface RoleSyncRenderContext {
  readonly world: string;
  /** provenance of the role-map: CM-authored ("config-service") vs default seed. */
  readonly mapSource: RoleMapSource;
}

/**
 * Render a `GoLiveOrchestrationResult` as a CV2 container component (the single
 * top-level component). The caller wraps it via {@link roleSyncResultCV2Payload}.
 *
 * STRUCTURAL ONLY: headings, role lists (create pass + assign pass), counts, and
 * the skip breakdown. No persona, no voice, no narration.
 */
export function renderRoleSyncResultCV2(
  result: GoLiveOrchestrationResult,
  ctx: RoleSyncRenderContext,
): ContainerComponent {
  const isLive = result.applyMode === "LIVE";
  const accent = isLive ? ACCENT_LIVE : ACCENT_SHADOW;

  // CREATE pass — managed tier roles the batch would create.
  const createOps = result.batch.ops.filter((o) => o.kind === "create_role");
  const createLines = boundedJoin(
    createOps.map((o) => `• 🆕 ${codeName(o.intent.role_key)}`),
    "\n",
    MAX_TEXT_COMPONENT_CHARS,
    "_(no roles to create)_",
  );

  // ASSIGN pass — per-role assignment counts (who'd get / has which role).
  // Aggregate assign ops by role_key → count (structural; member ids are NOT
  // rendered — only counts, the voiceless structural view).
  const assignByRole = new Map<string, number>();
  for (const o of result.batch.ops) {
    if (o.kind !== "assign_role") continue;
    const key = o.intent.role_key;
    assignByRole.set(key, (assignByRole.get(key) ?? 0) + 1);
  }
  const assignLines = boundedJoin(
    [...assignByRole.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, n]) => `• ${codeName(role)} — ${n} member${n === 1 ? "" : "s"}`),
    "\n",
    MAX_TEXT_COMPONENT_CHARS,
    "_(no members to assign)_",
  );

  // SKIP breakdown — qualified-but-unlinked / below-every-rule / invalid id /
  // collapsed duplicate members. Every count is structural provenance.
  const skipLines = [
    `• ${result.skippedUnlinked} qualified but **unlinked** (no wallet↔discord link)`,
    `• ${result.skippedUnqualified} below every rule (untiered / too low)`,
    `• ${result.skippedInvalid} invalid member id (non-snowflake)`,
    `• ${result.collapsedDuplicateMembers} duplicate wallet→member assignments collapsed`,
  ].join("\n");

  const verb = isLive ? "LIVE apply" : "SHADOW preview";
  const modeNote = isLive
    ? "_Roles were written through the gate (LIVE)._"
    : "_Preview only — ZERO writes (gate rejected every op under SHADOW)._";

  const mapNote =
    ctx.mapSource === "default-seed"
      ? "_Role-map: **DEFAULT SEED** (CM-overridable — author the real map in the dashboard / config-service)._"
      : "_Role-map: CM-authored (config-service)._";

  return {
    type: 17,
    accent_color: accent,
    components: [
      text(`# Tier→role sync — \`${ctx.world}\` (${verb})`),
      text(`${modeNote}\n${mapNote}`),
      sep,
      text(`## Roles to create (${result.createCount})\n${createLines}`),
      text(`## Assignments (${result.assignCount})\n${assignLines}`),
      sep,
      text(`## Skipped\n${skipLines}`),
      text(`Gate job: \`${result.job.status}\` · ${result.job.progress.completed}/${result.job.progress.total} applied · ${result.job.progress.failed} not-applied`),
    ],
  };
}

/** The full CV2 message payload (flags + components + inert mentions) ready to send. */
export function roleSyncResultCV2Payload(
  result: GoLiveOrchestrationResult,
  ctx: RoleSyncRenderContext,
): {
  flags: number;
  components: ContainerComponent[];
  allowed_mentions: { parse: never[] };
} {
  return {
    flags: IS_COMPONENTS_V2,
    components: [renderRoleSyncResultCV2(result, ctx)],
    // INJECTION GUARD: make every mention inert — an attacker-named role surfaced
    // in the create/assign lists cannot fire an @everyone / role / user ping.
    allowed_mentions: { parse: [] },
  };
}
