// freeside-auth-client.test.ts — cycle-009 sprint-1 T1.2 ACs (fixtures-mocked, no network).
import { describe, test, expect } from 'bun:test';
import { Effect, Exit } from 'effect';
import { makeFreesideAuthClient } from './freeside-auth-client.ts';

const WALLET = '0x' + 'a'.repeat(40);
const TOKEN = 'SECRET-SERVICE-TOKEN-do-not-leak';
const client = (fetchFn: typeof fetch) =>
  makeFreesideAuthClient({ baseUrl: 'https://id.test', serviceToken: TOKEN, fetchFn, maxRetries: 2 });
const run = <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromiseExit(eff);
const resp = (body: unknown, status = 200) =>
  (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('freeside-auth-client C5', () => {
  test('challenge round-trips', async () => {
    const exit = await run(client(resp({ nonce: 'n', message: 'm' })).challenge(WALLET));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.nonce).toBe('n');
  });

  test('resolveByDiscord 404 → null (the new-user path)', async () => {
    const exit = await run(client(resp('', 404)).resolveByDiscord('123'));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBeNull();
  });

  test('resolveByWallet 200 → user_id', async () => {
    const exit = await run(client(resp({ user_id: 'u1' })).resolveByWallet(WALLET));
    expect(Exit.isSuccess(exit) && (exit.value as { user_id: string } | null)?.user_id).toBe('u1');
  });

  test('link sends X-Service-Token + idempotency-key + worldSlug=mibera', async () => {
    let seen: RequestInit | undefined;
    const fetchFn = (async (_u: string, init?: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ ok: true, user_id: 'u', idempotent: false, conflict_resolved: null }), { status: 200 });
    }) as unknown as typeof fetch;
    const exit = await run(client(fetchFn).link({ discordId: 'd', walletAddress: WALLET }, 'idem-1'));
    expect(Exit.isSuccess(exit)).toBe(true);
    const h = seen!.headers as Record<string, string>;
    expect(h['x-service-token']).toBe(TOKEN);
    expect(h['idempotency-key']).toBe('idem-1');
    expect(JSON.parse(seen!.body as string).worldSlug).toBe('mibera');
  });

  test('link refuses a malformed wallet BEFORE any request (RT-2)', async () => {
    let called = false;
    const fetchFn = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    const exit = await run(client(fetchFn).link({ discordId: 'd', walletAddress: '0xbad' }, 'idem'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(called).toBe(false); // never hit the privileged write with a bad wallet
  });

  test('RT-3 · a failure NEVER leaks the service token', async () => {
    const exit = await run(client(resp('forbidden', 403)).link({ discordId: 'd', walletAddress: WALLET }, 'idem'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).not.toContain(TOKEN); // the whole failure, serialized, is token-free
  });

  test('RT-8 · bounded retry on 5xx; idempotency key constant across attempts', async () => {
    let calls = 0;
    const keys = new Set<string>();
    const fetchFn = (async (_u: string, init?: RequestInit) => {
      calls++;
      const h = init?.headers as Record<string, string> | undefined;
      if (h?.['idempotency-key']) keys.add(h['idempotency-key']);
      return new Response('err', { status: 503 });
    }) as unknown as typeof fetch;
    const exit = await run(client(fetchFn).link({ discordId: 'd', walletAddress: WALLET }, 'idem-retry'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(calls).toBe(3); // 1 initial + 2 retries (maxRetries=2)
    expect(keys.size).toBe(1); // same idempotency key every attempt → safe to retry
  });
});
