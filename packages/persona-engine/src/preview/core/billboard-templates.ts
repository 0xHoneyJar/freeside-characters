// cycle-008 S9 (g30) · the BREEDING substrate — declarative billboard templates.
//
// A variant expressed as DATA (not code), so new candidates can be bred at runtime —
// by the agent (reading a pick's annotation and synthesizing the next generation) or by
// the operator — without a code change. Templates load from a JSON file the server
// hot-reads, so a bred template appears the moment the operator hits "regenerate".
//
// Fidelity is preserved: a template only produces `truthFields` (the billboard lines);
// those still flow through the unchanged `plainToPayload` two-beat delivery, with the
// same U+2007 figure-space alignment as the prod billboard. v0-baseline stays CODE
// (byte-identical to prod); templates are the explorable/breedable layer on top.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DigestSnapshot } from '../../domain/digest-snapshot.ts';
import { safeResolveZoneRichLabel, safeResolveZoneDisplayName } from '../../domain/zone-registry.ts';
import { alignLabelValue } from './billboard-align.ts';
import type { BillboardVariant } from './billboard-variants.ts';
import type { BillboardSurface } from './billboard-surface.ts';

export type DeltaStyle = 'signed-pct' | 'direction-word' | 'arrow' | 'omit';
export type HeaderStyle = 'rich' | 'plain' | 'none';
export type RowWhen = 'always' | 'has-delta';

export type TemplateRow =
  | { kind: 'metric'; label: string; source: 'totalEvents' | 'activeWallets'; when?: RowWhen }
  | { kind: 'delta'; label: string; style: DeltaStyle; when?: RowWhen }
  | { kind: 'sentence'; text: string; when?: RowWhen };

export interface BillboardTemplate {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly header: HeaderStyle;
  readonly rows: ReadonlyArray<TemplateRow>;
  /** Discord delivery surface for the data beat. Default 'bold-text'. */
  readonly surface?: BillboardSurface;
  /** RLHF lineage — which pick bred this template. */
  readonly bredFrom?: { batchId?: string; chosen?: string; annotation?: string; at?: string };
}

function hasDelta(snapshot: DigestSnapshot): boolean {
  return snapshot.deltaPct !== null && Math.abs(snapshot.deltaPct) >= 1;
}

function formatDelta(deltaPct: number | null, style: DeltaStyle): string {
  if (deltaPct === null || Math.abs(deltaPct) < 1 || style === 'omit') return '';
  const abs = Math.abs(Math.round(deltaPct));
  const up = deltaPct > 0;
  switch (style) {
    case 'signed-pct':
      return `${up ? '+' : '-'}${abs}%`;
    case 'direction-word':
      return `${up ? 'up' : 'down'} ${abs}%`;
    case 'arrow':
      return `${up ? '↑' : '↓'}${abs}%`;
  }
}

function substTokens(text: string, snapshot: DigestSnapshot): string {
  const abs = snapshot.deltaPct === null ? 0 : Math.abs(Math.round(snapshot.deltaPct));
  const up = (snapshot.deltaPct ?? 0) > 0;
  const dh = hasDelta(snapshot);
  return text
    .replace(/\{events\}/g, String(snapshot.totalEvents))
    .replace(/\{wallets\}/g, String(snapshot.activeWallets ?? 0))
    .replace(/\{window\}/g, String(snapshot.windowDays))
    .replace(/\{zone\}/g, safeResolveZoneDisplayName(snapshot.zone, 'rlhf-template'))
    .replace(/\{delta\}/g, dh ? `${up ? '+' : '-'}${abs}%` : '')
    .replace(/\{deltaAbs\}/g, dh ? String(abs) : '')
    .replace(/\{deltaDir\}/g, dh ? (up ? 'up' : 'down') : '')
    .replace(/\{arrow\}/g, dh ? (up ? '↑' : '↓') : '');
}

/** Interpret a template against a snapshot → billboard `truthFields` ([header, ...rows]). */
export function renderTemplate(snapshot: DigestSnapshot, template: BillboardTemplate): ReadonlyArray<string> {
  const lines: string[] = [];
  if (template.header === 'rich') lines.push(safeResolveZoneRichLabel(snapshot.zone, 'rlhf-template'));
  else if (template.header === 'plain') lines.push(safeResolveZoneDisplayName(snapshot.zone, 'rlhf-template'));

  const dh = hasDelta(snapshot);
  // Drop has-delta rows when there's no delta; drop wallet metric rows when undefined.
  const visible = template.rows.filter((row) => {
    if ((row.when ?? 'always') === 'has-delta' && !dh) return false;
    if (row.kind === 'metric' && row.source === 'activeWallets' && snapshot.activeWallets === undefined) return false;
    return true;
  });

  // metric/delta rows share one figure-space label width; sentence rows pass through.
  const alignedPairs: Array<readonly [string, string]> = [];
  const plan: Array<{ aligned: number } | { text: string }> = [];
  for (const row of visible) {
    if (row.kind === 'sentence') {
      plan.push({ text: substTokens(row.text, snapshot) });
    } else {
      const value =
        row.kind === 'metric'
          ? String(row.source === 'totalEvents' ? snapshot.totalEvents : (snapshot.activeWallets ?? 0))
          : formatDelta(snapshot.deltaPct, row.style);
      alignedPairs.push([row.label, value]);
      plan.push({ aligned: alignedPairs.length - 1 });
    }
  }
  const aligned = alignLabelValue(alignedPairs);
  for (const step of plan) lines.push('aligned' in step ? aligned[step.aligned]! : step.text);
  return lines;
}

export function templateToVariant(template: BillboardTemplate): BillboardVariant {
  return {
    id: template.id,
    label: template.label,
    note: template.note,
    surface: template.surface,
    buildFacts: (snapshot) => renderTemplate(snapshot, template),
  };
}

function isTemplate(value: unknown): value is BillboardTemplate {
  const t = value as Partial<BillboardTemplate>;
  return (
    !!t &&
    typeof t.id === 'string' &&
    typeof t.label === 'string' &&
    typeof t.note === 'string' &&
    (t.header === 'rich' || t.header === 'plain' || t.header === 'none') &&
    Array.isArray(t.rows)
  );
}

/** Load bred templates from a JSON file. Defensive: missing/malformed → []. */
export function loadTemplates(path: string): BillboardTemplate[] {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTemplate);
  } catch {
    return [];
  }
}

/** Append (or replace by id) a bred template into the JSON registry. Returns the new count. */
export function appendTemplate(path: string, template: BillboardTemplate): number {
  if (!isTemplate(template)) throw new Error(`invalid template "${(template as { id?: string })?.id ?? '?'}"`);
  const existing = loadTemplates(path).filter((t) => t.id !== template.id);
  const next = [...existing, template];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next.length;
}

/** A couple of example templates — demonstrate the form; not auto-registered. */
export const EXAMPLE_TEMPLATES: ReadonlyArray<BillboardTemplate> = [
  {
    id: 'tpl-warm',
    label: 'warm caption · community-legible',
    note: 'sentence rows, no jargon, leads with the place — reads like a caretaker checking in.',
    header: 'rich',
    rows: [
      { kind: 'sentence', text: '{events} things happened here in the last {window} days' },
      { kind: 'sentence', text: '{wallets} folks moved through', when: 'always' },
      { kind: 'sentence', text: 'a touch quieter than before', when: 'has-delta' },
    ],
  },
];
