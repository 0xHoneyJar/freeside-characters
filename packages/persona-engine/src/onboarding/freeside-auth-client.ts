// freeside-auth-client.ts — C5 · typed client for the freeside identity-api (cycle-009 sprint-1 T1.2).
//
// Wraps the production Phase-1 endpoints (challenge / verify / link / resolve) used by the
// onboarding verify flow. Effect-TS error surface (per feedback_effect_ts_new_surfaces).
//
// SECURITY (load-bearing):
//   - RT-3: the X-Service-Token (mints arbitrary discord↔wallet spine rows) is server-only and
//     NEVER enters an error payload or log. The tagged errors carry {endpoint, status} ONLY —
//     no headers, no token, no response body.
//   - RT-8/H-8: link() takes an idempotency key so a bounded retry can't double-effect.
//   - RT-2: link() refuses a malformed wallet BEFORE the privileged write.
//
// Clean standalone module (Bridgebuilder REFRAME-2) — promotable to a shared @freeside/* package.

import { Data, Effect } from 'effect';
import { isWallet } from './state-token.ts';

// Tagged errors — payloads are allowlist-safe (RT-3: no token/headers/body ever).
export class AuthHttpError extends Data.TaggedError('AuthHttpError')<{ endpoint: string; status: number }> {}
export class AuthNetworkError extends Data.TaggedError('AuthNetworkError')<{ endpoint: string; reason: string }> {}
export class AuthDecodeError extends Data.TaggedError('AuthDecodeError')<{ endpoint: string }> {}
export class AuthInvalidInput extends Data.TaggedError('AuthInvalidInput')<{ endpoint: string; field: string }> {}
export type AuthError = AuthHttpError | AuthNetworkError | AuthDecodeError | AuthInvalidInput;

export interface FreesideAuthConfig {
  baseUrl: string;
  serviceToken: string; // server-only — never logged, never in an error
  fetchFn?: typeof fetch;
  maxRetries?: number; // bounded retry on network/5xx
}

export interface ResolveResult { user_id: string }
export interface ChallengeResult { nonce: string; message: string }
export interface VerifyResult { user_id: string; session: { token: string; expires_at: string } }
export interface LinkResult {
  ok: boolean;
  user_id: string;
  idempotent: boolean;
  conflict_resolved: 'wallet_rebound' | 'discord_rebound' | null;
}

export function makeFreesideAuthClient(cfg: FreesideAuthConfig) {
  const doFetch = cfg.fetchFn ?? fetch;
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const retries = cfg.maxRetries ?? 2;

  // retry on transient failures only (network blips + 5xx). 4xx (incl. 404) never retried.
  const isRetryable = (e: AuthError): boolean =>
    e._tag === 'AuthNetworkError' || (e._tag === 'AuthHttpError' && e.status >= 500);

  // one request → JSON T, with redacted tagged errors + bounded retry on transient failures.
  const reqJson = <T>(endpoint: string, init: RequestInit): Effect.Effect<T, AuthError> => {
    const once = Effect.tryPromise({
      try: () => doFetch(base + endpoint, init),
      catch: (e) => new AuthNetworkError({ endpoint, reason: e instanceof Error ? e.message.slice(0, 120) : 'fetch failed' }),
    }).pipe(
      Effect.flatMap((res): Effect.Effect<T, AuthError> =>
        res.ok
          ? Effect.tryPromise({ try: () => res.json() as Promise<T>, catch: () => new AuthDecodeError({ endpoint }) })
          : Effect.fail(new AuthHttpError({ endpoint, status: res.status })),
      ),
    );
    return Effect.retry(once, { times: retries, while: isRetryable });
  };

  // resolve → user_id or null (404 = not linked, the expected "new user" path).
  const resolve = (endpoint: string): Effect.Effect<ResolveResult | null, AuthError> => {
    const once = Effect.tryPromise({
      try: () => doFetch(base + endpoint, { headers: { accept: 'application/json' } }),
      catch: (e) => new AuthNetworkError({ endpoint, reason: e instanceof Error ? e.message.slice(0, 120) : 'fetch failed' }),
    }).pipe(
      Effect.flatMap((res): Effect.Effect<ResolveResult | null, AuthError> => {
        if (res.status === 404) return Effect.succeed(null);
        if (!res.ok) return Effect.fail(new AuthHttpError({ endpoint, status: res.status }));
        return Effect.tryPromise({ try: () => res.json() as Promise<ResolveResult>, catch: () => new AuthDecodeError({ endpoint }) });
      }),
    );
    return Effect.retry(once, { times: retries, while: isRetryable });
  };

  return {
    /** DEP-A · Phase-2 (may be unbuilt → may HttpError; caller falls back to resolveByWallet). */
    resolveByDiscord: (discordId: string) => resolve(`/v1/resolve/account/discord/${encodeURIComponent(discordId)}`),
    resolveByWallet: (addr: string) => resolve(`/v1/resolve/wallet/${encodeURIComponent(addr)}`),

    challenge: (walletAddress: string) =>
      reqJson<ChallengeResult>('/v1/auth/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ walletAddress, scheme: 'siwe' }),
      }),

    verify: (input: { nonce: string; signature: string; walletAddress: string }) =>
      reqJson<VerifyResult>('/v1/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...input, scheme: 'siwe' }),
      }),

    /** privileged write (X-Service-Token, server-only). Refuses a malformed wallet first (RT-2). */
    link: (input: { discordId: string; walletAddress: string }, idempotencyKey: string): Effect.Effect<LinkResult, AuthError> =>
      isWallet(input.walletAddress)
        ? reqJson<LinkResult>('/v1/link/verified-wallet', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-service-token': cfg.serviceToken,
              'idempotency-key': idempotencyKey,
            },
            body: JSON.stringify({ worldSlug: 'mibera', discordId: input.discordId, walletAddress: input.walletAddress }),
          })
        : Effect.fail(new AuthInvalidInput({ endpoint: '/v1/link/verified-wallet', field: 'walletAddress' })),
  };
}

export type FreesideAuthClient = ReturnType<typeof makeFreesideAuthClient>;
