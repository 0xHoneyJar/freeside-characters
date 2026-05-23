// cycle-008 S9 (g30) · Discord adapter · CAPTURE — read reactions + replies via raw REST.
//
// Raw Discord REST (Authorization: Bot <token>) — deliberately NOT the shared gateway client,
// so the production shell bot's intents are untouched. For each candidate's anchor message:
//   score — which 1️⃣–5️⃣ the operator added (excluding the bot's own seed reactions)
//   why   — the operator's reply text referencing the anchor (needs Message Content intent)
// → rlhf-preference-v1 ratings.
//
// GPT-review (2026-05-23, code-findings-1): every read goes through a 429-safe helper (a 429
// here would silently drop ratings → poison the corpus), and reply matching paginates so whys
// aren't missed once messages roll off the first page in an active channel.

import type { PresentedBatch, CapturedFeedback } from '../../ports/medium-adapter.ts';
import type { PreferenceRating } from '../../core/preference-log.ts';
import { RATING_EMOJI } from './present.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const MAX_PAGES = 5; // reply-scan pagination cap (test server is low-traffic; bound the cost)

export interface DiscordCaptureConfig {
  readonly botToken: string;
  readonly channelId: string;
  /** Exclude the bot's own seed reactions. Auto-fetched from /users/@me if absent. */
  readonly botUserId?: string;
  /** Attribute feedback to this user. If absent, any non-bot reactor counts (personal server). */
  readonly operatorUserId?: string;
  readonly fetchImpl?: typeof fetch;
  readonly sleepImpl?: (ms: number) => Promise<void>;
}

interface DiscordUser {
  readonly id: string;
  readonly bot?: boolean;
}
interface DiscordMessage {
  readonly id: string;
  readonly content: string;
  readonly author: DiscordUser;
  readonly message_reference?: { message_id?: string };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 429-safe GET → JSON. Retries on rate limit (retry_after); returns `fallback` on hard error. */
async function apiGetJson<T>(
  doFetch: typeof fetch,
  url: string,
  headers: Record<string, string>,
  fallback: T,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, { headers });
    } catch {
      return fallback;
    }
    if (res.status === 429) {
      const retry = await res.json().then((j: { retry_after?: number }) => j.retry_after ?? 1).catch(() => 1);
      await sleep(Math.ceil(retry * 1000) + 250);
      continue;
    }
    // Auth/permission failures are systemic (bad token, bot not in channel) — surface them, don't
    // record them as empty feedback. 404/5xx fall through to the benign fallback (deleted message
    // / transient blip → skip that read, keep the rest of the capture).
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Discord capture unauthorized (${res.status}) at ${url.split('?')[0]} — check bot token / channel permissions`);
    }
    if (!res.ok) return fallback;
    try {
      return (await res.json()) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function captureFromDiscord(
  presented: PresentedBatch,
  config: DiscordCaptureConfig,
): Promise<CapturedFeedback> {
  const doFetch = config.fetchImpl ?? fetch;
  const sleep = config.sleepImpl ?? defaultSleep;
  const auth = { authorization: `Bot ${config.botToken}` };
  const channelId = config.channelId || (presented.meta?.channelId as string | undefined);
  if (!channelId) throw new Error('captureFromDiscord: no channelId (pass config.channelId or presented.meta.channelId)');

  const botUserId =
    config.botUserId ??
    (await apiGetJson<DiscordUser | null>(doFetch, `${DISCORD_API}/users/@me`, auth, null, sleep))?.id;

  const isOperator = (u: DiscordUser): boolean => {
    if (u.id === botUserId || u.bot) return false;
    return config.operatorUserId ? u.id === config.operatorUserId : true;
  };

  // Reply→why matching: paginate channel history (newest→older) until EVERY candidate has a
  // matching operator reply, or we hit the page cap / run out of history. Stopping at the first
  // match across the batch would miss older replies belonging to other candidates.
  const candTargets = presented.presented.map(
    (c) => new Set(c.messageIds && c.messageIds.length ? c.messageIds : [c.handle]),
  );
  const matched = candTargets.map(() => false);
  const recent: DiscordMessage[] = [];
  let before: string | undefined;
  for (let page = 0; page < MAX_PAGES && !matched.every(Boolean); page++) {
    const qs = before ? `?limit=100&before=${before}` : '?limit=100';
    const batch = await apiGetJson<DiscordMessage[]>(doFetch, `${DISCORD_API}/channels/${channelId}/messages${qs}`, auth, [], sleep);
    if (batch.length === 0) break;
    recent.push(...batch);
    before = batch[batch.length - 1]?.id;
    candTargets.forEach((targets, i) => {
      if (matched[i]) return;
      if (
        batch.some(
          (m) =>
            m.message_reference?.message_id &&
            targets.has(m.message_reference.message_id) &&
            isOperator(m.author) &&
            m.content?.trim(),
        )
      ) {
        matched[i] = true;
      }
    });
  }

  const ratings: PreferenceRating[] = [];
  for (const cand of presented.presented) {
    // score = highest keycap the operator reacted with (on the anchor / handle)
    let score: number | undefined;
    for (let i = 0; i < RATING_EMOJI.length; i++) {
      const enc = encodeURIComponent(RATING_EMOJI[i]!);
      const users = await apiGetJson<DiscordUser[]>(
        doFetch,
        `${DISCORD_API}/channels/${channelId}/messages/${cand.handle}/reactions/${enc}?limit=100`,
        auth,
        [],
        sleep,
      );
      if (users.some(isOperator)) score = i + 1; // keep climbing → highest wins
    }

    // why = the operator's reply referencing ANY of the candidate's messages (anchor OR a beat)
    const ids = new Set(cand.messageIds ?? [cand.handle]);
    const reply = recent.find(
      (m) =>
        m.message_reference?.message_id !== undefined &&
        ids.has(m.message_reference.message_id) &&
        isOperator(m.author) &&
        m.content?.trim(),
    );
    const why = reply?.content.trim();

    if (score === undefined && !why) continue; // no feedback for this candidate → skip
    ratings.push({ variant: cand.variantId, score, why });
  }

  return { ratings };
}
