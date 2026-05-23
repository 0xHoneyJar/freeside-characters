import { describe, expect, test } from 'bun:test';
import { caseById, buildSnapshot } from './canonical-cases.ts';
import { renderCandidate } from './render-candidate.ts';
import { templateToVariant, type BillboardTemplate } from './billboard-templates.ts';
import { variantById } from './billboard-variants.ts';
import { toCodeBlock, toAnsiBlock, stripCodeFence, ansiToHtml } from './billboard-surface.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · billboard surfaces (bred from operator pick: "table hard to read").

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const owsleyQuiet = () => caseById('owsley-all-quiet')!.build();

const rows: BillboardTemplate['rows'] = [
  { kind: 'metric', label: 'last 30 days', source: 'totalEvents' },
  { kind: 'metric', label: 'active wallets', source: 'activeWallets' },
];
const codeTpl: BillboardTemplate = { id: 'tc', label: 'c', note: 'n', header: 'rich', surface: 'code-block', rows };
const ansiTpl: BillboardTemplate = { id: 'ta', label: 'a', note: 'n', header: 'rich', surface: 'ansi', rows };

describe('surface formatters', () => {
  test('toCodeBlock wraps lines in a plain fence', () => {
    const out = toCodeBlock(['a', 'b']);
    expect(out.startsWith('```\n')).toBe(true);
    expect(out.endsWith('\n```')).toBe(true);
    expect(out).not.toContain('**');
  });

  test('toAnsiBlock uses the ansi fence + ESC SGR codes', () => {
    const out = toAnsiBlock(['header', 'row']);
    expect(out.startsWith('```ansi\n')).toBe(true);
    expect(out).toContain('\x1b['); // real ESC byte (Discord requires it)
  });

  test('stripCodeFence removes plain + ansi fences', () => {
    expect(stripCodeFence('```\nx\n```')).toBe('x');
    expect(stripCodeFence('```ansi\ny\n```')).toBe('y');
  });

  test('ansiToHtml turns SGR into colored spans, no stray ESC', () => {
    const html = ansiToHtml(`${'\x1b'}[1;35mTITLE${'\x1b'}[0m`);
    expect(html).toContain('<span');
    expect(html).toContain('color:#d33682'); // magenta
    expect(html).toContain('font-weight:700');
    expect(html).toContain('TITLE');
    expect(html).not.toContain('\x1b');
  });
});

describe('surface on candidates', () => {
  test('default (no surface) is bold-text and stays byte-identical to the prod two-beat', () => {
    const c = renderCandidate(owsleyQuiet(), VOICE, variantById('v0-baseline')!);
    expect(c.surface).toBe('bold-text');
    expect(c.payload.secondary!.content).toContain('**'); // bold lines
  });

  test('code-block candidate delivers a ``` block, not bold', () => {
    const c = renderCandidate(owsleyQuiet(), VOICE, templateToVariant(codeTpl));
    expect(c.surface).toBe('code-block');
    expect(c.billboard.startsWith('```')).toBe(true);
    expect(c.payload.secondary!.content).toContain('352');
    expect(c.payload.secondary!.content).not.toContain('**');
    // voice beat unchanged (stats-out-of-voice)
    expect(c.payload.content).toContain("the lab's quiet today.");
  });

  test('ansi candidate delivers a ```ansi block with ESC color codes', () => {
    const c = renderCandidate(owsleyQuiet(), VOICE, templateToVariant(ansiTpl));
    expect(c.surface).toBe('ansi');
    expect(c.billboard.startsWith('```ansi')).toBe(true);
    expect(c.billboard).toContain('\x1b[');
  });
});
