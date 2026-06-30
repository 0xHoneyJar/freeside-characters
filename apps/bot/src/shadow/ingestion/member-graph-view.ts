/**
 * ingestion/member-graph-view.ts — render the MULTI-SOURCE member graph
 * (cycle-010 S3.1/S3.2 + UX pass; SDD §4.5, FR-5). Maps the `MemberGraphProjection`
 * + `IngestionRunSummary` → a Components-V2 container.
 *
 * UX (operator feedback 2026-06-29): a tight SUMMARY card, not a wall of raw
 * addresses — truncated wallets, a bounded sample, the linked members, a
 * "verify to link your Discord" resolve-CTA, and a **Dashboard link button**
 * (the fuller browse/paginate experience lives on the web; the Discord card is
 * the summary + CTA). The `subject.kind / attribution_quality → render` mapping
 * is shared (Flatline IMP-008). A degraded run renders a not-authoritative banner.
 *
 * In-Discord Prev/Next pagination is deferred until the interactions endpoint is
 * stood up (DISCORD_PUBLIC_KEY) — the renderer already supports a `page`/`pageSize`
 * window so it lights up without a rewrite. VOICELESS.
 */
import { escapeRoleName, IS_COMPONENTS_V2 } from "../discrepancy-cv2.ts";
import type { IngestionRunSummary } from "./orchestrator.ts";
import type { MemberGraphProjection, ShadowSubject, SubjectKind } from "./shadow-mode-contract.ts";

const ACCENT_OK = 0x4ade80;
const ACCENT_DEGRADED = 0xfacc15;
const BUTTON_LINK = 5; // Discord ButtonStyle.Link (native URL open — no interaction endpoint needed)

type TextComponent = { type: 10; content: string };
type SeparatorComponent = { type: 14 };
type LinkButton = { type: 2; style: 5; label: string; url: string };
type ActionRow = { type: 1; components: LinkButton[] };
export type ContainerComponent = {
  type: 17;
  accent_color: number;
  components: Array<TextComponent | SeparatorComponent | ActionRow>;
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

const nf = (n: number): string => n.toLocaleString("en-US");
/** Truncate a wallet/address for legibility: 0x4567…3da3 / base58 head…tail. */
function shortAddr(a: string): string {
  const s = escapeRoleName(a);
  return s.length <= 14 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export interface MemberGraphSummaryCounts {
  readonly total: number;
  readonly identity_user: number;
  readonly discord_member: number;
  readonly wallet_only: number;
  readonly unresolved: number;
}

export function summarizeGraph(projection: MemberGraphProjection): MemberGraphSummaryCounts {
  const c = { total: projection.subjects.length, identity_user: 0, discord_member: 0, wallet_only: 0, unresolved: 0 };
  for (const s of projection.subjects) (c as Record<SubjectKind, number>)[s.kind]++;
  return c;
}

/** The degraded / source-freshness banner (S3.2). Null if healthy. */
export function degradedBanner(summary: IngestionRunSummary): string | null {
  if (!summary.degraded && !summary.timed_out) return null;
  const stale = Object.entries(summary.source_freshness).filter(([, v]) => v === "stale").map(([k]) => k);
  return `⚠️ **Degraded ingestion — not authoritative.** Stale: ${stale.join(", ") || "unknown"}. Enforcement suppressed until a clean run.`;
}

export interface MemberGraphRenderOptions {
  /** Freeside dashboard base URL → renders the "Open Dashboard" link button. */
  readonly dashboardUrl?: string;
  /** how many holders to sample in the card (default 10; the rest live on the dashboard). */
  readonly sampleSize?: number;
  /** whether the discord roster was actually fetched (else don't show a misleading "0 discord"). */
  readonly rosterFetched?: boolean;
}

function subjectLabel(s: ShadowSubject): string {
  const wallet = s.wallets[0]?.address;
  const who = s.discord_user_id ? `<@${s.discord_user_id}>` : wallet ? `\`${shortAddr(wallet)}\`` : s.subject_id;
  const roles = s.freeside_roles.length
    ? ` → ${s.freeside_roles.map((r) => `\`${escapeRoleName(r)}\``).join(", ")}`
    : "";
  return `${who}${roles}`;
}

/**
 * Render the multi-source graph as a tight CV2 summary card. Caller wraps via
 * {@link memberGraphCV2Payload}.
 */
export function renderMemberGraphCV2(
  projection: MemberGraphProjection,
  summary: IngestionRunSummary,
  opts: MemberGraphRenderOptions = {},
): ContainerComponent {
  const c = summarizeGraph(projection);
  const banner = degradedBanner(summary);
  const sampleSize = opts.sampleSize ?? 10;
  const linkedTotal = c.identity_user;
  const unlinkedHolders = c.wallet_only;

  const title = escapeRoleName(projection.community_id);
  const components: ContainerComponent["components"] = [text(`# ${title} — member graph`)];

  // Summary line — holders / linked / not-yet-linked. Only mention discord
  // membership when the roster was actually read (else "0 discord" misleads).
  const parts = [`**${nf(c.wallet_only + c.identity_user)}** holders`, `🔗 **${nf(linkedTotal)}** linked`];
  if (opts.rosterFetched) parts.push(`💬 **${nf(c.discord_member)}** in Discord`);
  parts.push(`**${nf(unlinkedHolders)}** not yet linked`);
  if (c.unresolved) parts.push(`⚠️ ${nf(c.unresolved)} unresolved`);
  components.push(text(parts.join(" · ")));
  components.push(text("-# shadow preview · read-only · no roles changed"));
  if (banner) components.push(sep, text(banner));

  // Linked members (the reconciled ones — the win).
  const linked = projection.subjects.filter((s) => s.kind === "identity_user");
  if (linked.length) {
    components.push(sep, text(`## 🔗 Linked (${nf(linked.length)})`));
    components.push(text(linked.slice(0, sampleSize).map((s) => `• ${subjectLabel(s)}`).join("\n")));
  }

  // On-chain holders — a BOUNDED sample (truncated), not the full wall.
  const holders = projection.subjects.filter((s) => s.kind === "wallet_only");
  if (holders.length) {
    components.push(sep, text(`## ⛓️ On-chain holders — showing ${Math.min(sampleSize, holders.length)} of ${nf(holders.length)}`));
    components.push(text(holders.slice(0, sampleSize).map((s) => `• \`${shortAddr(s.wallets[0]?.address ?? s.subject_id)}\``).join("\n")));
  }

  // Resolve-CTA — the path for unlinked holders (re-verify), + the dashboard link.
  components.push(sep);
  components.push(
    text(
      `-# Hold the collection but don't see your roles? **Verify your wallet** to link Discord — and open the dashboard for the full graph.`,
    ),
  );
  if (opts.dashboardUrl) {
    const base = opts.dashboardUrl.replace(/\/+$/, "");
    components.push({
      type: 1,
      components: [
        { type: 2, style: BUTTON_LINK, label: "Open Freeside Dashboard", url: `${base}/${encodeURIComponent(projection.community_id)}` },
        { type: 2, style: BUTTON_LINK, label: "Verify wallet", url: `${base}/${encodeURIComponent(projection.community_id)}/verify` },
      ],
    });
  }

  return { type: 17, accent_color: banner ? ACCENT_DEGRADED : ACCENT_OK, components };
}

/** Full CV2 payload (flags + components) ready for postToChannel. */
export function memberGraphCV2Payload(
  projection: MemberGraphProjection,
  summary: IngestionRunSummary,
  opts: MemberGraphRenderOptions = {},
): { flags: number; components: ContainerComponent[] } {
  return { flags: IS_COMPONENTS_V2, components: [renderMemberGraphCV2(projection, summary, opts)] };
}
