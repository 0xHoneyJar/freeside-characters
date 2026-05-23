import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { presentation } from '../../live/discord-render.live.ts';
import { caseById, buildSnapshot } from './canonical-cases.ts';
import {
  renderTemplate,
  templateToVariant,
  loadTemplates,
  appendTemplate,
  EXAMPLE_TEMPLATES,
  type BillboardTemplate,
} from './billboard-templates.ts';
import { renderCandidate } from './render-candidate.ts';
import { allVariants, resolveAllVariants } from './billboard-variants.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · the breeding substrate (declarative templates).

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const owsleyQuiet = () => caseById('owsley-all-quiet')!.build();
const owsleyActive = () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 });
const tmpDirs: string[] = [];

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'rlhf-tpl-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TPL: BillboardTemplate = {
  id: 'tpl-test',
  label: 'test',
  note: 'n',
  header: 'rich',
  rows: [
    { kind: 'metric', label: 'last 30 days', source: 'totalEvents' },
    { kind: 'metric', label: 'active wallets', source: 'activeWallets' },
    { kind: 'delta', label: 'trend', style: 'arrow', when: 'has-delta' },
  ],
};

describe('renderTemplate interpreter', () => {
  test('produces [header, ...rows] with the zone header first', () => {
    const lines = renderTemplate(owsleyQuiet(), TPL);
    expect(lines[0]).toMatch(/owsley/i);
    expect(lines.join('\n')).toContain('352');
  });

  test('has-delta rows drop when there is no delta, appear when active', () => {
    expect(renderTemplate(owsleyQuiet(), TPL).join('\n')).not.toContain('trend');
    const active = renderTemplate(owsleyActive(), TPL).join('\n');
    expect(active).toContain('trend');
    expect(active).toContain('↓13%'); // arrow style, non-alarmist
  });

  test('wallet metric row drops when activeWallets is undefined', () => {
    const noWallets = buildSnapshot({ zone: 'owsley-lab', totalEvents: 100, deltaPct: null });
    expect(renderTemplate(noWallets, TPL).join('\n')).not.toContain('active wallets');
  });

  test('sentence tokens substitute', () => {
    const sentenceTpl: BillboardTemplate = {
      id: 's', label: 's', note: 'n', header: 'plain',
      rows: [{ kind: 'sentence', text: '{events} events · {wallets} wallets · {window}d' }],
    };
    expect(renderTemplate(owsleyQuiet(), sentenceTpl).join('\n')).toContain('352 events · 15 wallets · 30d');
  });

  test('EXAMPLE_TEMPLATES render without throwing', () => {
    for (const t of EXAMPLE_TEMPLATES) expect(renderTemplate(owsleyQuiet(), t).length).toBeGreaterThan(0);
  });
});

describe('fidelity preserved for bred templates', () => {
  test('a template variant still flows through the prod two-beat (plainToPayload)', () => {
    const candidate = renderCandidate(owsleyQuiet(), VOICE, templateToVariant(TPL));
    // beat 1 = voice, beat 2 = bold billboard, separate message — identical delivery shape to prod
    expect(candidate.payload.content).toContain("the lab's quiet today.");
    expect(candidate.payload.secondary).toBeDefined();
    expect(candidate.payload.secondary!.content).toContain('**');
    // and beat 2 equals the prod mapper applied to the template's truthFields
    const prod = presentation.toMicroPayload({
      voiceContent: presentation.renderMicro(owsleyQuiet(), VOICE).voiceContent,
      truthFields: renderTemplate(owsleyQuiet(), TPL),
    });
    expect(candidate.payload).toEqual(prod);
  });
});

describe('template registry (load/append + breedable variant set)', () => {
  test('loadTemplates returns [] for a missing/malformed file', () => {
    expect(loadTemplates(join(tmp(), 'nope.json'))).toEqual([]);
  });

  test('appendTemplate persists + replaces by id; loadTemplates round-trips', () => {
    const path = join(tmp(), 'templates.json');
    expect(appendTemplate(path, TPL)).toBe(1);
    expect(appendTemplate(path, { ...TPL, label: 'updated' })).toBe(1); // replace by id
    const loaded = loadTemplates(path);
    expect(loaded.length).toBe(1);
    expect(loaded[0]!.label).toBe('updated');
  });

  test('allVariants merges code variants + bred templates; resolveAllVariants finds bred ids', () => {
    const path = join(tmp(), 'templates.json');
    appendTemplate(path, TPL);
    const all = allVariants(path);
    expect(all.some((v) => v.id === 'v0-baseline')).toBe(true);
    expect(all.some((v) => v.id === 'tpl-test')).toBe(true);
    expect(resolveAllVariants({ ids: ['tpl-test'] }, path)[0]!.id).toBe('tpl-test');
  });
});
