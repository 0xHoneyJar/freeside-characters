import { describe, expect, test } from 'bun:test';
import { caseById } from '../../core/canonical-cases.ts';
import { resolveVariants } from '../../core/billboard-variants.ts';
import { renderBatch } from '../../core/render-candidate.ts';
import { presentToDiscord, RATING_EMOJI } from './present.ts';
import { captureFromDiscord } from './capture.ts';
import { createDiscordAdapter } from './index.ts';
import type { VoiceAugment } from '../../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · Discord adapter — present (post + react) + capture (reactions + replies).

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const batch = () => renderBatch(caseById('owsley-all-quiet')!.build(), VOICE, resolveVariants({ fireN: 2 }), 'rlhf-disc-test');
const noSleep = async () => {};
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('discord present', () => {
  test('posts each candidate via webhook ?wait + adds 1-5 reactions to the anchor', async () => {
    const posts: string[] = [];
    let reactionPuts = 0;
    let msgSeq = 100;
    const fetchImpl = (async (url: string, init: { method?: string }) => {
      if (String(url).includes('?wait=true')) {
        posts.push('post');
        return ok({ id: String(msgSeq++), channel_id: 'chan-1' });
      }
      if (String(url).includes('/reactions/') && init.method === 'PUT') {
        reactionPuts++;
        return new Response('', { status: 204 });
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    const presented = await presentToDiscord(batch(), {
      webhookUrl: 'https://discord.test/webhook',
      botToken: 'bot-token',
      fetchImpl,
      sleepImpl: noSleep,
    });
    // 2 candidates × (anchor + voice beat + billboard beat) = 6 posts
    expect(posts.length).toBe(6);
    // anchor handle per candidate
    expect(presented.presented.length).toBe(2);
    expect(presented.presented[0]!.handle).toBeTruthy();
    expect(presented.meta?.channelId).toBe('chan-1');
    // 1-5 reactions on each of the 2 anchors = 10 PUTs
    expect(reactionPuts).toBe(2 * RATING_EMOJI.length);
  });

  test('preserves existing webhook query params (e.g. thread_id) when adding wait/with_components', async () => {
    let postedUrl = '';
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.includes('discord.test')) postedUrl = u;
      return ok({ id: '1', channel_id: 'c' });
    }) as unknown as typeof fetch;
    await presentToDiscord(batch(), { webhookUrl: 'https://discord.test/webhook?thread_id=42', fetchImpl, sleepImpl: noSleep });
    const u = new URL(postedUrl);
    expect(u.searchParams.get('thread_id')).toBe('42'); // existing param survives
    expect(u.searchParams.get('wait')).toBe('true');
    expect(u.searchParams.get('with_components')).toBe('true');
  });

  test('skips reactions when no bot token (operator reacts manually)', async () => {
    let reactionPuts = 0;
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('/reactions/')) reactionPuts++;
      return ok({ id: '1', channel_id: 'c' });
    }) as unknown as typeof fetch;
    await presentToDiscord(batch(), { webhookUrl: 'https://x/y', fetchImpl, sleepImpl: noSleep });
    expect(reactionPuts).toBe(0);
  });
});

describe('discord capture', () => {
  test('reads the operator reaction → score and the reply → why', async () => {
    const presented = {
      batchId: 'b',
      zone: 'owsley-lab',
      presented: [{ variantId: 'v1-plain', handle: 'anchor-1' }],
      meta: { channelId: 'chan-1' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) {
        // operator (op-1) reacted with 4️⃣ only; bot seeded all
        const enc4 = encodeURIComponent(RATING_EMOJI[3]!); // 4️⃣
        if (u.includes(enc4)) return ok([{ id: 'bot-99', bot: true }, { id: 'op-1' }]);
        return ok([{ id: 'bot-99', bot: true }]); // only the bot seed
      }
      if (u.includes('/messages?limit=')) {
        return ok([
          { id: 'r1', content: 'cleanest of the set', author: { id: 'op-1' }, message_reference: { message_id: 'anchor-1' } },
        ]);
      }
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;

    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'chan-1', fetchImpl });
    expect(fb.ratings.length).toBe(1);
    expect(fb.ratings[0]).toEqual({ variant: 'v1-plain', score: 4, why: 'cleanest of the set' });
  });

  test('a reply to a BEAT (not the anchor) with no reaction → why-only rating', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'bred-codeblock', handle: 'anchor-c', messageIds: ['anchor-c', 'beat-1', 'beat-2'] }],
      meta: { channelId: 'c' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) return ok([{ id: 'bot-99', bot: true }]); // only bot seed → no score
      if (u.includes('/messages?limit=')) {
        // operator replied to a BEAT (beat-2), not the anchor
        return ok([{ id: 'r9', content: 'the billboard needs better formatting', author: { id: 'op-1' }, message_reference: { message_id: 'beat-2' } }]);
      }
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'c', fetchImpl });
    expect(fb.ratings.length).toBe(1);
    expect(fb.ratings[0]!.variant).toBe('bred-codeblock');
    expect(fb.ratings[0]!.score).toBeUndefined(); // no reaction, but the why is kept
    expect(fb.ratings[0]!.why).toBe('the billboard needs better formatting');
  });

  test('retries a rate-limited reaction read instead of dropping the score (the critical fix)', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'v1-plain', handle: 'anchor-1' }], meta: { channelId: 'c' },
    };
    const enc5 = encodeURIComponent(RATING_EMOJI[4]!); // 5️⃣
    let fiveReads = 0;
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/') && u.includes(enc5)) {
        // first read is rate-limited; without retry this 429 would be swallowed as [] → score lost
        if (fiveReads++ === 0) return ok({ retry_after: 0.01 }, 429);
        return ok([{ id: 'op-1' }]); // then the operator's 5️⃣ surfaces
      }
      if (u.includes('/reactions/')) return ok([{ id: 'bot-99', bot: true }]);
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'c', fetchImpl, sleepImpl: noSleep });
    expect(fiveReads).toBe(2); // one 429 + one success → the retry happened
    expect(fb.ratings[0]!.score).toBe(5); // score survived the rate limit
  });

  test('paginates the reply scan to find a why on an older page', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'v1-plain', handle: 'anchor-1', messageIds: ['anchor-1'] }],
      meta: { channelId: 'c' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) return ok([{ id: 'bot-99', bot: true }]); // no score
      if (u.includes('/messages?limit=100&before=')) {
        // older page carries the operator's reply to the anchor
        return ok([{ id: 'old1', content: 'this is the one', author: { id: 'op-1' }, message_reference: { message_id: 'anchor-1' } }]);
      }
      if (u.includes('/messages?limit=100')) {
        // newest page = unrelated chatter (no target ref) → forces a second page
        return ok([{ id: 'n1', content: 'gm', author: { id: 'op-1' } }]);
      }
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'c', fetchImpl, sleepImpl: noSleep });
    expect(fb.ratings[0]!.why).toBe('this is the one');
  });

  test('paginates across candidates — a second candidate\'s why on an older page is not missed', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [
        { variantId: 'A', handle: 'anchor-A', messageIds: ['anchor-A'] },
        { variantId: 'B', handle: 'anchor-B', messageIds: ['anchor-B'] },
      ],
      meta: { channelId: 'c' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) return ok([{ id: 'bot-99', bot: true }]); // no scores
      if (u.includes('/messages?limit=100&before=')) {
        // older page carries B's reply — would be missed if we stopped at A's match
        return ok([{ id: 'old-B', content: 'B why', author: { id: 'op-1' }, message_reference: { message_id: 'anchor-B' } }]);
      }
      if (u.includes('/messages?limit=100')) {
        // newest page carries only A's reply → must keep paginating to capture B
        return ok([{ id: 'new-A', content: 'A why', author: { id: 'op-1' }, message_reference: { message_id: 'anchor-A' } }]);
      }
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'c', fetchImpl, sleepImpl: noSleep });
    const byVariant = Object.fromEntries(fb.ratings.map((r) => [r.variant, r.why]));
    expect(byVariant['A']).toBe('A why');
    expect(byVariant['B']).toBe('B why');
  });

  test('surfaces an auth failure (401) instead of recording empty feedback', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'v1-plain', handle: 'anchor-1' }], meta: { channelId: 'c' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) return new Response('{"message":"401: Unauthorized"}', { status: 401 });
      return new Response('[]', { status: 200 }); // history scan finds nothing
    }) as unknown as typeof fetch;
    await expect(
      captureFromDiscord(presented, { botToken: 'bad', channelId: 'c', fetchImpl, sleepImpl: noSleep }),
    ).rejects.toThrow(/unauthorized/i);
  });

  test('createDiscordAdapter.capture throws when botToken is missing (no silent empty-auth reads)', async () => {
    const adapter = createDiscordAdapter({ webhookUrl: 'https://x/y', channelId: 'c' });
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'v1-plain', handle: 'a' }], meta: { channelId: 'c' },
    };
    await expect(adapter.capture(presented)).rejects.toThrow(/botToken/);
  });

  test('candidates with no operator reaction are skipped', async () => {
    const presented = {
      batchId: 'b', zone: 'owsley-lab',
      presented: [{ variantId: 'v0-baseline', handle: 'anchor-x' }], meta: { channelId: 'c' },
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/users/@me')) return ok({ id: 'bot-99', bot: true });
      if (u.includes('/reactions/')) return ok([{ id: 'bot-99', bot: true }]); // only bot seed, no operator
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const fb = await captureFromDiscord(presented, { botToken: 't', channelId: 'c', fetchImpl });
    expect(fb.ratings.length).toBe(0);
  });
});
