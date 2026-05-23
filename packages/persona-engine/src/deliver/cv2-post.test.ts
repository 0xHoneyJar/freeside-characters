import { describe, expect, test } from 'bun:test';
import { postComponentsV2 } from './cv2-post.ts';

// cycle-008 S9 · the shared CV2 POST helper handles Discord rate limits (BB review: the prod
// digest delivery must not throw on a 429 where the RLHF present path retries).

const noSleep = async () => {};
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('postComponentsV2', () => {
  test('returns the parsed body id on success', async () => {
    const fetchImpl = (async () => ok({ id: 'msg-1' })) as unknown as typeof fetch;
    const r = await postComponentsV2('https://x/y', { flags: 32768, components: [] }, {}, fetchImpl, noSleep);
    expect(r.id).toBe('msg-1');
  });

  test('retries a 429 (honors retry_after) instead of throwing', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return calls === 1 ? ok({ retry_after: 0.01 }, 429) : ok({ id: 'msg-2' });
    }) as unknown as typeof fetch;
    const r = await postComponentsV2('https://x/y', {}, {}, fetchImpl, noSleep);
    expect(calls).toBe(2); // one 429 + one success → retried
    expect(r.id).toBe('msg-2');
  });

  test('throws on a non-OK non-429 response (delivery failure surfaces)', async () => {
    const fetchImpl = (async () => new Response('bad', { status: 400 })) as unknown as typeof fetch;
    await expect(postComponentsV2('https://x/y', {}, {}, fetchImpl, noSleep)).rejects.toThrow(/400/);
  });

  test('throws after retries are exhausted under persistent rate limiting', async () => {
    const fetchImpl = (async () => ok({ retry_after: 0.01 }, 429)) as unknown as typeof fetch;
    await expect(postComponentsV2('https://x/y', {}, {}, fetchImpl, noSleep)).rejects.toThrow(/rate-limited after 3/);
  });

  test('merges content-type with caller headers (e.g. Bot auth)', async () => {
    let seenHeaders: Record<string, string> = {};
    const fetchImpl = (async (_url: string, init: { headers: Record<string, string> }) => {
      seenHeaders = init.headers;
      return ok({ id: 'msg-3' });
    }) as unknown as typeof fetch;
    await postComponentsV2('https://x/y', {}, { authorization: 'Bot tkn' }, fetchImpl, noSleep);
    expect(seenHeaders['content-type']).toBe('application/json');
    expect(seenHeaders.authorization).toBe('Bot tkn');
  });
});
