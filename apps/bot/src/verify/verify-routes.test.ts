// verify-routes.test.ts — cycle-009 sprint-3 T3.1/T3.2 ACs (ATK-001 · RT-7/ATK-006 · ATK-002 · IMP-009).
import { describe, test, expect, beforeAll } from 'bun:test';
import { Effect } from 'effect';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  mintToken,
  validateToken,
  consumeToken,
  issueOAuthState,
  issueSiweNonce,
  buildSiweMessage,
  type FreesideAuthClient,
} from '@freeside-characters/persona-engine/onboarding';
import { handleVerifyRoot, handleOAuthCallback, handleVerifyComplete, type VerifyRuntime } from './verify-routes.ts';

beforeAll(() => {
  process.env.ONBOARDING_STATE_SECRET = 'z'.repeat(40);
});

const DISCORD_ID = '555';
const GUILD_ID = '777';
const DOMAIN = 'verify.thj.fun';
const ORIGIN = 'https://verify.thj.fun';
const CHAIN = 80094;
const STATEMENT = 'link your wallet to your discord.';

function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}
function makeSigner() {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, false);
  const address = '0x' + toHex(keccak_256(pub.slice(1))).slice(-40);
  const sign = (message: string): string => {
    const mb = new TextEncoder().encode(message);
    const pfx = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${mb.length}`);
    const composed = new Uint8Array(pfx.length + mb.length);
    composed.set(pfx, 0);
    composed.set(mb, pfx.length);
    const sig = secp256k1.sign(keccak_256(composed), priv);
    const wire = new Uint8Array(65);
    wire.set(sig.toCompactRawBytes(), 0);
    wire[64] = sig.recovery + 27;
    return '0x' + toHex(wire);
  };
  return { address, sign };
}

const okClient = {
  link: () => Effect.succeed({ ok: true, user_id: 'u1', idempotent: false, conflict_resolved: null }),
} as unknown as FreesideAuthClient;
const failClient = {
  link: () => Effect.fail(new Error('identity-api down')),
} as unknown as FreesideAuthClient;
const reboundClient = {
  link: () => Effect.succeed({ ok: true, user_id: 'u9', idempotent: false, conflict_resolved: 'wallet_rebound' }),
} as unknown as FreesideAuthClient;

const oauthFetch = (discordId: string) =>
  (async (url: string) => {
    const u = String(url);
    if (u.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'at-1' }), { status: 200 });
    if (u.includes('/users/@me')) return new Response(JSON.stringify({ id: discordId, username: 'mibera' }), { status: 200 });
    return new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;

const runtime = (over: Partial<VerifyRuntime> = {}): VerifyRuntime => ({
  enabled: true,
  domain: DOMAIN,
  origin: ORIGIN,
  chainId: CHAIN,
  statement: STATEMENT,
  oauth: { clientId: 'cid', clientSecret: 'SECRET', redirectUri: `${ORIGIN}/verify/oauth/callback` },
  authClient: okClient,
  grantRole: async () => true,
  fetchFn: oauthFetch(DISCORD_ID),
  ...over,
});

const mkToken = () => mintToken({ discord_id: DISCORD_ID, interaction_id: 'iid', guild_id: GUILD_ID });

describe('verify-routes — GET /verify/:token', () => {
  test('valid token → 302 to discord authorize', () => {
    const res = handleVerifyRoot(mkToken(), runtime());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('discord.com/oauth2/authorize');
  });
  test('invalid token → 400', () => {
    const res = handleVerifyRoot('f'.repeat(32), runtime());
    expect(res.status).toBe(400);
  });
  test('disabled runtime → 503 (routes never leak)', () => {
    const res = handleVerifyRoot(mkToken(), runtime({ enabled: false }));
    expect(res.status).toBe(503);
  });
});

describe('verify-routes — OAuth callback (ATK-001)', () => {
  test('discord_id == token.did → serves the connect page', async () => {
    const token = mkToken();
    const state = issueOAuthState(token);
    const url = new URL(`${ORIGIN}/verify/oauth/callback?code=abc&state=${state}`);
    const res = await handleOAuthCallback(url, runtime());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('connect');
  });

  test('ATK-001 · a DIFFERENT discord user (leaked URL) → 403', async () => {
    const token = mkToken();
    const state = issueOAuthState(token);
    const url = new URL(`${ORIGIN}/verify/oauth/callback?code=abc&state=${state}`);
    const res = await handleOAuthCallback(url, runtime({ fetchFn: oauthFetch('999-stranger') }));
    expect(res.status).toBe(403);
  });

  test('a reused OAuth state → 400 (single-use · SKP-004)', async () => {
    const token = mkToken();
    const state = issueOAuthState(token);
    const url = new URL(`${ORIGIN}/verify/oauth/callback?code=abc&state=${state}`);
    expect((await handleOAuthCallback(url, runtime())).status).toBe(200);
    expect((await handleOAuthCallback(url, runtime())).status).toBe(400); // replayed state
  });
});

describe('verify-routes — POST /complete', () => {
  // build a signed /complete request for a freshly-issued nonce.
  const signedComplete = (token: string, signer: { address: string; sign: (m: string) => string }, origin = ORIGIN) => {
    const s = issueSiweNonce(token, DISCORD_ID);
    const message = buildSiweMessage({
      domain: DOMAIN,
      address: signer.address,
      statement: STATEMENT,
      uri: ORIGIN,
      chainId: CHAIN,
      nonce: s.nonce,
      issuedAt: s.issuedAt,
      expirationTime: s.expirationTime,
    });
    const req = new Request(`${ORIGIN}/verify/${token}/complete`, {
      method: 'POST',
      headers: origin ? { origin, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
      body: JSON.stringify({ address: signer.address, signature: signer.sign(message), nonce: s.nonce }),
    });
    return { req, nonce: s.nonce };
  };

  test('happy path → 200 verified, role granted, handoff claim consumed', async () => {
    const token = mkToken();
    const signer = makeSigner();
    let granted = false;
    const { req } = signedComplete(token, signer);
    const res = await handleVerifyComplete(token, req, runtime({ grantRole: async () => { granted = true; return true; } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string; role_granted: boolean };
    expect(body.ok).toBe(true);
    expect(body.status).toBe('verified');
    expect(granted).toBe(true);
    // handoff claim consumed AFTER link — a second consume returns false.
    expect(consumeToken(token)).toBe(false);
  });

  test('RT-7/ATK-006 · missing Origin → 403 (CSRF)', async () => {
    const token = mkToken();
    const { req } = signedComplete(token, makeSigner(), '');
    const res = await handleVerifyComplete(token, req, runtime());
    expect(res.status).toBe(403);
  });

  test('RT-7 · foreign Origin host → 403', async () => {
    const token = mkToken();
    const { req } = signedComplete(token, makeSigner(), 'https://evil.phish.xyz');
    const res = await handleVerifyComplete(token, req, runtime());
    expect(res.status).toBe(403);
  });

  test('ATK-002 · a replayed nonce → 400 (single-use)', async () => {
    const token = mkToken();
    const signer = makeSigner();
    const s = issueSiweNonce(token, DISCORD_ID);
    const message = buildSiweMessage({
      domain: DOMAIN, address: signer.address, statement: STATEMENT, uri: ORIGIN,
      chainId: CHAIN, nonce: s.nonce, issuedAt: s.issuedAt, expirationTime: s.expirationTime,
    });
    const mkReq = () => new Request(`${ORIGIN}/verify/${token}/complete`, {
      method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ address: signer.address, signature: signer.sign(message), nonce: s.nonce }),
    });
    expect((await handleVerifyComplete(token, mkReq(), runtime())).status).toBe(200);
    expect((await handleVerifyComplete(token, mkReq(), runtime())).status).toBe(400); // nonce already claimed
  });

  test('IMP-009 · link failure → 503 AND handoff claim NOT consumed (retryable)', async () => {
    const token = mkToken();
    const signer = makeSigner();
    const { req } = signedComplete(token, signer);
    const res = await handleVerifyComplete(token, req, runtime({ authClient: failClient }));
    expect(res.status).toBe(503);
    // pre-link failure leaves the handoff token reusable.
    expect(validateToken(token)).not.toBeNull();
    expect(consumeToken(token)).toBe(true); // still claimable (was NOT consumed)
  });

  test('FR-12 · a rebound link → pending_review, role WITHHELD (provisional)', async () => {
    const token = mkToken();
    const signer = makeSigner();
    let granted = false;
    const { req } = signedComplete(token, signer);
    const res = await handleVerifyComplete(
      token,
      req,
      runtime({ authClient: reboundClient, grantRole: async () => { granted = true; return true; } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; role_granted: boolean };
    expect(body.status).toBe('pending_review');
    expect(body.role_granted).toBe(false);
    expect(granted).toBe(false); // grant never attempted on a rebound
  });

  test('a non-wallet address → 400 (RT-2)', async () => {
    const token = mkToken();
    const req = new Request(`${ORIGIN}/verify/${token}/complete`, {
      method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ address: '0xbad', signature: '0x', nonce: 'a'.repeat(32) }),
    });
    expect((await handleVerifyComplete(token, req, runtime())).status).toBe(400);
  });
});
