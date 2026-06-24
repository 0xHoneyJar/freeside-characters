import { describe, expect, test } from 'bun:test';
import { renderActivityPulse, renderDigest } from './discord-render.live.ts';
import { mockDigestSnapshot } from '../mock/score-mcp.mock.ts';
import type { DeterministicEmbed } from '../domain/digest-message.ts';

describe('renderDigest · substrate/presentation boundary', () => {
  test('is pure for identical inputs', () => {
    const snapshot = mockDigestSnapshot('bear-cave');
    const augment = { header: 'quiet honey on the shelf', outro: '' };
    expect(JSON.stringify(renderDigest(snapshot, augment))).toBe(
      JSON.stringify(renderDigest(snapshot, augment)),
    );
  });

  test('voice is outside the deterministic embed', () => {
    const message = renderDigest(mockDigestSnapshot('bear-cave'), {
      header: 'this is voice',
      outro: 'still voice',
    });
    expect(message.voiceContent).toContain('this is voice');
    expect(JSON.stringify(message.truthEmbed)).not.toContain('this is voice');
    expect('description' in message.truthEmbed).toBe(false);
  });

  test('truth embed fields carry snapshot, top, and cold substrate data', () => {
    const message = renderDigest(mockDigestSnapshot('bear-cave'));
    const fieldNames = message.truthEmbed.fields.map((field) => field.name);
    expect(fieldNames).toEqual(['30d snapshot', 'top this 30d', 'cold']);
    expect(message.truthEmbed.fields[0]?.value).toContain('events');
    expect(message.truthEmbed.fields[1]?.value).toContain('factor');
    expect(message.truthEmbed.fields[2]?.value).toContain('Cold One');
  });

  test('DeterministicEmbed type rejects description at compile time', () => {
    const embed: DeterministicEmbed = { color: 0, fields: [] };
    expect(embed.color).toBe(0);
    // @ts-expect-error description is intentionally absent from the truth-zone type.
    const bad: DeterministicEmbed = { color: 0, fields: [], description: 'voice' };
    expect(bad.color).toBe(0);
  });
});

describe('renderActivityPulse · daily pulse shape', () => {
  test('renders wallet → description pairs as two-line events', () => {
    const message = renderActivityPulse({
      generatedAt: '2026-05-16T00:00:00.000Z',
      events: [
        {
          event_id: 'evt-1',
          wallet: '0x1111111111111111111111111111111111111111',
          factor_id: 'og:sets',
          factor_display_name: 'Sets',
          dimension: 'og',
          category_key: 'og',
          description: 'Completed a set',
          raw_value: 1,
          raw_value_kind: 'count',
          timestamp: '2026-05-16T00:00:00.000Z',
        },
      ],
    });
    const lines = message.content.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('0x1111…1111 → Completed a set');
    expect(lines[1]).toContain('Sets · og');
  });
});
