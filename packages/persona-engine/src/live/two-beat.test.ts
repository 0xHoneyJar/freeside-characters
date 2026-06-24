import { describe, expect, test } from 'bun:test';
import { renderMicro } from './discord-render.live.ts';
import { toMicroPayload, toLoreDropPayload } from './discord-webhook.live.ts';
import { mockDigestSnapshot } from '../mock/score-mcp.mock.ts';
import type { MicroMessage } from '../domain/post-messages.ts';

// cycle-008 T3.8 (cadence-honest data surface) + T3.9 (two-beat billboard).
// mockDigestSnapshot('owsley-lab') → windowDays 30, totalEvents 12, deltaPct 20,
// activeWallets 4. The owsley-lab screenshot (2026-05-22) is the canonical case.

const FIGURE_SPACE = ' ';

describe('cycle-008 T3.8 · cadence-honest data billboard', () => {
  test('window total is labeled "<N>d rolling" — never implies "since last"', () => {
    const body = renderMicro(mockDigestSnapshot('owsley-lab')).truthFields.join('\n');
    expect(body).toContain('30d rolling');
    expect(body).toContain('12');
    // honesty: no fabricated fresh-delta vocabulary while voice-memory is unwired
    expect(body.toLowerCase()).not.toContain('since last');
    // the old muddy "N events / 30d" format is gone
    expect(body).not.toContain('events / 30d');
  });

  test('first line is the zone header; data rows follow', () => {
    const { truthFields } = renderMicro(mockDigestSnapshot('owsley-lab'));
    expect(truthFields[0]).toMatch(/owsley/i);
    expect(truthFields.length).toBeGreaterThan(1);
  });

  test('wallets row present when activeWallets defined', () => {
    const body = renderMicro(mockDigestSnapshot('owsley-lab')).truthFields.join('\n');
    expect(body).toContain('wallets warm');
    expect(body).toContain('4');
  });

  test('value column aligned with U+2007 figure space (digit-width invariant)', () => {
    const body = renderMicro(mockDigestSnapshot('owsley-lab')).truthFields.join('\n');
    expect(body).toContain(FIGURE_SPACE);
  });
});

describe('cycle-008 T3.9 · two-beat delivery (voice + bold billboard)', () => {
  test('toMicroPayload splits into beat 1 (voice) + beat 2 (bold billboard)', () => {
    const message = renderMicro(mockDigestSnapshot('owsley-lab'), {
      header: "the lab's quiet today.",
      outro: "i'll keep the lamp on.",
    });
    const payload = toMicroPayload(message);
    // beat 1 = pure voice (no billboard, no bold)
    expect(payload.content).toContain("the lab's quiet today.");
    expect(payload.content).not.toContain('rolling');
    expect(payload.content).not.toContain('**');
    // beat 2 = bold billboard, a SEPARATE message
    expect(payload.secondary).toBeDefined();
    expect(payload.secondary?.content).toContain('30d rolling');
    expect(payload.secondary?.content).toContain('**');
  });

  test('each billboard line is individually bold (markdown bold spans no newlines)', () => {
    const beat2 =
      toMicroPayload(
        renderMicro(mockDigestSnapshot('owsley-lab'), { header: 'quiet', outro: '' }),
      ).secondary?.content ?? '';
    for (const line of beat2.split('\n')) {
      expect(line.startsWith('**')).toBe(true);
      expect(line.endsWith('**')).toBe(true);
    }
  });

  test('beat 2 is NOT a code block (code blocks ignore bold)', () => {
    const beat2 =
      toMicroPayload(
        renderMicro(mockDigestSnapshot('owsley-lab'), { header: 'q', outro: '' }),
      ).secondary?.content ?? '';
    expect(beat2).not.toContain('```');
  });

  test('message.content ALWAYS populated (Discord-as-Material fallback)', () => {
    const payload = toMicroPayload(
      renderMicro(mockDigestSnapshot('owsley-lab'), { header: 'q', outro: '' }),
    );
    expect(payload.content.length).toBeGreaterThan(0);
  });

  test('no-voice fallback → single message (billboard as primary, no secondary)', () => {
    const message: MicroMessage = {
      voiceContent: '',
      truthFields: ['🧪 Owsley Lab', `30d rolling${FIGURE_SPACE}12`],
    };
    const payload = toMicroPayload(message);
    expect(payload.secondary).toBeUndefined();
    expect(payload.content).toContain('**');
    expect(payload.content).toContain('30d rolling');
  });

  test('back-compat: empty plain message has no secondary, content never empty', () => {
    const payload = toMicroPayload({ voiceContent: '', truthFields: [] });
    expect(payload.secondary).toBeUndefined();
    expect(payload.content.length).toBeGreaterThan(0);
  });

  test('two-beat applies to all plain post-types (shared plainToPayload)', () => {
    // lore_drop goes through the same mapper → also two-beats
    const message = renderMicro(mockDigestSnapshot('bear-cave'), {
      header: 'from the codex',
      outro: '',
    });
    expect(toLoreDropPayload(message).secondary).toBeDefined();
  });
});
