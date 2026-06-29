/**
 * ingestion/member-graph-view.ts — render the MULTI-SOURCE member graph
 * (cycle-010 S3.1/S3.2; SDD §4.5, FR-5). Maps the `MemberGraphProjection` +
 * `IngestionRunSummary` → a Components-V2 container, surfacing the NEW states the
 * single-angle roster never had: `wallet_only` (holder not in Discord),
 * `discord_member` with no holding, `unresolved`, and `attribution_quality` bands.
 *
 * The `subject.kind / attribution_quality → render` mapping is EXPLICIT and
 * shared (Flatline IMP-008/769) so CM surfaces don't diverge. A degraded run
 * renders a prominent source-freshness banner and is NEVER presented as
 * authoritative (SKP-002/780).
 *
 * VOICELESS: structural projection → components. No persona, no role mutation.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "../discrepancy-cv2.ts";
import type { IngestionRunSummary } from "./orchestrator.ts";
import type { MemberGraphProjection, ShadowSubject, SubjectKind } from "./shadow-mode-contract.ts";

const ACCENT_OK = 0x4ade80;
const ACCENT_DEGRADED = 0xfacc15;
const MAX_LINE = 1800; // bound attacker-controllable text per component

type TextComponent = { type: 10; content: string };
type SeparatorComponent = { type: 14 };
export type ContainerComponent = {
  type: 17;
  accent_color: number;
  components: Array<TextComponent | SeparatorComponent>;
};
const text = (content: string): TextComponent => ({ type: 10, content });
const sep: SeparatorComponent = { type: 14 };

/** The shared kind → display mapping (IMP-008: one source of truth for CM surfaces). */
export const KIND_DISPLAY: Record<SubjectKind, { label: string; glyph: string }> = {
  identity_user: { label: "Linked", glyph: "🔗" },
  discord_member: { label: "In Discord", glyph: "💬" },
  wallet_only: { label: "On-chain only", glyph: "⛓️" },
  unresolved: { label: "Unresolved", glyph: "⚠️" },
};

/** attribution_quality band → glyph (D1 holder-quality). */
function qualityGlyph(q: string | undefined): string {
  switch (q) {
    case "verified":
      return "✅";
    case "observed_only":
      return "👁️";
    default:
      return "·";
  }
}

export interface MemberGraphSummaryCounts {
  readonly total: number;
  readonly identity_user: number;
  readonly discord_member: number;
  readonly wallet_only: number;
  readonly unresolved: number;
}

export function summarizeGraph(projection: MemberGraphProjection): MemberGraphSummaryCounts {
  const c: MemberGraphSummaryCounts = {
    total: projection.subjects.length,
    identity_user: 0,
    discord_member: 0,
    wallet_only: 0,
    unresolved: 0,
  };
  const mut = c as { -readonly [K in keyof MemberGraphSummaryCounts]: number };
  for (const s of projection.subjects) mut[s.kind]++;
  return c;
}

/** The degraded / source-freshness banner (S3.2). Empty container line if healthy. */
export function degradedBanner(summary: IngestionRunSummary): string | null {
  if (!summary.degraded && !summary.timed_out) return null;
  const stale = Object.entries(summary.source_freshness)
    .filter(([, v]) => v === "stale")
    .map(([k]) => k);
  return [
    "⚠️ **Degraded ingestion — not authoritative.**",
    `Stale sources: ${stale.length ? stale.join(", ") : "unknown"}.`,
    "Enforcement (role apply / go-live) is suppressed until a clean run.",
  ].join("\n");
}

function subjectLine(s: ShadowSubject): string {
  const d = KIND_DISPLAY[s.kind];
  const q = qualityGlyph((s as { attribution_quality?: string }).attribution_quality);
  const who =
    s.display_name ??
    s.discord_user_id ??
    s.wallets[0]?.address ??
    s.identity_user_id ??
    s.subject_id;
  const roles = s.freeside_roles.length
    ? ` → ${s.freeside_roles.map((r) => `\`${escapeRoleName(r)}\``).join(", ")}`
    : "";
  return `${d.glyph} ${q} ${escapeRoleName(String(who)).slice(0, 64)} _(${d.label})_${roles}`;
}

function bounded(lines: string[], empty: string): string {
  if (!lines.length) return empty;
  const out: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > MAX_LINE) {
      out.push(`… +${lines.length - out.length} more`);
      break;
    }
    out.push(l);
    len += l.length + 1;
  }
  return out.join("\n");
}

/**
 * Render the multi-source graph as a CV2 container. Caller wraps:
 * `{ flags: IS_COMPONENTS_V2, components: [renderMemberGraphCV2(...)] }`.
 */
export function renderMemberGraphCV2(
  projection: MemberGraphProjection,
  summary: IngestionRunSummary,
): ContainerComponent {
  const counts = summarizeGraph(projection);
  const banner = degradedBanner(summary);
  const accent = banner ? ACCENT_DEGRADED : ACCENT_OK;

  const byKind = (k: SubjectKind) => projection.subjects.filter((s) => s.kind === k);
  const components: Array<TextComponent | SeparatorComponent> = [
    text(`# Member graph — \`${escapeRoleName(projection.community_id).slice(0, 48)}\``),
    text(
      `${counts.total} members · 🔗 ${counts.identity_user} linked · 💬 ${counts.discord_member} discord · ⛓️ ${counts.wallet_only} on-chain-only · ⚠️ ${counts.unresolved} unresolved`,
    ),
  ];
  if (banner) {
    components.push(sep, text(banner));
  }
  components.push(
    sep,
    text(`## ⛓️ On-chain holders (no Discord yet)\n${bounded(byKind("wallet_only").map(subjectLine), "_(none)_")}`),
    text(`## 🔗 Linked members\n${bounded(byKind("identity_user").map(subjectLine), "_(none)_")}`),
  );
  const unresolved = byKind("unresolved");
  if (unresolved.length) {
    components.push(
      sep,
      text(`## ⚠️ Needs CM resolution\n${bounded(unresolved.map(subjectLine), "_(none)_")}`),
    );
  }
  return { type: 17, accent_color: accent, components };
}

/** Full CV2 payload (flags + components) ready for postToChannel. */
export function memberGraphCV2Payload(
  projection: MemberGraphProjection,
  summary: IngestionRunSummary,
): { flags: number; components: ContainerComponent[] } {
  return { flags: IS_COMPONENTS_V2, components: [renderMemberGraphCV2(projection, summary)] };
}
