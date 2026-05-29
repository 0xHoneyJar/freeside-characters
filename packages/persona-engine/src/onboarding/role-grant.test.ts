// role-grant.test.ts — cycle-009 sprint-4 T4.2 ACs (C6).
import { describe, test, expect } from 'bun:test';
import { grantVerifiedRole } from './role-grant.ts';

const GUILD = '777777777777777777';
const USER = '555555555555555555';
const ROLE = '999999999999999999';
const TOKEN = 'BOT-TOKEN-do-not-leak';

describe('role-grant C6', () => {
  test('204 → true, PUT to the member-roles endpoint, Bot auth, token never in URL', async () => {
    let seen: { url: string; method?: string; auth?: string } = { url: '' };
    const fetchFn = (async (url: string, init?: RequestInit) => {
      seen = { url: String(url), method: init?.method, auth: (init?.headers as Record<string, string>)?.authorization };
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const ok = await grantVerifiedRole(USER, GUILD, { botToken: TOKEN, roleId: ROLE, fetchFn });
    expect(ok).toBe(true);
    expect(seen.method).toBe('PUT');
    expect(seen.url).toBe(`https://discord.com/api/v10/guilds/${GUILD}/members/${USER}/roles/${ROLE}`);
    expect(seen.auth).toBe(`Bot ${TOKEN}`);
    expect(seen.url).not.toContain(TOKEN); // token rides in the header, never the URL
  });

  test('403 (missing perms) → false (non-fatal · FR-13 re-grant)', async () => {
    const fetchFn = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
    expect(await grantVerifiedRole(USER, GUILD, { botToken: TOKEN, roleId: ROLE, fetchFn })).toBe(false);
  });

  test('a malformed snowflake → false WITHOUT making the request (defense-in-depth)', async () => {
    let called = false;
    const fetchFn = (async () => { called = true; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
    expect(await grantVerifiedRole('not-a-snowflake', GUILD, { botToken: TOKEN, roleId: ROLE, fetchFn })).toBe(false);
    expect(called).toBe(false);
  });

  test('network throw → false (never throws into the caller)', async () => {
    const fetchFn = (async () => { throw new Error('socket'); }) as unknown as typeof fetch;
    expect(await grantVerifiedRole(USER, GUILD, { botToken: TOKEN, roleId: ROLE, fetchFn })).toBe(false);
  });
});
