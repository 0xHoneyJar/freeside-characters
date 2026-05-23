// cycle-008 S9 (g30) · FR-40 · the RLHF iteration surface — billboard format variants.
//
// The operator's standing complaint is that the community-facing digest billboard
// reads "too raw coming from score" — `30d rolling` (jargon), `change -13%` (reads
// alarmist), `wallets warm` (jargon). The fix is NOT to hand the operator one
// "refined" version top-down (feedback-rlhf-surface-priority): it's to let them
// fan out N candidate presentations of the SAME snapshot, see them side-by-side at
// Discord fidelity, and PICK — accumulating the picks as the RLHF preference signal
// (cycle-009 judge bootstraps from them).
//
// This file is the SEED MATERIAL for that loop, not the answer. Each variant is a
// distinct *shape* (tabular-jargon · tabular-plain · sentence · minimal) so a
// side-by-side pick teaches about format, not just label wording. The operator
// extends this array — add a variant, re-run `rlhf-preview`, pick again.
//
// HARD REUSE INVARIANT: `v0-baseline` delegates entirely to the production render
// path (`presentation.renderMicro(...).truthFields`) so it is byte-identical to
// what ships — the honest reference point. Alternative variants share the same
// U+2007 FIGURE-SPACE column alignment the prod billboard uses
// (`live/discord-render.live.ts::buildSubstrateFacts`) so fidelity is preserved.

import type { DigestSnapshot } from '../../domain/digest-snapshot.ts';
import { presentation } from '../../live/discord-render.live.ts';
import { safeResolveZoneRichLabel, safeResolveZoneDisplayName } from '../../domain/zone-registry.ts';
import { alignLabelValue } from './billboard-align.ts';
import { loadTemplates, templateToVariant } from './billboard-templates.ts';
import type { BillboardSurface } from './billboard-surface.ts';

/** A candidate billboard formatting. `buildFacts` returns `[header, ...rows]` —
 *  the same `truthFields` shape `renderMicro` produces, so it flows through the
 *  unchanged `plainToPayload` two-beat delivery (beat 2 = each line bolded). */
export interface BillboardVariant {
  readonly id: string;
  /** Short human label shown on the compare surface + terminal summary. */
  readonly label: string;
  /** What this variant is exploring — the "why try it" the operator weighs. */
  readonly note: string;
  /** Discord delivery surface for the data beat. Default 'bold-text' (the prod two-beat). */
  readonly surface?: BillboardSurface;
  readonly buildFacts: (snapshot: DigestSnapshot) => ReadonlyArray<string>;
}

// FIGURE_SPACE + alignLabelValue now live in ./billboard-align.ts (shared with the
// declarative template interpreter · breaks the import cycle).

const BILLBOARD_VARIANT_LIST: BillboardVariant[] = [
  {
    id: 'v0-baseline',
    label: 'baseline · production (raw from score)',
    note: 'exactly what ships today: "30d rolling / change / wallets warm". the "too raw from score" reference point — byte-identical to prod (presentation.renderMicro).',
    buildFacts: (snapshot) => [...presentation.renderMicro(snapshot).truthFields],
  },
  {
    id: 'v1-plain',
    label: 'plain english · same shape, legible labels',
    note: 'keeps the aligned label/value billboard but drops score jargon — "30d rolling"→"last 30 days", "wallets warm"→"active wallets", delta spelled as a direction word instead of a bare signed %.',
    buildFacts: (snapshot) => {
      const header = safeResolveZoneRichLabel(snapshot.zone, 'rlhf-preview');
      const rows: Array<readonly [string, string]> = [
        ['last 30 days', String(snapshot.totalEvents)],
      ];
      if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
        const dir = snapshot.deltaPct > 0 ? 'up' : 'down';
        rows.push(['vs prior 30d', `${dir} ${Math.abs(Math.round(snapshot.deltaPct))}%`]);
      }
      if (snapshot.activeWallets !== undefined) {
        rows.push(['active wallets', String(snapshot.activeWallets)]);
      }
      return [header, ...alignLabelValue(rows)];
    },
  },
  {
    id: 'v2-narrative',
    label: 'value-first · sentence rows',
    note: 'leads with the number, the label trails as a short phrase. reads less like a dashboard, more like a caption — no column alignment, one fact per line.',
    buildFacts: (snapshot) => {
      const header = safeResolveZoneRichLabel(snapshot.zone, 'rlhf-preview');
      const lines: string[] = [`${snapshot.totalEvents} onchain events, last 30 days`];
      if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
        const dir = snapshot.deltaPct > 0 ? 'up from' : 'down from';
        lines.push(`${dir} the 30 days before`);
      }
      if (snapshot.activeWallets !== undefined) {
        lines.push(`${snapshot.activeWallets} wallets moved`);
      }
      return [header, ...lines];
    },
  },
  {
    id: 'v3-minimal',
    label: 'minimal · one-glance',
    note: 'one compact substrate line — least report-like. for when the billboard should whisper, not tabulate. the delta is folded in only when it actually moved.',
    buildFacts: (snapshot) => {
      const header = safeResolveZoneDisplayName(snapshot.zone, 'rlhf-preview');
      const parts: string[] = [`${snapshot.totalEvents} events · ${snapshot.windowDays}d`];
      if (snapshot.activeWallets !== undefined) {
        parts.push(`${snapshot.activeWallets} wallets`);
      }
      if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
        const dir = snapshot.deltaPct > 0 ? '↑' : '↓';
        parts.push(`${dir}${Math.abs(Math.round(snapshot.deltaPct))}%`);
      }
      return [header, parts.join('   ·   ')];
    },
  },
  // ── rich tier (dig 2026-05-23) — Discord-native surfaces; the text tier above is fragile.
  // buildFacts here is the TERMINAL fallback + diff content; the Discord adapter re-renders
  // these natively from the snapshot (rich-render.ts).
  {
    id: 'embed-billboard',
    label: 'rich embed · color sidebar + hero metric',
    note: "the dig's top pick: native Discord embed — status-color sidebar, big H1 hero number, footer freshness. mobile-safe, no monospace fragility.",
    surface: 'embed',
    buildFacts: (snapshot) => legibleLines(snapshot),
  },
  {
    id: 'components-v2',
    label: 'components v2 · container layout',
    note: "Discord's 2025 layout engine — Container + Section + TextDisplay. modern + structured (the IS_COMPONENTS_V2 flag disables url-previews while active).",
    surface: 'components-v2',
    buildFacts: (snapshot) => legibleLines(snapshot),
  },
];

/** Legible label/value lines (the v1-plain shape) — the terminal fallback for rich surfaces. */
function legibleLines(snapshot: DigestSnapshot): string[] {
  const header = safeResolveZoneRichLabel(snapshot.zone, 'rlhf-preview');
  const rows: Array<readonly [string, string]> = [['last 30 days', String(snapshot.totalEvents)]];
  if (snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1) {
    const dir = snapshot.deltaPct > 0 ? 'up' : 'down';
    rows.push(['vs prior 30d', `${dir} ${Math.abs(Math.round(snapshot.deltaPct))}%`]);
  }
  if (snapshot.activeWallets !== undefined) rows.push(['active wallets', String(snapshot.activeWallets)]);
  return [header, ...alignLabelValue(rows)];
}

/** All registered variants, in declared order (v0 baseline first). */
export const BILLBOARD_VARIANTS: ReadonlyArray<BillboardVariant> = BILLBOARD_VARIANT_LIST;

export function variantById(id: string): BillboardVariant | undefined {
  return BILLBOARD_VARIANTS.find((variant) => variant.id === id);
}

/**
 * Resolve which variants to fan out.
 * - `ids` (from `--variants v0-baseline,v1-plain`): exact selection, order preserved,
 *   unknown ids throw (fail loud — a typo'd variant shouldn't silently drop a candidate).
 * - `fireN` (from `--fire-n N`): the first N registered variants (always includes v0).
 * - neither: all registered variants.
 */
export function resolveVariants(spec: { ids?: ReadonlyArray<string>; fireN?: number } = {}): BillboardVariant[] {
  if (spec.ids && spec.ids.length > 0) {
    return spec.ids.map((id) => {
      const variant = variantById(id);
      if (!variant) {
        const known = BILLBOARD_VARIANTS.map((v) => v.id).join(', ');
        throw new Error(`unknown billboard variant "${id}" — known variants: ${known}`);
      }
      return variant;
    });
  }
  if (spec.fireN !== undefined) {
    if (!Number.isInteger(spec.fireN) || spec.fireN < 1) {
      throw new Error(`--fire-n must be a positive integer, got ${spec.fireN}`);
    }
    return [...BILLBOARD_VARIANTS].slice(0, spec.fireN);
  }
  return [...BILLBOARD_VARIANTS];
}

/**
 * The LIVE breedable set: the code variants (v0-v3) PLUS bred declarative templates
 * loaded fresh from `templatesPath`. The server calls this per-regenerate so a template
 * the agent breeds appears the moment the operator hits "regenerate" — no restart.
 */
export function allVariants(templatesPath?: string): BillboardVariant[] {
  const bred = templatesPath ? loadTemplates(templatesPath).map(templateToVariant) : [];
  return [...BILLBOARD_VARIANTS, ...bred];
}

/** resolveVariants over the combined code+bred set (used by the serve rebuild). */
export function resolveAllVariants(
  spec: { ids?: ReadonlyArray<string>; fireN?: number } = {},
  templatesPath?: string,
): BillboardVariant[] {
  const all = allVariants(templatesPath);
  if (spec.ids && spec.ids.length > 0) {
    return spec.ids.map((id) => {
      const variant = all.find((v) => v.id === id);
      if (!variant) {
        throw new Error(`unknown billboard variant "${id}" — known: ${all.map((v) => v.id).join(', ')}`);
      }
      return variant;
    });
  }
  if (spec.fireN !== undefined) {
    if (!Number.isInteger(spec.fireN) || spec.fireN < 1) {
      throw new Error(`--fire-n must be a positive integer, got ${spec.fireN}`);
    }
    return all.slice(0, spec.fireN);
  }
  return all;
}
