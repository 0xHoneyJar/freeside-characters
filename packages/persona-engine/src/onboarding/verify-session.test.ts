// verify-session.test.ts — cycle-009 · C4 single-use-per-token + session single-use (BB #138).
import { describe, test, expect, beforeAll } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { issueSiweNonce, claimSiweNonce, issueOAuthState, consumeOAuthState } from './verify-session.ts';

beforeAll(() => {
  process.env.ONBOARDING_STATE_SECRET = 'w'.repeat(40);
});
const tok = () => randomBytes(16).toString('hex');

describe('verify-session — SIWE nonce single-use per token (C4)', () => {
  test('first issue for a token returns a record; a SECOND returns null', () => {
    const t = tok();
    const first = issueSiweNonce(t, '111');
    expect(first).not.toBeNull();
    expect(first!.nonce).toMatch(/^[0-9a-f]{32}$/);
    const second = issueSiweNonce(t, '111'); // same token → refused
    expect(second).toBeNull();
  });

  test('a different token still issues (the claim is per-token)', () => {
    expect(issueSiweNonce(tok(), '222')).not.toBeNull();
  });

  test('a malformed token → null (no claim, no write)', () => {
    expect(issueSiweNonce('not-a-token', '333')).toBeNull();
  });

  test('claimSiweNonce is single-use — one winner across concurrent claims (ATK-002)', () => {
    const t = tok();
    const rec = issueSiweNonce(t, '444')!;
    const wins = [claimSiweNonce(rec.nonce), claimSiweNonce(rec.nonce), claimSiweNonce(rec.nonce)];
    expect(wins.filter(Boolean).length).toBe(1);
  });

  test('claimSiweNonce returns the bound record on the winning claim', () => {
    const t = tok();
    const rec = issueSiweNonce(t, '555')!;
    const claimed = claimSiweNonce(rec.nonce);
    expect(claimed?.token).toBe(t);
    expect(claimed?.did).toBe('555');
  });
});

describe('verify-session — OAuth state single-use (SKP-004)', () => {
  test('consume returns the token once, null on replay', () => {
    const t = tok();
    const state = issueOAuthState(t);
    expect(consumeOAuthState(state)?.token).toBe(t);
    expect(consumeOAuthState(state)).toBeNull(); // replay
  });
});
