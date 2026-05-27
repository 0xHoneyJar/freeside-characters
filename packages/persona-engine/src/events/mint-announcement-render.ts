/**
 * mint-announcement-render.ts — DEP-2 of cluster-events-pillar v1.
 *
 * Components-V2 renderer for a single-mint enriched announcement. Mirrors
 * the shape of `buildEnrichedDigestComponentsV2` from
 * `packages/persona-engine/src/deliver/enriched-render.ts` (cycle-008 #87)
 * — same Container → TextDisplay → Section → Separator block grammar,
 * different content (one mint event instead of a zone digest).
 *
 * Build-doc reference: `cluster-events-pillar-coordinator/grimoires/loa/sprint.md` §5.
 *
 * Layout (top → bottom):
 *   Container (accent: Mibera Shadows purple)
 *     ├── Header  (## emoji collection · -# subtitle "<displayName> minted #<tokenId>")
 *     ├── Image   (Section + thumbnail) — OMITTED when imageUrl is null
 *     ├── Traits  (TextDisplay · two-column rows) — OMITTED when traits is null/empty
 *     └── Footer  (TextDisplay · "[tx](berascan link)" + chain marker)
 *
 * Failure mode posture: every section is independently optional. If image OR
 * traits are missing (inventory-api fail-soft), the announcement still ships
 * with header + footer — the canary remains visible rather than silently
 * suppressed.
 *
 * Escape rule: the only externally-sourced string in the rendered prose is
 * `displayName` (could be an identity-api nym carrying markdown chars like
 * `*` `_` `\``). Escape at the presentation boundary per the
 * chat-medium-presentation-boundary doctrine + the enriched-render.ts pattern.
 * Trait values may also carry untrusted chars; escape them too. The contract
 * `txHash` is hex-only so no escape needed; tokenId is decimal-string-only
 * (NftMintDetectedSchema enforces `^\d+$`); collection is operator-controlled
 * (derived in this lib from contract address) so no escape needed.
 */

import { escapeDiscordMarkdown } from '../deliver/sanitize.ts';

// Component type ids per the Discord API (mirrors enriched-render.ts).
const COMPONENT_TEXT_DISPLAY = 10;
const COMPONENT_CONTAINER = 17;
const COMPONENT_SEPARATOR = 14;
const SECTION_TYPE = 9;
const THUMBNAIL_TYPE = 11;

/** Mibera Shadows accent — matches the owsley-lab purple in enriched-render's ZONE_ACCENT. */
const MST_ACCENT = 0x6f4ea1;

/** Display name for the MST collection. Operator-controlled (no external input). */
const MST_DISPLAY = 'Mibera Shadow';
const MST_EMOJI = '🌒';

export interface MintTraitInput {
  trait_type: string;
  value: string;
}

export interface MintAnnouncementContext {
  /** nym OR shortened address — caller decides; never ENS. */
  displayName: string;
  /** Human-readable collection name (e.g. "Mibera Shadow"). */
  collection: string;
  /** Decimal string per NftMintDetectedSchema. */
  tokenId: string;
  /** From inventory-api metadata or null if enrichment failed. */
  imageUrl: string | null;
  /** From inventory-api metadata.attributes or null/empty if enrichment failed. */
  traits: MintTraitInput[] | null;
  /** 0x-prefixed 64-hex string. */
  txHash: string;
  /** EVM chain id. */
  chainId: number;
  /** ISO-8601 UTC timestamp from the mint payload. */
  emittedAt: string;
}

export interface MintAnnouncementOutput {
  /** Components V2 array — send with the IS_COMPONENTS_V2 flag. */
  components: unknown[];
  /** Plain-text fallback for clients without Components V2 support. */
  contentFallback: string;
}

/**
 * Mirrors `buildEnrichedDigestComponentsV2` shape for a single-mint event.
 * Pure function — no I/O, no side effects. Test-friendly.
 */
export function buildEnrichedMintAnnouncement(
  ctx: MintAnnouncementContext,
): MintAnnouncementOutput {
  const displayName = escapeDiscordMarkdown(ctx.displayName);
  // collection + emoji are operator-controlled; tokenId is decimal-only per schema.
  const headerLine = `## ${MST_EMOJI} ${ctx.collection}`;
  const subtitleLine = `-# **${displayName}** minted #${ctx.tokenId}`;

  const blocks: unknown[] = [
    { type: COMPONENT_TEXT_DISPLAY, content: `${headerLine}\n${subtitleLine}` },
  ];

  // Image section (omit if enrichment failed)
  if (ctx.imageUrl) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    blocks.push({
      type: SECTION_TYPE,
      components: [
        { type: COMPONENT_TEXT_DISPLAY, content: `-# Token #${ctx.tokenId}` },
      ],
      accessory: { type: THUMBNAIL_TYPE, media: { url: ctx.imageUrl } },
    });
  }

  // Traits section (omit if enrichment failed OR returned empty array)
  if (ctx.traits && ctx.traits.length > 0) {
    blocks.push({ type: COMPONENT_SEPARATOR });
    const traitLines = ctx.traits
      .slice(0, 6) // cap at 6 to keep the card scannable
      .map((t) => {
        const k = escapeDiscordMarkdown(t.trait_type);
        const v = escapeDiscordMarkdown(t.value);
        return `**${k}** · ${v}`;
      })
      .join('   ·   ');
    blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: `-# Traits\n${traitLines}` });
  }

  // Footer: tx link + chain marker. txHash is hex-only per schema.
  blocks.push({ type: COMPONENT_SEPARATOR });
  const txUrl = buildExplorerUrl(ctx.chainId, ctx.txHash);
  const txDisplay = `${ctx.txHash.slice(0, 6)}…${ctx.txHash.slice(-4)}`;
  const chainLabel = chainLabelFor(ctx.chainId);
  const footerLine = txUrl
    ? `-# [tx ${txDisplay}](${txUrl}) · ${chainLabel}`
    : `-# tx ${txDisplay} · ${chainLabel}`;
  blocks.push({ type: COMPONENT_TEXT_DISPLAY, content: footerLine });

  // Plain-text fallback always populated (clients without Components V2 still
  // get the core info: who, what, where).
  const fallbackParts: string[] = [
    `${MST_EMOJI} ${ctx.collection} · ${displayName} minted #${ctx.tokenId}`,
  ];
  if (ctx.imageUrl) fallbackParts.push(ctx.imageUrl);
  if (txUrl) fallbackParts.push(`tx: ${txUrl}`);
  const contentFallback = fallbackParts.join('\n');

  return {
    components: [
      {
        type: COMPONENT_CONTAINER,
        accent_color: MST_ACCENT,
        components: blocks,
      },
    ],
    contentFallback,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Explorer URL per chain. Returns null for unknown chains (footer falls back to plain text). */
function buildExplorerUrl(chainId: number, txHash: string): string | null {
  switch (chainId) {
    case 80094: // Berachain mainnet
      return `https://berascan.com/tx/${txHash}`;
    case 1: // Ethereum mainnet
      return `https://etherscan.io/tx/${txHash}`;
    case 8453: // Base
      return `https://basescan.org/tx/${txHash}`;
    default:
      return null;
  }
}

function chainLabelFor(chainId: number): string {
  switch (chainId) {
    case 80094:
      return 'Berachain';
    case 1:
      return 'Ethereum';
    case 8453:
      return 'Base';
    default:
      return `chain ${chainId}`;
  }
}

/** Exported constants for test reach-through (mirrors enriched-render's pattern). */
export const MINT_ANNOUNCEMENT_ACCENT = MST_ACCENT;
export const MINT_ANNOUNCEMENT_DISPLAY = MST_DISPLAY;
export const MINT_ANNOUNCEMENT_EMOJI = MST_EMOJI;
