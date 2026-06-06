// siwe.ts — C4 crypto core · EIP-4361 (Sign-In with Ethereum) message + EIP-191 recovery
// (cycle-009 · sprint-3 · T3.2). Dependency-light: @noble/curves (secp256k1 recovery) +
// @noble/hashes (keccak256) — the same primitives viem wraps. No viem/siwe dep added.
//
// T3.0 audit (sietch verify.routes.ts) verdict: sietch uses EIP-191 personal_sign over a
// custom template (good ops security: single-use nonce, Origin CSRF, constant-time) but does
// NOT meet the strict SIWE criteria — no chainId pin, no domain-in-message, 15m TTL, no
// EIP-4361 structure. Per the T3.0 gate ("a gap BLOCKS the fork"), we build fresh here with
// proper EIP-4361 and port sietch's validated ops patterns at the route layer.
//
// SECURITY MODEL (RT-1 · forked-host replay defense): the SERVER owns domain + chainId + uri
// (static config) and the nonce + issuedAt + expirationTime (server-issued, single-use, ≤5m).
// The canonical message is RECONSTRUCTED server-side from those + the claimed address, then we
// require recover(reconstructed, signature) === claimedAddress. A client that tampers ANY field
// signs a different message → recovery yields a different address → reject. domain/chainId come
// from server config, so a signature minted on a forked host (different domain) is useless here.

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) throw new Error('bad hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

/** EIP-191 personal_sign digest: keccak256("\x19Ethereum Signed Message:\n" + len + message). */
function personalSignDigest(message: string): Uint8Array {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const composed = new Uint8Array(prefix.length + msgBytes.length);
  composed.set(prefix, 0);
  composed.set(msgBytes, prefix.length);
  return keccak_256(composed);
}

/**
 * Recover the signer address (lowercase 0x) from an EIP-191 personal_sign signature.
 * Returns null on any malformed input or recovery failure (never throws into callers).
 */
export function recoverPersonalSign(message: string, signature: string): string | null {
  try {
    const sig = hexToBytes(signature);
    if (sig.length !== 65) return null; // r(32) + s(32) + v(1)
    let v = sig[64]!;
    if (v >= 27) v -= 27; // normalize EIP-155/legacy v → recovery bit {0,1}
    if (v !== 0 && v !== 1) return null;
    const recovered = secp256k1.Signature.fromCompact(sig.slice(0, 64))
      .addRecoveryBit(v)
      .recoverPublicKey(personalSignDigest(message));
    const pub = recovered.toRawBytes(false); // 65 bytes, 0x04 prefix
    const addr = bytesToHex(keccak_256(pub.slice(1))).slice(-40);
    return '0x' + addr;
  } catch {
    return null;
  }
}

export interface SiweMessageParams {
  domain: string; // static VERIFY_DOMAIN (e.g. verify.thj.fun) — RT-1
  address: string; // EIP-55-or-lowercase wallet
  statement: string;
  uri: string; // static VERIFY_ORIGIN
  chainId: number; // pinned
  nonce: string; // server-issued, single-use
  issuedAt: string; // ISO 8601
  expirationTime: string; // ISO 8601, ≤5m after issuedAt
}

/** Build the canonical EIP-4361 message. Byte-stable — the page JS must reproduce it exactly. */
export function buildSiweMessage(p: SiweMessageParams): string {
  return (
    `${p.domain} wants you to sign in with your Ethereum account:\n` +
    `${p.address}\n\n` +
    `${p.statement}\n\n` +
    `URI: ${p.uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${p.chainId}\n` +
    `Nonce: ${p.nonce}\n` +
    `Issued At: ${p.issuedAt}\n` +
    `Expiration Time: ${p.expirationTime}`
  );
}

export interface SiweVerifyInput {
  params: SiweMessageParams; // server-reconstructed (static config + session + claimed address)
  signature: string;
  /** the address the user claims to be linking (must match params.address + the recovered signer). */
  claimedAddress: string;
  now?: number;
}

export type SiweVerdict =
  | { ok: true; address: string }
  | { ok: false; reason: 'address_mismatch' | 'expired' | 'malformed' | 'domain' | 'chain' };

/**
 * Verify a SIWE signature against the server-reconstructed message. Enforces (with the
 * route/session layer) all five T3.0 criteria: single-use nonce + ≤5m expiry (session) ·
 * domain + chainId pin (static params) · EIP-4361 structure (buildSiweMessage).
 *
 * @param staticDomain  the server's VERIFY_DOMAIN — params.domain MUST equal it (RT-1).
 * @param pinnedChainId the server's CHAIN_ID — params.chainId MUST equal it.
 */
export function verifySiweSignature(
  input: SiweVerifyInput,
  staticDomain: string,
  pinnedChainId: number,
): SiweVerdict {
  const now = input.now ?? Date.now();
  // domain + chainId are RECONSTRUCTED from server config, but assert anyway (defense-in-depth).
  if (input.params.domain !== staticDomain) return { ok: false, reason: 'domain' };
  if (input.params.chainId !== pinnedChainId) return { ok: false, reason: 'chain' };

  const exp = Date.parse(input.params.expirationTime);
  const iat = Date.parse(input.params.issuedAt);
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) return { ok: false, reason: 'malformed' };
  if (now >= exp) return { ok: false, reason: 'expired' };

  const message = buildSiweMessage(input.params);
  const recovered = recoverPersonalSign(message, input.signature);
  if (!recovered) return { ok: false, reason: 'malformed' };

  const claimed = input.claimedAddress.toLowerCase();
  if (recovered !== claimed || input.params.address.toLowerCase() !== claimed) {
    return { ok: false, reason: 'address_mismatch' };
  }
  return { ok: true, address: recovered };
}
