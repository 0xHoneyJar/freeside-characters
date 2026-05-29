// verify-routes.ts — C4 · the Bun verify web surface (cycle-009 · sprint-3 · T3.1/T3.2).
//
// Three handlers, mounted in the bot's Bun.serve (server.ts) behind a config gate:
//   GET  /verify/:token              validate handoff token (C3) → issue OAuth state → 302 to Discord
//   GET  /verify/oauth/callback      consume state → exchange code → require discord_id == token.did
//                                    (ATK-001) → issue single-use SIWE nonce → serve connect page
//   POST /verify/:token/complete     CSRF Origin (RT-7) → claim nonce (one winner · ATK-002) → SIWE
//                                    verify (RT-1) → link (C5, idempotent) → consume handoff claim
//                                    AFTER link (IMP-009) → grant role (C6) → success
//
// The /complete transaction is NOT atomic across 5 systems; per IMP-009 it uses per-step
// compensation: a pre-link failure leaves the handoff token reusable (claim consumed only after a
// successful link); a post-link grant failure is recovered by the FR-13 re-grant on next click.

import { Effect, Exit } from 'effect';
import {
  validateToken,
  consumeToken,
  isWallet,
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordUser,
  issueOAuthState,
  consumeOAuthState,
  issueSiweNonce,
  claimSiweNonce,
  verifySiweSignature,
  type OAuthConfig,
  type FreesideAuthClient,
} from '@freeside-characters/persona-engine/onboarding';
import { connectPage, errorPage, jsonResponse } from './verify-page.ts';

export interface VerifyRuntime {
  enabled: boolean;
  domain: string; // VERIFY_DOMAIN (host only, e.g. verify.thj.fun) — RT-1
  origin: string; // VERIFY_ORIGIN (https://verify.thj.fun) — static CSRF + SIWE uri
  chainId: number; // pinned
  statement: string;
  oauth: OAuthConfig; // clientId, clientSecret (server-only), redirectUri
  authClient: FreesideAuthClient;
  /** C6 (sprint-4) — grant the verified role. Returns false on failure (FR-13 re-grant next click). */
  grantRole?: (discordId: string, guildId: string) => Promise<boolean>;
  fetchFn?: typeof fetch;
}

const TOKEN_RE = /^[0-9a-f]{32}$/;

/** GET /verify/:token — entry point. Validates the handoff token, then bounces to Discord OAuth. */
export function handleVerifyRoot(token: string, rt: VerifyRuntime): Response {
  if (!rt.enabled) return errorPage('verification is not available right now.', 503);
  if (!TOKEN_RE.test(token) || !validateToken(token)) {
    return errorPage('this verification link is invalid or has expired. start again from discord.', 400);
  }
  const state = issueOAuthState(token);
  const authorizeUrl = buildAuthorizeUrl(rt.oauth, state);
  return new Response(null, { status: 302, headers: { location: authorizeUrl, 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' } });
}

/** GET /verify/oauth/callback?code=&state= — bind the OAuth'd discord user to the token. */
export async function handleOAuthCallback(url: URL, rt: VerifyRuntime): Promise<Response> {
  if (!rt.enabled) return errorPage('verification is not available right now.', 503);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return errorPage('missing oauth parameters.', 400);

  const claimed = consumeOAuthState(state); // single-use (SKP-004)
  if (!claimed) return errorPage('this login link has expired. start again from discord.', 400);
  const handoff = validateToken(claimed.token);
  if (!handoff) return errorPage('this verification has expired. start again from discord.', 400);

  const exchanged = await exchangeCode({ ...rt.oauth, fetchFn: rt.fetchFn }, code);
  if (!exchanged.ok) return errorPage('could not complete discord login. try again from discord.', 400);
  const user = await fetchDiscordUser(exchanged.value.accessToken, rt.fetchFn);
  if (!user.ok) return errorPage('could not read your discord identity. try again from discord.', 400);

  // ATK-001 — the OAuth'd discord user MUST be the one the token was minted for. A leaked
  // verify URL signed-in by a stranger is rejected here (the discord_id binding is the gate).
  if (user.value.id !== handoff.did) {
    return errorPage('this verification link was issued for a different discord account.', 403);
  }

  const siwe = issueSiweNonce(claimed.token, handoff.did);
  return connectPage({
    token: claimed.token,
    domain: rt.domain,
    address_statement: rt.statement,
    uri: rt.origin,
    chainId: rt.chainId,
    nonce: siwe.nonce,
    issuedAt: siwe.issuedAt,
    expirationTime: siwe.expirationTime,
    username: user.value.username,
  });
}

/** RT-7 — CSRF: the request Origin (or Referer) host must equal the static VERIFY_ORIGIN host. */
function originOk(request: Request, rt: VerifyRuntime): boolean {
  const raw = request.headers.get('origin') ?? request.headers.get('referer');
  if (!raw) return false;
  try {
    return new URL(raw).host === new URL(rt.origin).host;
  } catch {
    return false;
  }
}

interface CompleteBody {
  address?: unknown;
  signature?: unknown;
  nonce?: unknown;
}

/** POST /verify/:token/complete — the verify transaction (CSRF → SIWE → link → consume → grant). */
export async function handleVerifyComplete(token: string, request: Request, rt: VerifyRuntime): Promise<Response> {
  if (!rt.enabled) return jsonResponse({ error: 'verification unavailable' }, 503);
  if (!originOk(request, rt)) return jsonResponse({ error: 'bad origin' }, 403); // RT-7 / ATK-006

  if (!TOKEN_RE.test(token)) return jsonResponse({ error: 'invalid token' }, 400);
  const handoff = validateToken(token);
  if (!handoff) return jsonResponse({ error: 'expired' }, 400);

  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    return jsonResponse({ error: 'bad body' }, 400);
  }
  const address = typeof body.address === 'string' ? body.address : '';
  const signature = typeof body.signature === 'string' ? body.signature : '';
  const nonce = typeof body.nonce === 'string' ? body.nonce : '';
  if (!isWallet(address)) return jsonResponse({ error: 'bad address' }, 400); // RT-2

  // ATK-002 — atomic single-use claim. Concurrent /complete with the same nonce → one winner;
  // a replayed nonce (already claimed / expired) → null → reject before any link side-effect.
  const session = claimSiweNonce(nonce);
  if (!session || session.token !== token || session.did !== handoff.did) {
    return jsonResponse({ error: 'invalid or used verification nonce' }, 400);
  }

  // RT-1 — reconstruct the canonical message from STATIC config + session + claimed address.
  const verdict = verifySiweSignature(
    {
      params: {
        domain: rt.domain,
        address,
        statement: rt.statement,
        uri: rt.origin,
        chainId: rt.chainId,
        nonce: session.nonce,
        issuedAt: session.issuedAt,
        expirationTime: session.expirationTime,
      },
      signature,
      claimedAddress: address,
    },
    rt.domain,
    rt.chainId,
  );
  if (!verdict.ok) return jsonResponse({ error: 'signature verification failed' }, 400);

  // ── per-step compensation transaction (IMP-009) ────────────────────────────
  // 1. link (identity-api owns idempotency; key is stable across retries).
  const linkExit = await Effect.runPromiseExit(
    rt.authClient.link({ discordId: handoff.did, walletAddress: address }, `${token}:${address.toLowerCase()}`),
  );
  if (Exit.isFailure(linkExit)) {
    // FR-14 outage — handoff claim NOT consumed → the user can retry from discord.
    return jsonResponse({ error: 'cables got crossed linking your wallet. try again in a moment.' }, 503);
  }
  const link = linkExit.value;

  // FR-12 conflict policy (full role/review handling lands in sprint-4 · C6). A rebound link is
  // provisional: link succeeds (spine write) but the role is withheld pending review.
  const conflict = link.conflict_resolved;

  // 2. consume the handoff claim AFTER a successful link (IMP-009 · pre-link failure left it reusable).
  consumeToken(token);

  // 3. grant the verified role (only when no conflict). Failure → FR-13 re-grant on next verify click.
  let roleGranted = false;
  if (!conflict && rt.grantRole) {
    roleGranted = await rt.grantRole(handoff.did, handoff.gid).catch(() => false);
  }

  return jsonResponse({
    ok: true,
    user_id: link.user_id,
    role_granted: roleGranted,
    status: conflict ? 'pending_review' : 'verified',
  });
}
