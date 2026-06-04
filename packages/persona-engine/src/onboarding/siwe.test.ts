// siwe.test.ts — cycle-009 sprint-3 T3.2 ACs (the 5 SIWE criteria + RT-1 forked-host).
import { describe, test, expect } from 'bun:test';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  buildSiweMessage,
  recoverPersonalSign,
  verifySiweSignature,
  type SiweMessageParams,
} from './siwe.ts';

function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}
// A test EOA + an EIP-191 personal_sign over `message`, returned as a 0x 65-byte wire signature.
function makeSigner() {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, false);
  const address = '0x' + toHex(keccak_256(pub.slice(1))).slice(-40);
  const sign = (message: string): string => {
    const msgBytes = new TextEncoder().encode(message);
    const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
    const composed = new Uint8Array(prefix.length + msgBytes.length);
    composed.set(prefix, 0);
    composed.set(msgBytes, prefix.length);
    const digest = keccak_256(composed);
    const sig = secp256k1.sign(digest, priv);
    const wire = new Uint8Array(65);
    wire.set(sig.toCompactRawBytes(), 0);
    wire[64] = sig.recovery + 27;
    return '0x' + toHex(wire);
  };
  return { address, sign };
}

const DOMAIN = 'verify.thj.fun';
const CHAIN = 80094;
const params = (address: string, over: Partial<SiweMessageParams> = {}): SiweMessageParams => ({
  domain: DOMAIN,
  address,
  statement: 'link your wallet to your discord.',
  uri: 'https://verify.thj.fun',
  chainId: CHAIN,
  nonce: 'a'.repeat(16),
  issuedAt: '2026-05-29T12:00:00.000Z',
  expirationTime: '2026-05-29T12:05:00.000Z',
  ...over,
});
const NOW = Date.parse('2026-05-29T12:02:00.000Z'); // inside the 5m window

describe('siwe C4 — EIP-191 recovery', () => {
  test('recovers the exact signer address (round-trip)', () => {
    const { address, sign } = makeSigner();
    const msg = buildSiweMessage(params(address));
    expect(recoverPersonalSign(msg, sign(msg))).toBe(address.toLowerCase());
  });
  test('a malformed signature → null (no throw)', () => {
    expect(recoverPersonalSign('hi', '0xdeadbeef')).toBeNull();
    expect(recoverPersonalSign('hi', 'not-hex')).toBeNull();
  });
});

describe('siwe C4 — verifySiweSignature (the 5 criteria)', () => {
  test('a valid signature inside the window verifies', () => {
    const { address, sign } = makeSigner();
    const p = params(address);
    const v = verifySiweSignature(
      { params: p, signature: sign(buildSiweMessage(p)), claimedAddress: address, now: NOW },
      DOMAIN,
      CHAIN,
    );
    expect(v.ok).toBe(true);
  });

  test('expired (past expirationTime · ≤5m enforced) → rejected', () => {
    const { address, sign } = makeSigner();
    const p = params(address);
    const v = verifySiweSignature(
      { params: p, signature: sign(buildSiweMessage(p)), claimedAddress: address, now: Date.parse('2026-05-29T12:06:00.000Z') },
      DOMAIN,
      CHAIN,
    );
    expect(v).toEqual({ ok: false, reason: 'expired' });
  });

  test('RT-1 · a signature for a FORKED domain is useless (domain pin)', () => {
    const { address, sign } = makeSigner();
    // attacker's host built + signed a message with their own domain...
    const forked = params(address, { domain: 'evil.phish.xyz' });
    const sig = sign(buildSiweMessage(forked));
    // ...but our server reconstructs with ITS static domain → recovery mismatches.
    const v = verifySiweSignature(
      { params: forked, signature: sig, claimedAddress: address, now: NOW },
      DOMAIN, // our static domain ≠ forked.domain
      CHAIN,
    );
    expect(v.ok).toBe(false);
    expect(v).toEqual({ ok: false, reason: 'domain' });
  });

  test('wrong chainId → rejected (chain pin)', () => {
    const { address, sign } = makeSigner();
    const p = params(address, { chainId: 1 });
    const v = verifySiweSignature(
      { params: p, signature: sign(buildSiweMessage(p)), claimedAddress: address, now: NOW },
      DOMAIN,
      CHAIN,
    );
    expect(v).toEqual({ ok: false, reason: 'chain' });
  });

  test('signature by a DIFFERENT key → address_mismatch', () => {
    const victim = makeSigner();
    const attacker = makeSigner();
    const p = params(victim.address); // claims victim's address...
    const sig = attacker.sign(buildSiweMessage(p)); // ...but attacker signed
    const v = verifySiweSignature(
      { params: p, signature: sig, claimedAddress: victim.address, now: NOW },
      DOMAIN,
      CHAIN,
    );
    expect(v).toEqual({ ok: false, reason: 'address_mismatch' });
  });

  test('claimedAddress not matching the message address → address_mismatch', () => {
    const a = makeSigner();
    const b = makeSigner();
    const p = params(a.address);
    const v = verifySiweSignature(
      { params: p, signature: a.sign(buildSiweMessage(p)), claimedAddress: b.address, now: NOW },
      DOMAIN,
      CHAIN,
    );
    expect(v).toEqual({ ok: false, reason: 'address_mismatch' });
  });
});
