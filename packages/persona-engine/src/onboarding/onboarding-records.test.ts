// onboarding-records.test.ts — cycle-009 sprint-4 T4.1/T4.2 ACs (RT-2/RT-3/RT-4).
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditLink, recordConflictForReview } from './onboarding-records.ts';

const WALLET = '0x' + 'a'.repeat(40);
const lastLine = (file: string): Record<string, unknown> => {
  const lines = readFileSync(join('.run', file), 'utf8').trim().split('\n');
  return JSON.parse(lines[lines.length - 1]!);
};

describe('onboarding-records — audit (RT-3)', () => {
  test('auditLink writes one line and NEVER contains a service token', () => {
    auditLink({ discordId: '111', walletAddress: WALLET, userId: 'u1', idempotent: false, conflict: null, roleGranted: true });
    const rec = lastLine('onboarding-audit.jsonl');
    expect(rec.event).toBe('link');
    expect(rec.wallet).toBe(WALLET);
    expect(rec.role_granted).toBe(true);
    // the whole serialized record carries no header/token surface.
    expect(JSON.stringify(rec)).not.toMatch(/service.?token|authorization|bearer/i);
  });

  test('RT-2 · a wallet carrying a newline is recorded as "invalid", not a forged second line', () => {
    const before = readFileSync(join('.run', 'onboarding-audit.jsonl'), 'utf8').trim().split('\n').length;
    auditLink({ discordId: '222', walletAddress: WALLET + '\n{"forged":true}', userId: 'u2', idempotent: false, conflict: null, roleGranted: false });
    const after = readFileSync(join('.run', 'onboarding-audit.jsonl'), 'utf8').trim().split('\n');
    expect(after.length).toBe(before + 1); // exactly one new line
    expect(lastLine('onboarding-audit.jsonl').wallet).toBe('invalid');
  });
});

describe('onboarding-records — conflict review (RT-4 · FR-12)', () => {
  test('recordConflictForReview queues a pending_review entry', () => {
    recordConflictForReview({ discordId: '333', walletAddress: WALLET, userId: 'u3', conflict: 'wallet_rebound' });
    const rec = lastLine('onboarding-review.jsonl');
    expect(rec.status).toBe('pending_review');
    expect(rec.conflict).toBe('wallet_rebound');
    expect(rec.discord_id).toBe('333');
  });
});
