/**
 * onboarding-dispatch.ts — C2 · the verify-button → secure-handoff bridge
 * (cycle-009 · sprint-2 · T2.2).
 *
 * Mirrors quest-dispatch.ts: an early-detect predicate (`isOnboardingInteraction`)
 * lets dispatch.ts short-circuit BEFORE per-character resolution, AFTER the
 * anti-spam guard + circuit breaker + auth-bridge (so onboarding inherits all
 * three protections). The handler returns a DEFERRED ephemeral ACK synchronously
 * (never exceeds Discord's 3s ACK window — H-3) and the caller fires the
 * background pre-check (`runOnboardingPrecheck`) which PATCHes the ephemeral reply.
 *
 * The pre-check (FR-2/FR-13) has three branches:
 *   - verified   : linked + already has the role → "nothing to do".
 *   - restored   : linked, missing role → re-grant (FR-13; grant wired sprint-4).
 *   - new        : not linked → mint a single-use handoff token (C3) + hand back
 *                  an opaque verify URL (the discord_id is NEVER in the URL — H-1).
 *
 * resolveByDiscord is DEP-A (identity-api Phase-2, may be unbuilt). On any auth
 * error we fall through to the `new` branch (slip-fallback: the web flow's link
 * is idempotent, so a redundant verify is harmless) rather than fail the user.
 */

import type {
  DiscordInteraction,
  DiscordInteractionResponse,
} from './types.ts';
import { InteractionResponseType, MessageFlags, interactionInvoker } from './types.ts';
import {
  ONBOARD_PREFIX,
  ONBOARD_VERIFY_CUSTOM_ID,
  mintToken,
  type FreesideAuthClient,
} from '@freeside-characters/persona-engine/onboarding';
import { Effect, Exit } from 'effect';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Slash command names this bot owns for onboarding (distinct from sietch's /verify).
const ONBOARD_SLASH_NAMES = new Set(['onboard']);

/** Per-bot onboarding runtime — wired at boot (index.ts). No-op default keeps dev safe. */
export interface OnboardingRuntime {
  /** identity-api client (C5). null until wired → every click degrades to `new`. */
  readonly authClient: FreesideAuthClient | null;
  /** base URL of the verify web surface (C4), e.g. https://verify.thj.fun (no trailing slash). */
  readonly verifyBaseUrl: string;
  /** optional role-state probe (sprint-4 wires the real guild check). default → false. */
  readonly hasVerifiedRole?: (interaction: DiscordInteraction) => boolean | Promise<boolean>;
  /** optional re-grant for the `restored` branch (sprint-4 wires C6). */
  readonly regrantRole?: (interaction: DiscordInteraction) => Promise<void>;
  readonly noRuntime: boolean;
}

export const noOnboardingRuntime: OnboardingRuntime = {
  authClient: null,
  verifyBaseUrl: '',
  noRuntime: true,
};

// ---------------------------------------------------------------------------
// Detection (mirrors isQuestInteraction)
// ---------------------------------------------------------------------------

/** True for the verify button click OR an /onboard slash command. */
export function isOnboardingInteraction(interaction: DiscordInteraction): boolean {
  // MESSAGE_COMPONENT (3): the verify button.
  if (interaction.type === 3) {
    const customId =
      ((interaction.data as { custom_id?: string } | undefined)?.custom_id) ?? '';
    return customId === ONBOARD_VERIFY_CUSTOM_ID;
  }
  // APPLICATION_COMMAND (2): /onboard.
  if (interaction.type === 2) {
    return ONBOARD_SLASH_NAMES.has(interaction.data?.name ?? '');
  }
  return false;
}

/**
 * RT-6 — a foreign component that squats the reserved `onboard:` prefix but isn't
 * the exact verify id is rejected (not silently handled). Returns true when the
 * custom_id is in-namespace but NOT a known onboarding action.
 */
export function isForeignOnboardSquat(interaction: DiscordInteraction): boolean {
  if (interaction.type !== 3) return false;
  const customId =
    ((interaction.data as { custom_id?: string } | undefined)?.custom_id) ?? '';
  return customId.startsWith(ONBOARD_PREFIX) && customId !== ONBOARD_VERIFY_CUSTOM_ID;
}

// ---------------------------------------------------------------------------
// Branch decision (pure — the unit-testable core)
// ---------------------------------------------------------------------------

export type OnboardingBranch = 'verified' | 'restored' | 'new';

/** FR-2/FR-13 pre-check decision. Pure. */
export function decideOnboardingBranch(p: { linked: boolean; hasRole: boolean }): OnboardingBranch {
  if (p.linked && p.hasRole) return 'verified';
  if (p.linked && !p.hasRole) return 'restored';
  return 'new';
}

/** Functional copy per branch (persona swaps these in sprint-5 · lowercase repo voice). */
export function branchReply(branch: OnboardingBranch, verifyUrl: string): string {
  switch (branch) {
    case 'verified':
      return "you're already verified. nothing to do here.";
    case 'restored':
      return 'found your link on file — restoring your verified role now.';
    case 'new':
      return `let's link your wallet. open this to connect (expires in 5 min):\n${verifyUrl}`;
  }
}

// ---------------------------------------------------------------------------
// Handler — synchronous deferred ACK (caller fires runOnboardingPrecheck)
// ---------------------------------------------------------------------------

/**
 * Return the immediate deferred ephemeral ACK. The 15-min token window opens;
 * the caller PATCHes @original via runOnboardingPrecheck. Guild-only.
 */
export function handleOnboardingInteraction(
  interaction: DiscordInteraction,
): DiscordInteractionResponse {
  // guild-only — a DM click gets an instant ephemeral (no defer, no token mint).
  if (!interaction.guild_id) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'verify from inside the server, not a dm.', flags: MessageFlags.EPHEMERAL },
    };
  }
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: MessageFlags.EPHEMERAL },
  };
}

interface PrecheckDeps {
  fetchFn?: typeof fetch;
  /** test seam — override the token minter. */
  mintTokenFn?: typeof mintToken;
}

/**
 * Background pre-check + PATCH @original (fire-and-forget from dispatch.ts).
 * NEVER throws into the caller — every failure degrades to an in-character message.
 */
export async function runOnboardingPrecheck(
  interaction: DiscordInteraction,
  runtime: OnboardingRuntime,
  deps: PrecheckDeps = {},
): Promise<void> {
  const doFetch = deps.fetchFn ?? fetch;
  const mint = deps.mintTokenFn ?? mintToken;
  try {
    if (!interaction.guild_id) {
      await editOriginal(interaction, 'verify from inside the server, not a dm.', doFetch);
      return;
    }
    const invoker = interactionInvoker(interaction);
    const discordId = invoker.id;

    // FR-2 idempotent pre-check (DEP-A). On any error → degrade to `new` (slip-fallback).
    let linked = false;
    if (runtime.authClient) {
      const exit = await Effect.runPromiseExit(runtime.authClient.resolveByDiscord(discordId));
      linked = Exit.isSuccess(exit) && exit.value !== null;
    }
    const hasRole = linked ? Boolean(await runtime.hasVerifiedRole?.(interaction)) : false;
    const branch = decideOnboardingBranch({ linked, hasRole });

    let verifyUrl = '';
    if (branch === 'new') {
      const token = mint({
        discord_id: discordId,
        interaction_id: interaction.id,
        guild_id: interaction.guild_id,
      });
      verifyUrl = `${runtime.verifyBaseUrl.replace(/\/+$/, '')}/verify/${token}`;
    } else if (branch === 'restored') {
      // FR-13 re-grant (idempotent). Grant logic lands in sprint-4 (C6); best-effort here.
      await runtime.regrantRole?.(interaction).catch(() => {});
    }

    await editOriginal(interaction, branchReply(branch, verifyUrl), doFetch);
  } catch (err) {
    // RT-3 — never surface raw error detail; in-character fallback.
    console.warn(`onboarding: precheck failed (id=${interaction.id})`);
    await editOriginal(interaction, 'cables got crossed — try the verify button again in a moment.', doFetch).catch(
      () => {},
    );
  }
}

/** PATCH the deferred ephemeral @original with content (local · injectable fetch for tests). */
async function editOriginal(
  interaction: DiscordInteraction,
  content: string,
  doFetch: typeof fetch,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const res = await doFetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, flags: MessageFlags.EPHEMERAL, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    throw new Error(`onboarding: PATCH @original failed status=${res.status}`);
  }
}
