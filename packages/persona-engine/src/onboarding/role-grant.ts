// role-grant.ts — C6 · grant the verified Discord role (cycle-009 · sprint-4 · T4.2).
//
// PUT /guilds/{guild}/members/{user}/roles/{role} is idempotent: 204 whether or not the member
// already had the role (FR-13 re-grant is therefore safe to call any number of times). The bot
// token is server-only (never logged). A grant failure is NON-fatal: it returns false and the
// caller surfaces "restored on next click" (FR-13) rather than failing the whole verify.

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export interface RoleGrantConfig {
  botToken: string; // server-only — never logged
  roleId: string; // the @verified role id
  fetchFn?: typeof fetch;
}

const SNOWFLAKE_RE = /^[0-9]{5,25}$/;

/**
 * Idempotently grant the verified role. Returns true on success (204/200), false on any failure
 * (caller relies on FR-13 re-grant). Never throws into the caller; never logs the token.
 */
export async function grantVerifiedRole(
  discordId: string,
  guildId: string,
  cfg: RoleGrantConfig,
): Promise<boolean> {
  // validate the path components before they reach the REST URL (defense-in-depth).
  if (!SNOWFLAKE_RE.test(discordId) || !SNOWFLAKE_RE.test(guildId) || !SNOWFLAKE_RE.test(cfg.roleId)) {
    return false;
  }
  const doFetch = cfg.fetchFn ?? fetch;
  const url = `${DISCORD_API_BASE}/guilds/${guildId}/members/${discordId}/roles/${cfg.roleId}`;
  try {
    const res = await doFetch(url, {
      method: 'PUT',
      headers: {
        authorization: `Bot ${cfg.botToken}`,
        'content-type': 'application/json',
        'x-audit-log-reason': 'freeside onboarding: wallet verified',
      },
    });
    return res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}
