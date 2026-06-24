// cycle-008 S9 (g30) · Discord adapter · PRESENT — post candidates + attach 1-5 reactions.
//
// Posts each candidate to the test channel via webhook (ruggy Pattern-B identity, ?wait=true
// so we capture message IDs), then — via bot REST — adds 1️⃣–5️⃣ reaction affordances to each
// candidate's ANCHOR message (the label) so the operator rates by clicking. The anchor's
// message id is the handle the capture phase reads reactions + replies from.
//
// Discord IS the surface (operator directive 2026-05-23): a browser mock can't be pixel-
// perfect (gg sans legal moat + Blink/Yoga divergence · the dig), so candidates are judged
// in the real client.

import type { RenderBatch, Candidate } from '../../core/render-candidate.ts';
import type { PresentedBatch, PresentedCandidate } from '../../ports/medium-adapter.ts';
import type { DigestSnapshot } from '../../../domain/digest-snapshot.ts';
import { buildBillboardEmbed, buildBillboardComponentsV2, IS_COMPONENTS_V2 } from './rich-render.ts';

type PostBody = { content?: string; embeds?: unknown[]; flags?: number; components?: unknown[] };

/** The data beat (beat 2), rendered per the candidate's Discord surface. */
function dataBeatBody(candidate: Candidate, snapshot: DigestSnapshot): PostBody {
  switch (candidate.surface) {
    case 'embed':
      return { embeds: [buildBillboardEmbed(snapshot)] };
    case 'components-v2':
      // gallery items carry their own layout; the billboard uses the default builder.
      return {
        flags: IS_COMPONENTS_V2,
        components: [...(candidate.componentsV2Override ?? buildBillboardComponentsV2(snapshot))],
      };
    default:
      // text tier (bold-text / code-block / ansi) — the rendered billboard string
      return { content: candidate.payload.secondary?.content ?? candidate.billboard };
  }
}

/** Canonical staging avatar (apps/character-ruggy/character.json::webhookAvatarUrl). */
export const RUGGY_AVATAR_URL =
  'https://raw.githubusercontent.com/0xHoneyJar/freeside-characters/staging/apps/character-ruggy/avatar.png';

/** 1-5 keycap emojis — the cardinal rating affordance. */
export const RATING_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'] as const;

export interface DiscordPresentConfig {
  readonly webhookUrl: string;
  /** Bot token — required to add the 1-5 reaction affordances (webhooks can't react). */
  readonly botToken?: string;
  readonly username?: string;
  readonly avatarUrl?: string;
  readonly delayMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DISCORD_API = 'https://discord.com/api/v10';

function labelFor(c: Candidate): string {
  return `​\n**━━ ${c.variantId}** · _${c.surface}_ ━━\nreact 1️⃣–5️⃣ to rate · reply with your why`;
}

/**
 * Post the batch to Discord and return per-candidate anchor handles.
 * Each candidate: anchor (label · the rate target) → voice beat → billboard beat. Reactions
 * are added to the anchor. `dryRun` returns the planned handles without posting.
 */
export async function presentToDiscord(
  batch: RenderBatch,
  config: DiscordPresentConfig,
): Promise<PresentedBatch> {
  const username = config.username ?? 'ruggy';
  const avatar_url = config.avatarUrl ?? RUGGY_AVATAR_URL;
  const delayMs = config.delayMs ?? 1100;
  const doFetch = config.fetchImpl ?? fetch;
  const sleep = config.sleepImpl ?? defaultSleep;

  // with_components=true is REQUIRED for webhooks to honor Components V2 (else they're
  // dropped → "empty message" 400). Harmless for content/embed posts. Built via URL so a
  // webhook that already carries query params (e.g. ?thread_id=…) keeps them intact.
  const postUrl = (() => {
    const u = new URL(config.webhookUrl);
    u.searchParams.set('wait', 'true');
    u.searchParams.set('with_components', 'true');
    return u.toString();
  })();

  const post = async (body: PostBody): Promise<{ id: string; channel_id: string }> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await doFetch(postUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, username, avatar_url }),
      });
      if (res.status === 429) {
        const retry = await res.json().then((j: { retry_after?: number }) => j.retry_after ?? 1).catch(() => 1);
        await sleep(Math.ceil(retry * 1000) + 250);
        continue;
      }
      if (!res.ok) throw new Error(`webhook post failed: ${res.status} ${await res.text().catch(() => '')}`);
      return (await res.json()) as { id: string; channel_id: string };
    }
    throw new Error('webhook post failed: rate-limited after 3 attempts');
  };

  const react = async (channelId: string, messageId: string, emoji: string): Promise<void> => {
    if (!config.botToken) return; // no bot → operator adds reactions manually
    const enc = encodeURIComponent(emoji);
    // bounded iterative retry (mirrors `post`) — recursion here could loop forever under a
    // persistent rate limit and park the whole batch.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await doFetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`, {
        method: 'PUT',
        headers: { authorization: `Bot ${config.botToken}` },
      });
      if (res.status === 429) {
        const retry = await res.json().then((j: { retry_after?: number }) => j.retry_after ?? 1).catch(() => 1);
        await sleep(Math.ceil(retry * 1000) + 250);
        continue;
      }
      // 403 = bot not in server / missing perms — surface once, don't abort the whole batch
      if (!res.ok && res.status !== 403) console.error(`[discord-present] react ${emoji} failed: ${res.status}`);
      return;
    }
    console.error(`[discord-present] react ${emoji} failed: rate-limited after 3 attempts`);
  };

  const presented: PresentedCandidate[] = [];
  let channelId = '';
  for (const candidate of batch.candidates) {
    const anchor = await post({ content: labelFor(candidate) }); // the rate target
    channelId = anchor.channel_id;
    const messageIds = [anchor.id];
    await sleep(delayMs);
    // beat 1 — the agent voice (stats-out-of-voice)
    if (candidate.voiceContent.trim()) {
      const v = await post({ content: candidate.voiceContent });
      messageIds.push(v.id);
      await sleep(delayMs);
    }
    // beat 2 — the data billboard, rendered per the candidate's Discord surface. Resilient:
    // a surface that the webhook rejects (e.g. components-v2 quirks) falls back to text so the
    // batch always completes — never abort the whole round on one surface.
    try {
      const d = await post(dataBeatBody(candidate, batch.snapshot));
      messageIds.push(d.id);
    } catch (e) {
      console.error(`[discord-present] ${candidate.variantId} (${candidate.surface}) data beat failed: ${(e as Error).message} — falling back to text`);
      const d = await post({ content: candidate.payload.secondary?.content ?? candidate.billboard ?? '·' });
      messageIds.push(d.id);
    }
    await sleep(delayMs);
    // anchor + beats (reply attribution); reactions go on the anchor
    presented.push({ variantId: candidate.variantId, handle: anchor.id, messageIds });
    for (const emoji of RATING_EMOJI) {
      await react(channelId, anchor.id, emoji);
      await sleep(300);
    }
  }

  return { batchId: batch.batchId, zone: batch.zone, presented, meta: { channelId } };
}
