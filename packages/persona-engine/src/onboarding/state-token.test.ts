// state-token.test.ts — cycle-009 sprint-1 T1.1 ACs (security-first).
import { describe, test, expect, beforeAll } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mintToken, validateToken, consumeToken, isWallet, appendJsonl } from './state-token.ts';

beforeAll(() => {
  process.env.ONBOARDING_STATE_SECRET = 'x'.repeat(40);
});
const TOKENS_DIR = '.run/onboarding-tokens';
const mk = () => mintToken({ discord_id: '111', interaction_id: '222', guild_id: '333' });

describe('state-token C3', () => {
  test('mint → validate round-trips · opaque URL id, server-side state (H-1)', () => {
    const id = mk();
    expect(id).toMatch(/^[0-9a-f]{32}$/); // URL token is opaque — carries NO identity
    const s = validateToken(id);
    expect(s?.did).toBe('111');
    expect(s?.iid).toBe('222');
    expect(s?.gid).toBe('333');
  });

  test('expired token rejected', () => {
    const id = mintToken({ discord_id: '1', interaction_id: '2', guild_id: '3' }, Date.now() - 10 * 60 * 1000);
    expect(validateToken(id)).toBeNull();
  });

  test('forged / malformed opaque id rejected (shape + nonexistent)', () => {
    expect(validateToken('nope')).toBeNull();
    expect(validateToken('../etc/passwd')).toBeNull(); // path-traversal shape rejected
    expect(validateToken('a'.repeat(32))).toBeNull(); // well-formed but no such record
  });

  test('tampered server-side record rejected (MAC mismatch)', () => {
    const id = mk();
    const p = join(TOKENS_DIR, `${id}.json`);
    const rec = JSON.parse(readFileSync(p, 'utf8'));
    rec.did = '999'; // swap the bound identity, keep the stale MAC
    writeFileSync(p, JSON.stringify(rec));
    expect(validateToken(id)).toBeNull();
  });

  test('consume is atomic single-use — exactly one winner (H-2)', () => {
    const id = mk();
    const results = [consumeToken(id), consumeToken(id), consumeToken(id)];
    expect(results.filter(Boolean).length).toBe(1); // first claim wins, the rest lose
  });

  test('isWallet gates the jsonl-bound value, newline-injection blocked (RT-2)', () => {
    expect(isWallet('0x' + 'a'.repeat(40))).toBe(true);
    expect(isWallet('0xnot')).toBe(false);
    expect(isWallet('0x' + 'a'.repeat(40) + '\n{"forged":true}')).toBe(false);
  });

  test('appendJsonl writes ONE JSON line — no raw interpolation (RT-2)', () => {
    const f = `test-onboarding-${process.pid}-${Math.floor(performance.now())}.jsonl`;
    appendJsonl(f, { evil: 'a\nb"c', wallet: '0x' + 'a'.repeat(40) });
    const lines = readFileSync(join('.run', f), 'utf8').trim().split('\n');
    expect(lines.length).toBe(1); // the embedded newline did NOT forge a second record
    expect(JSON.parse(lines[0]).evil).toBe('a\nb"c'); // round-trips intact
  });
});
