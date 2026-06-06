// oauth.ts — C4 · Discord OAuth2 (authorization-code) helpers (cycle-009 · sprint-3 · T3.1).
//
// The verify page requires the visitor to prove they are the SAME discord user the handoff
// token was minted for (ATK-001 · SKP-004): a leaked verify URL must not let a stranger bind
// their wallet to the victim's discord. OAuth2 `identify` gives us the authenticated discord_id;
// the callback asserts it equals token.did before issuing the SIWE nonce.
//
// SECURITY: client_secret is server-only (RT-3 — never in an error/log/redirect). `state` is the
// CSRF binding (SKP-004): server-issued, single-use, bound to the handoff token. The bounded
// `identify` scope means we never request email or any write scope.

const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN = 'https://discord.com/api/oauth2/token';
const DISCORD_ME = 'https://discord.com/api/users/@me';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string; // server-only
  redirectUri: string; // static, registered in the Discord app
  fetchFn?: typeof fetch;
}

/** Build the Discord authorize URL. scope=identify only · state is the CSRF binding (SKP-004). */
export function buildAuthorizeUrl(cfg: Pick<OAuthConfig, 'clientId' | 'redirectUri'>, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    scope: 'identify',
    state,
    prompt: 'none',
  });
  return `${DISCORD_AUTHORIZE}?${q.toString()}`;
}

export type OAuthResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** Exchange an authorization code for an access token. Never surfaces client_secret (RT-3). */
export async function exchangeCode(
  cfg: OAuthConfig,
  code: string,
): Promise<OAuthResult<{ accessToken: string }>> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
    });
    const res = await doFetch(DISCORD_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return { ok: false, reason: `token_exchange_${res.status}` }; // status only — no body/secret
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) return { ok: false, reason: 'token_exchange_no_token' };
    return { ok: true, value: { accessToken: json.access_token } };
  } catch {
    return { ok: false, reason: 'token_exchange_network' };
  }
}

/** Fetch the authenticated discord user (id only matters). Token is the user's, not the bot's. */
export async function fetchDiscordUser(
  accessToken: string,
  doFetch: typeof fetch = fetch,
): Promise<OAuthResult<{ id: string; username: string }>> {
  try {
    const res = await doFetch(DISCORD_ME, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return { ok: false, reason: `me_${res.status}` };
    const json = (await res.json()) as { id?: string; username?: string };
    if (!json.id) return { ok: false, reason: 'me_no_id' };
    return { ok: true, value: { id: json.id, username: json.username ?? 'someone' } };
  } catch {
    return { ok: false, reason: 'me_network' };
  }
}
