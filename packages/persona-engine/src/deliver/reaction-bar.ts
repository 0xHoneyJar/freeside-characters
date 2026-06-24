/**
 * reaction-bar.ts — community-signaling primitive for "what sticks"
 *
 * Auto-reacts on every successfully delivered digest with 3 seed
 * reactions. Community members add their own reaction; Discord
 * surfaces the tally inline on the message; operator reads the
 * gradient over time via `apps/bot/scripts/digest-tally.ts`.
 *
 * Design choices:
 * - **3 reactions, not 4**: 🪲 (bug · raw data wrong) deferred until
 *   score-mibera#115 verifier ships and the bug-class tally can
 *   correlate with verifier `partial`/`fail` verdicts.
 * - **👀 not 🙌**: 🙌 is on CLAUDE.md's banned corporate-bot-tells
 *   list; 👀 is already in ruggy's persona register-mood vocabulary
 *   (production: "👀 honeyspun, peeped on Mibera Quality").
 * - **HITL feedback loop**: agents do NOT read the tally to auto-tune
 *   behavior. Operator reads tally, decides doctrine drift, updates
 *   persona prompts manually. Reaction counts are intel for the
 *   operator, not training signal for the LLM.
 * - **Fail-soft**: reaction-bar errors NEVER fail the digest delivery.
 *   Log + continue; reactions are augmentation, not critical path.
 *
 * Refs:
 *   grimoires/loa/context/track-2026-05-14-signaling-primitive-reaction-bar.md
 *   CLAUDE.md "Discord-as-Material" rule · banned-emoji list
 *   score-mibera#115 (companion verifier doctrine)
 */

import type { Client } from 'discord.js';

/**
 * Maximum reactions in the bar. **TS-level invariant** (not a comment
 * suggestion) per OSTROM 2026-05-14 review: prevents Goodhart-style
 * scope creep where 3 reactions slowly become a 7-emoji Likert scale
 * that loses texture. Discord's single-message reaction display wraps
 * past ~5 reactions on mobile; this bound also matches the UX cliff.
 *
 * Increasing this requires a structural justification, not a feature
 * request. Document in the track file before changing.
 */
export const MAX_REACTION_BAR_LENGTH = 5 as const;

/**
 * The seed reactions. ORDER MATTERS — Discord renders reactions in
 * insertion order, so the bot's auto-react sequence determines the
 * left-to-right display sequence.
 *
 * Set chosen after KEEPER + OSTROM dual review (2026-05-14):
 *
 * - **👀** useful / "noticed" — invitation register, in ruggy's voice
 *   already (production: "👀 honeyspun, peeped on Mibera Quality").
 *   KEEPER: reads as conversation, not survey.
 *
 * - **🤔** unclear / "huh?" — signal real but framing missed. Neutral
 *   register. Operators read it as "framing-class drift" vs noise.
 *
 * - **🪲** bug / "data wrong" — verification-class signal. OSTROM
 *   2026-05-14: shipping 🪲 day-one (instead of waiting for score-
 *   mibera#115 verifier to land) prevents months of retroactive data
 *   loss. When verifier ships, 🪲 counts can correlate with verifier
 *   `partial`/`fail` verdicts; without day-one inclusion, the history
 *   is missing.
 *
 * Pre-review draft had 💤 (noise/skip) as the third slot; KEEPER 2026-
 * 05-14 flagged that bot-seeding 💤 reads as preemptive judgment ("we
 * think this might be bad"), adversarial to ruggy's "let it land or
 * don't" voice. The fix: don't seed 💤; let community SILENCE speak
 * for "didn't carry" instead. Posts with 0 reactions across all 3
 * categories ARE the noise signal — silence is data.
 */
export const REACTION_BAR_EMOJI = [
  '👀', // useful / "noticed" / landed
  '🤔', // unclear / "huh?" / signal real but framing missed
  '🪲', // bug / data wrong / verification-class failure
] as const;

// Compile-time enforcement of the invariant. Type error if the array
// grows past MAX_REACTION_BAR_LENGTH or shrinks below 1.
const _enforceLength: typeof REACTION_BAR_EMOJI extends { length: 0 }
  ? 'ERROR: REACTION_BAR_EMOJI must not be empty'
  : typeof REACTION_BAR_EMOJI extends { length: 1 | 2 | 3 | 4 | 5 }
    ? 'OK'
    : 'ERROR: REACTION_BAR_EMOJI must not exceed MAX_REACTION_BAR_LENGTH' = 'OK';
void _enforceLength;

export interface ReactionBarOptions {
  /** When true, log per-reaction success/failure. Defaults false. */
  readonly verbose?: boolean;
  /**
   * Override the emoji set (e.g., for a different character's
   * register, or to add 🪲 once verifier ships). Defaults to
   * REACTION_BAR_EMOJI. Keep the array small (≤5) — Discord throttles
   * heavy auto-react sequences and the operator-facing tally gets
   * noisy past 5 categories.
   */
  readonly emoji?: readonly string[];
}

export interface ReactionBarResult {
  readonly attached: number;
  readonly failed: number;
  readonly errors: ReadonlyArray<{ emoji: string; reason: string }>;
}

/**
 * Attach the reaction bar to a delivered digest message.
 *
 * Fetches the message via the bot client + iterates the emoji array,
 * calling `message.react(emoji)` for each. Errors are caught + logged
 * but never re-thrown — reaction-bar is non-critical augmentation
 * (the digest itself has already been delivered when this is called).
 *
 * @param client - Bot's discord.js Client (must be ready)
 * @param channelId - Channel where the digest was posted
 * @param messageId - Specific digest message to react to
 * @param opts - Optional overrides
 * @returns Counts + per-emoji error list for caller observability
 */
export async function attachReactionBar(
  client: Client,
  channelId: string,
  messageId: string,
  opts: ReactionBarOptions = {},
): Promise<ReactionBarResult> {
  const emoji = opts.emoji ?? REACTION_BAR_EMOJI;
  const verbose = opts.verbose ?? false;
  const errors: Array<{ emoji: string; reason: string }> = [];
  let attached = 0;

  let message;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !('messages' in channel)) {
      // Caller can't recover from channel-fetch failure; log and bail.
      console.error(
        `[reaction-bar] channel ${channelId} not text-based or missing — skipping reactions for message ${messageId}`,
      );
      return {
        attached: 0,
        failed: emoji.length,
        errors: emoji.map((e) => ({ emoji: e, reason: 'channel-not-text-based' })),
      };
    }
    message = await channel.messages.fetch(messageId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(
      `[reaction-bar] message ${messageId} fetch failed: ${reason} — skipping reactions`,
    );
    return {
      attached: 0,
      failed: emoji.length,
      errors: emoji.map((e) => ({ emoji: e, reason: `message-fetch-failed: ${reason}` })),
    };
  }

  for (const e of emoji) {
    try {
      await message.react(e);
      attached += 1;
      if (verbose) {
        console.log(`[reaction-bar] attached ${e} to ${messageId}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ emoji: e, reason });
      console.error(
        `[reaction-bar] failed to attach ${e} to ${messageId}: ${reason}`,
      );
    }
  }

  return {
    attached,
    failed: errors.length,
    errors,
  };
}
