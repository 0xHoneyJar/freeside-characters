// state-token.ts — C3 · the secure interaction→web handoff token (cycle-009 · sprint-1 · T1.1).
//
// onboarding's verify button is a custom_id interaction; the bot replies ephemerally with a
// verify URL. that URL must NOT carry a signed discord_id (RT-8/ATK-001: a leaked URL would
// bind the wrong wallet). instead the URL carries an OPAQUE random id (H-1); the real handoff
// state {discord_id, nonce, exp, iid, gid} lives server-side keyed by that id, HMAC-protected
// (H-6 · kid for rotation). single-use is enforced by an atomic O_EXCL/mkdir claim (H-2),
// consumed only AFTER a successful link (RT-5 · TOCTOU). all .run writes are per-record
// JSON-encoded with the wallet validated (RT-2 · no jsonl injection).
//
// no database (repo rule): state lives under .run/. single-instance v1 (operator-confirmed) —
// the mkdir claim is single-process-correct; a multi-instance deploy upgrades to a shared store.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS_DIR = '.run/onboarding-tokens';
const CLAIMS_DIR = '.run/onboarding-claims';
const TTL_MS = 5 * 60 * 1000; // ≤5m (H-4/H-1)
const OPAQUE_RE = /^[0-9a-f]{32}$/; // 16 bytes hex
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

/** server-side handoff state — never serialized into the URL. */
export interface HandoffState {
  did: string; // discord_id (signed, server-side — never client-supplied)
  nonce: string;
  iid: string; // interaction_id
  gid: string; // guild_id
  exp: number; // unix ms
}
interface StoredRecord extends HandoffState {
  kid: string;
  mac: string;
}

function secret(): { key: string; kid: string } {
  const key = process.env.ONBOARDING_STATE_SECRET;
  if (!key || key.length < 32) {
    throw new Error('[state-token] ONBOARDING_STATE_SECRET missing or <32 chars (≥32B CSPRNG required · H-6)');
  }
  return { key, kid: process.env.ONBOARDING_STATE_KID ?? 'k1' };
}

/**
 * MAC over an EXPLICIT field-order canonical form (C1/C10 · BB review #138).
 * Earlier this used `JSON.stringify` of an object literal — correct today (Node preserves
 * insertion order) but its integrity property silently depended on field declaration order and
 * on JS's serializer, which a refactor or a cross-language (Python/Go) audit reader would break.
 * The fixed-order `|`-joined form makes the canonical bytes independent of how the state object is
 * constructed or which runtime reads it. The fields are all server-controlled + `|`-free (Discord
 * snowflakes are digits, nonce is hex, exp is a number, kid is env alphanumeric), so the separator
 * is unambiguous. Mirrors the repo's own Loa L1 audit discipline (lib/jcs.sh).
 */
function computeMac(s: HandoffState, kid: string, key: string): string {
  const canon = `v1|${s.did}|${s.nonce}|${s.iid}|${s.gid}|${s.exp}|${kid}`;
  return createHmac('sha256', key).update(canon).digest('base64url');
}

/** mint a handoff: returns the OPAQUE id (the URL token); persists the state server-side. */
export function mintToken(
  input: { discord_id: string; interaction_id: string; guild_id: string },
  now: number = Date.now(),
): string {
  const { key, kid } = secret();
  const opaqueId = randomBytes(16).toString('hex'); // unguessable URL token (H-1)
  const state: HandoffState = {
    did: input.discord_id,
    nonce: randomBytes(16).toString('hex'),
    iid: input.interaction_id,
    gid: input.guild_id,
    exp: now + TTL_MS,
  };
  const rec: StoredRecord = { ...state, kid, mac: computeMac(state, kid, key) };
  mkdirSync(TOKENS_DIR, { recursive: true });
  writeFileSync(join(TOKENS_DIR, `${opaqueId}.json`), JSON.stringify(rec), { mode: 0o600 });
  return opaqueId;
}

/** validate (read-only — does NOT consume): MAC + expiry + shape. null on any failure. */
export function validateToken(opaqueId: string, now: number = Date.now()): HandoffState | null {
  if (!OPAQUE_RE.test(opaqueId)) return null;
  const p = join(TOKENS_DIR, `${opaqueId}.json`);
  if (!existsSync(p)) return null;
  let rec: StoredRecord;
  try {
    rec = JSON.parse(readFileSync(p, 'utf8')) as StoredRecord;
  } catch {
    return null;
  }
  const { key } = secret();
  const want = computeMac({ did: rec.did, nonce: rec.nonce, iid: rec.iid, gid: rec.gid, exp: rec.exp }, rec.kid, key);
  const a = Buffer.from(want);
  const b = Buffer.from(rec.mac ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null; // tamper
  if (typeof rec.exp !== 'number' || rec.exp <= now) return null; // expired
  return { did: rec.did, nonce: rec.nonce, iid: rec.iid, gid: rec.gid, exp: rec.exp };
}

/**
 * atomic single-use consume (H-2 · O_EXCL via mkdir — fails if the claim dir exists).
 * Call ONLY after a successful identity-api link (RT-5). Returns true exactly once per id.
 */
export function consumeToken(opaqueId: string): boolean {
  if (!OPAQUE_RE.test(opaqueId)) return false;
  mkdirSync(CLAIMS_DIR, { recursive: true });
  try {
    mkdirSync(join(CLAIMS_DIR, opaqueId)); // single-writer claim; throws EEXIST if already consumed
    return true;
  } catch {
    return false;
  }
}

/** 0x + 40 hex, nothing else (RT-2 — gates what reaches a jsonl line). */
export function isWallet(addr: string): boolean {
  return WALLET_RE.test(addr);
}

/** append a record to a .run jsonl — JSON-encoded as one line, never raw-interpolated (RT-2). */
export function appendJsonl(fileName: string, record: Record<string, unknown>): void {
  mkdirSync('.run', { recursive: true });
  writeFileSync(join('.run', fileName), JSON.stringify(record) + '\n', { flag: 'a', mode: 0o600 });
}
