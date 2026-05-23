// cycle-008 S9 (g30) · Discord adapter — the PRIMARY medium (post + react + reply capture).

import type { MediumAdapter, PresentedBatch } from '../../ports/medium-adapter.ts';
import { presentToDiscord, type DiscordPresentConfig } from './present.ts';
import { captureFromDiscord, type DiscordCaptureConfig } from './capture.ts';

export interface DiscordAdapterConfig extends DiscordPresentConfig {
  /** Bot token for reactions (present) + reading reactions/replies (capture). */
  readonly botToken?: string;
  readonly channelId?: string;
  readonly botUserId?: string;
  readonly operatorUserId?: string;
}

/** Wire present + capture into the port. channelId for capture defaults to present's meta. */
export function createDiscordAdapter(config: DiscordAdapterConfig): MediumAdapter {
  return {
    name: 'discord',
    present: (batch) => presentToDiscord(batch, config),
    capture: async (presented: PresentedBatch) => {
      // Capture is REST-read-only; an empty token sends `Authorization: Bot ` → 401s that the
      // 429-safe helper would swallow as [] → silently incomplete RLHF data. Fail fast instead.
      if (!config.botToken) {
        throw new Error('createDiscordAdapter.capture requires botToken for Discord REST reads');
      }
      return captureFromDiscord(presented, {
        botToken: config.botToken,
        channelId: config.channelId ?? (presented.meta?.channelId as string | undefined) ?? '',
        botUserId: config.botUserId,
        operatorUserId: config.operatorUserId,
        fetchImpl: config.fetchImpl,
      });
    },
  };
}

export { presentToDiscord, RUGGY_AVATAR_URL, RATING_EMOJI } from './present.ts';
export { captureFromDiscord } from './capture.ts';
export type { DiscordPresentConfig } from './present.ts';
export type { DiscordCaptureConfig } from './capture.ts';
export { buildBillboardEmbed, buildBillboardComponentsV2, buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2, dimDisplay } from './rich-render.ts';
export type { EnrichedDigestOpts } from './rich-render.ts';
export { POST_TYPE_GALLERY } from './post-type-gallery.ts';
export type { GalleryItem } from './post-type-gallery.ts';
