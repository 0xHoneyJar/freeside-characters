/**
 * Discord Interactions API types (V0.7-A.0).
 *
 * Pattern source: `~/Documents/GitHub/ruggy-moltbot/src/webhooks/discord.ts:299-358`.
 * Ported to module-level enums + interfaces — kept minimal to what
 * V0.7-A.0 dispatch actually needs. Extend at V0.7-A.5+ when message
 * components / modals / autocomplete land.
 *
 * Reference: https://discord.com/developers/docs/interactions/receiving-and-responding
 */

/** Top-level Discord interaction kinds Discord sends to our webhook. */
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;
export type InteractionType = (typeof InteractionType)[keyof typeof InteractionType];

/** Response types for Discord interactions. */
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  /** ACK with "Application is thinking..." UI · 15-min token window opens. */
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;
export type InteractionResponseType =
  (typeof InteractionResponseType)[keyof typeof InteractionResponseType];

/**
 * Discord MessageFlags bitwise constants. EPHEMERAL = 1 << 6 = 64.
 * Set on initial deferred response to scope the entire interaction lifecycle
 * to invoker-only visibility (cannot convert to public mid-flight per Gemini DR
 * 2026-04-30; choose at invocation time).
 */
export const MessageFlags = {
  EPHEMERAL: 1 << 6, // 64
} as const;

export interface DiscordInteractionUser {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  bot?: boolean;
}

/** Application command option as Discord delivers it (data.options[i]). */
export interface DiscordOption {
  name: string;
  /** Discord application command option type. STRING=3, BOOLEAN=5. */
  type: number;
  value?: string | number | boolean;
  options?: DiscordOption[];
}

export interface DiscordInteractionData {
  id: string;
  name: string;
  type?: number;
  options?: DiscordOption[];
}

export interface DiscordInteraction {
  type: InteractionType;
  id: string;
  application_id: string;
  /** 15-min interaction token used in PATCH @original / POST follow-ups. */
  token: string;
  guild_id?: string;
  channel_id?: string;
  /** Present when invoked in a guild (member.user is the invoker). */
  member?: {
    user: DiscordInteractionUser;
  };
  /** Present when invoked in a DM (user is the invoker). */
  user?: DiscordInteractionUser;
  data?: DiscordInteractionData;
}

export interface DiscordInteractionResponseData {
  content?: string;
  embeds?: object[];
  /** Bitwise OR of MessageFlags (e.g., MessageFlags.EPHEMERAL = 64). */
  flags?: number;
  allowed_mentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    users?: string[];
    roles?: string[];
    replied_user?: boolean;
  };
}

export interface DiscordInteractionResponse {
  type: InteractionResponseType;
  data?: DiscordInteractionResponseData;
}

/** Helper: extract the invoking user from member (guild) or user (DM). */
export function interactionInvoker(interaction: DiscordInteraction): {
  id: string;
  username: string;
  bot?: boolean;
} {
  const member = interaction.member as
    | {
        nick?: string | null;
        user?: DiscordInteractionUser & {
          global_name?: string | null;
        };
      }
    | undefined;

  const user = (member?.user ?? interaction.user) as
    | (DiscordInteractionUser & {
        global_name?: string | null;
        bot?: boolean;
      })
    | undefined;

  return {
    id: user?.id ?? 'unknown',
    username:
      member?.nick ??
      user?.global_name ??
      user?.username ??
      'someone',
    bot: user?.bot,
  };
}

/** Helper: read a typed string option from interaction.data.options. */
export function readStringOption(
  interaction: DiscordInteraction,
  name: string,
): string | undefined {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  if (!opt) return undefined;
  if (typeof opt.value !== 'string') return undefined;
  return opt.value;
}

/** Helper: read a typed boolean option from interaction.data.options. */
export function readBooleanOption(
  interaction: DiscordInteraction,
  name: string,
): boolean | undefined {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  if (!opt) return undefined;
  if (typeof opt.value !== 'boolean') return undefined;
  return opt.value;
}
