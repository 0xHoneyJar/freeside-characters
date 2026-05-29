// verify-session.ts — C4 · server-side verify-flow sessions (cycle-009 · sprint-3).
//
// Two short-lived, single-use, HMAC-protected server-side records, both under .run/ (repo rule:
// no database). Ports sietch's NonceManager single-use pattern; tightens TTL to the ≤5m T3.0
// criterion (sietch defaulted 15m).
//
//   OAuth `state`  — CSRF binding for the Discord OAuth round-trip (SKP-004). Issued at
//                    GET /verify/:token, consumed once at the callback. Binds state → handoff token.
//   SIWE nonce     — the single-use nonce in the EIP-4361 message (≤5m). Issued after OAuth
//                    proves discord_id == token.did; CLAIMED atomically at /complete so concurrent
//                    submissions yield exactly one winner (ATK-002).
//
// Single-use is enforced by an atomic mkdir claim (same O_EXCL pattern as state-token consume).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STATE_DIR = '.run/onboarding-oauth-state';
const STATE_CLAIMS = '.run/onboarding-oauth-state-claims';
const NONCE_DIR = '.run/onboarding-siwe-nonce';
const NONCE_CLAIMS = '.run/onboarding-siwe-nonce-claims';

const STATE_TTL_MS = 10 * 60 * 1000; // OAuth round-trip window
const NONCE_TTL_MS = 5 * 60 * 1000; // ≤5m (T3.0 criterion)
const ID_RE = /^[0-9a-f]{32}$/;

function secret(): string {
  const key = process.env.ONBOARDING_STATE_SECRET;
  if (!key || key.length < 32) {
    throw new Error('[verify-session] ONBOARDING_STATE_SECRET missing or <32 chars (≥32B CSPRNG required)');
  }
  return key;
}
function mac(canon: string): string {
  return createHmac('sha256', secret()).update(canon).digest('base64url');
}
function macEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b ?? '');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
/** atomic single-use claim (O_EXCL via mkdir). true exactly once per id. */
function claim(claimsDir: string, id: string): boolean {
  mkdirSync(claimsDir, { recursive: true });
  try {
    mkdirSync(join(claimsDir, id));
    return true;
  } catch {
    return false;
  }
}

// ── OAuth state ────────────────────────────────────────────────────────────

interface StateRecord {
  token: string;
  exp: number;
  mac: string;
}

/** Issue an opaque OAuth state bound to the handoff token. Returns the state id. */
export function issueOAuthState(token: string, now: number = Date.now()): string {
  const state = randomBytes(16).toString('hex');
  const exp = now + STATE_TTL_MS;
  const rec: StateRecord = { token, exp, mac: mac(`oauth:${token}:${exp}`) };
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${state}.json`), JSON.stringify(rec), { mode: 0o600 });
  return state;
}

/** Consume an OAuth state (single-use). Returns the bound token, or null on any failure. */
export function consumeOAuthState(state: string, now: number = Date.now()): { token: string } | null {
  if (!ID_RE.test(state)) return null;
  const p = join(STATE_DIR, `${state}.json`);
  if (!existsSync(p)) return null;
  let rec: StateRecord;
  try {
    rec = JSON.parse(readFileSync(p, 'utf8')) as StateRecord;
  } catch {
    return null;
  }
  if (!macEqual(mac(`oauth:${rec.token}:${rec.exp}`), rec.mac)) return null;
  if (typeof rec.exp !== 'number' || rec.exp <= now) return null;
  if (!claim(STATE_CLAIMS, state)) return null; // single-use
  return { token: rec.token };
}

// ── SIWE nonce ───────────────────────────────────────────────────────────────

export interface SiweNonceRecord {
  token: string;
  did: string; // the OAuth-verified discord_id (== token.did)
  issuedAt: string; // ISO
  expirationTime: string; // ISO, issuedAt + ≤5m
  nonce: string;
}

/** Issue a single-use SIWE nonce (≤5m) after OAuth proves discord_id == token.did. */
export function issueSiweNonce(token: string, did: string, now: number = Date.now()): SiweNonceRecord {
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date(now).toISOString();
  const expirationTime = new Date(now + NONCE_TTL_MS).toISOString();
  const canon = `siwe:${token}:${did}:${nonce}:${issuedAt}:${expirationTime}`;
  const rec = { token, did, issuedAt, expirationTime, nonce, mac: mac(canon) };
  mkdirSync(NONCE_DIR, { recursive: true });
  writeFileSync(join(NONCE_DIR, `${nonce}.json`), JSON.stringify(rec), { mode: 0o600 });
  return { token, did, issuedAt, expirationTime, nonce };
}

/**
 * Atomically CLAIM a SIWE nonce (single-use · one winner · ATK-002) and return its record.
 * Returns null if missing / tampered / expired / already claimed (replay). Call at /complete
 * BEFORE signature verification so a replayed nonce never reaches the link step.
 */
export function claimSiweNonce(nonce: string, now: number = Date.now()): SiweNonceRecord | null {
  if (!ID_RE.test(nonce)) return null;
  const p = join(NONCE_DIR, `${nonce}.json`);
  if (!existsSync(p)) return null;
  let rec: SiweNonceRecord & { mac: string };
  try {
    rec = JSON.parse(readFileSync(p, 'utf8')) as SiweNonceRecord & { mac: string };
  } catch {
    return null;
  }
  const canon = `siwe:${rec.token}:${rec.did}:${rec.nonce}:${rec.issuedAt}:${rec.expirationTime}`;
  if (!macEqual(mac(canon), rec.mac)) return null;
  if (!(Date.parse(rec.expirationTime) > now)) return null;
  if (!claim(NONCE_CLAIMS, nonce)) return null; // single-use — concurrent losers get null
  return { token: rec.token, did: rec.did, issuedAt: rec.issuedAt, expirationTime: rec.expirationTime, nonce: rec.nonce };
}
