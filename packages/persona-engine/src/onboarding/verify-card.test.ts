// verify-card.test.ts — cycle-009 sprint-2 T2.1 ACs.
import { describe, test, expect } from 'bun:test';
import { buildVerifyCard, ONBOARD_VERIFY_CUSTOM_ID, ONBOARD_PREFIX } from './verify-card.ts';

describe('verify-card C1', () => {
  test('renders a Components V2 Container (type 17)', () => {
    const c = buildVerifyCard();
    expect(Array.isArray(c)).toBe(true);
    expect((c[0] as { type: number }).type).toBe(17);
  });

  test('the action is a custom_id button (type 2), NOT a URL button (RT-6)', () => {
    const container = buildVerifyCard()[0] as { components: Array<{ type: number; components?: unknown[] }> };
    const row = container.components.find((b) => b.type === 1) as { components: Array<Record<string, unknown>> };
    expect(row).toBeDefined();
    const button = row.components[0]!;
    expect(button.type).toBe(2); // BUTTON
    expect(button.custom_id).toBe(ONBOARD_VERIFY_CUSTOM_ID);
    expect(button.url).toBeUndefined(); // a URL button would defeat the discord_id binding
  });

  test('the custom_id lives under the reserved onboard: namespace', () => {
    expect(ONBOARD_VERIFY_CUSTOM_ID.startsWith(ONBOARD_PREFIX)).toBe(true);
  });

  test('copy is overridable (persona swaps it in sprint-5)', () => {
    const container = buildVerifyCard({ title: 'custom', buttonLabel: 'go' })[0] as {
      components: Array<{ type: number; content?: string; components?: Array<{ label?: string }> }>;
    };
    const heading = container.components.find((b) => b.type === 10)!;
    expect(heading.content).toContain('custom');
    const row = container.components.find((b) => b.type === 1)!;
    expect(row.components![0]!.label).toBe('go');
  });
});
