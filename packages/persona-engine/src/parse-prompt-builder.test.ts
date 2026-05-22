import { describe, expect, test } from 'bun:test';
import { parsePromptBuilder } from './config.ts';

// cycle-008 T3.2 acceptance: 'canonical' ONLY on the literal string;
// everything else (unset / empty / casing / typo / whitespace) → 'legacy'.
describe('cycle-008 T3.2 · parsePromptBuilder', () => {
  test("literal 'canonical' → canonical", () => {
    expect(parsePromptBuilder('canonical')).toBe('canonical');
  });
  test("'legacy' → legacy", () => {
    expect(parsePromptBuilder('legacy')).toBe('legacy');
  });
  test('unset (undefined) → legacy (prod-safe default)', () => {
    expect(parsePromptBuilder(undefined)).toBe('legacy');
  });
  test('empty string → legacy', () => {
    expect(parsePromptBuilder('')).toBe('legacy');
  });
  test("casing 'Canonical' → legacy (literal match only)", () => {
    expect(parsePromptBuilder('Canonical')).toBe('legacy');
  });
  test("typo 'cannonical' → legacy", () => {
    expect(parsePromptBuilder('cannonical')).toBe('legacy');
  });
  test("whitespace '  canonical  ' → legacy (no trim)", () => {
    expect(parsePromptBuilder('  canonical  ')).toBe('legacy');
  });
});
