/**
 * publishCommands — register slash commands with Discord.
 *
 * Two consumers (2026-05-04):
 *   1. Bot startup auto-publish (`apps/bot/src/index.ts`) — every deploy
 *      auto-syncs commands so merge=Discord push.
 *   2. CLI tool (`apps/bot/scripts/publish-commands.ts`) — ad-hoc
 *      registration during local dev.
 *
 * Discord PUT replaces the full set per (application, guild) so calls are
 * idempotent — duplicate calls don't leak.
 *
 * Propagation gotcha (Gemini DR 2026-04-30): GLOBAL command sync can take
 * up to 1 HOUR to propagate · users may invoke OLD CACHED schemas during
 * the window, sending malformed payloads to the new backend. For breaking
 * changes, prefer guild-only registration during dev and stage carefully
 * for prod cutover.
 */

import type { CharacterConfig } from '@freeside-characters/persona-engine';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Discord application command option types (PARTIAL · only what we use).
const SUB_COMMAND_OPTION_TYPE = 1;
const STRING_OPTION_TYPE = 3;
const BOOLEAN_OPTION_TYPE = 5;

interface CommandOption {
  name: string;
  description: string;
  /** Discord application command option type. STRING=3, BOOLEAN=5, SUB_COMMAND=1. */
  type: number;
  required?: boolean;
}

export interface CommandSchema {
  name: string;
  description: string;
  options: CommandOption[];
}

// =====================================================================
// Public API
// =====================================================================

export interface PublishCommandsOptions {
  readonly botToken: string;
  /** If absent, derived from `/applications/@me`. */
  readonly applicationId?: string;
  /** undefined = global registration (~1hr propagation). */
  readonly guildId?: string;
  readonly characters: readonly CharacterConfig[];
}

export interface PublishCommandsResult {
  readonly registered: number;
  readonly commands: ReadonlyArray<{ name: string; id: string }>;
  readonly scope: 'guild' | 'global';
  readonly guildId?: string;
}

/**
 * Register slash commands with Discord. Idempotent — Discord PUT replaces
 * the full set per (application, guild) so duplicate calls don't leak.
 *
 * @throws Error on missing/invalid auth, network failure, or non-2xx response.
 */
export async function publishCommands(
  opts: PublishCommandsOptions,
): Promise<PublishCommandsResult> {
  if (!opts.botToken) {
    throw new Error('publishCommands: botToken is required');
  }

  const applicationId =
    opts.applicationId ?? (await fetchApplicationId(opts.botToken));
  if (!applicationId) {
    throw new Error(
      'publishCommands: applicationId not provided and could not be derived from /applications/@me',
    );
  }

  if (opts.characters.length === 0) {
    throw new Error('publishCommands: no characters provided');
  }

  const commands = buildCommandSet(opts.characters);

  const url = opts.guildId
    ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${opts.guildId}/commands`
    : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${opts.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '<unreadable>');
    throw new Error(
      `publishCommands: Discord PUT failed status=${response.status} body=${txt}`,
    );
  }

  const result = (await response.json()) as Array<{ id: string; name: string }>;
  return {
    registered: result.length,
    commands: result.map((r) => ({ name: r.name, id: r.id })),
    scope: opts.guildId ? 'guild' : 'global',
    guildId: opts.guildId,
  };
}

/**
 * Build the full command set for the loaded characters. Pure function —
 * no I/O, deterministic given the same characters input.
 *
 * Exported so the CLI can preview the set before submitting.
 */
export function buildCommandSet(
  characters: readonly CharacterConfig[],
): CommandSchema[] {
  const commands: CommandSchema[] = characters.map((c) =>
    buildCommand(c.id, c.displayName ?? c.id),
  );

  if (characters.some((c) => c.id === 'satoshi')) {
    commands.push({
      name: 'satoshi-image',
      description: 'Ask Satoshi to generate an image',
      options: [
        {
          name: 'prompt',
          description: 'Describe the image you want Satoshi to generate',
          type: STRING_OPTION_TYPE,
          required: true,
        },
        {
          name: 'ephemeral',
          description: 'only you see the reply',
          type: BOOLEAN_OPTION_TYPE,
          required: false,
        },
      ],
    });
  }

  // V0.7-A.5 / cycle-Q · sprint-3 Q3.5: /quest slash command tree.
  // 4 subcommands per SDD §5.4: browse · accept <quest_id> · submit <quest_id> · status.
  // Routed by apps/bot/src/discord-interactions/dispatch.ts via the
  // `quest` command name → @0xhoneyjar/quests-discord-renderer dispatchQuestInteraction.
  //
  // SYSTEM_COMMANDS extension per Q3.5 task spec — registered alongside
  // per-character commands; NOT bound to a single character (cross-NPC).
  commands.push({
    name: 'quest',
    description: 'browse · accept · submit · check the path',
    options: [
      {
        name: 'browse',
        description: 'see the quests on offer',
        type: SUB_COMMAND_OPTION_TYPE,
      } as unknown as CommandOption,
      {
        name: 'accept',
        description: 'mark a quest as accepted',
        type: SUB_COMMAND_OPTION_TYPE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          options: [
            {
              name: 'quest_id',
              description: 'the quest to accept',
              type: STRING_OPTION_TYPE,
              required: true,
            },
          ],
        } as any),
      } as unknown as CommandOption,
      {
        name: 'submit',
        description: 'submit your offering for an accepted quest',
        type: SUB_COMMAND_OPTION_TYPE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          options: [
            {
              name: 'quest_id',
              description: 'the quest you are submitting for',
              type: STRING_OPTION_TYPE,
              required: true,
            },
          ],
        } as any),
      } as unknown as CommandOption,
      {
        name: 'status',
        description: 'see your marks',
        type: SUB_COMMAND_OPTION_TYPE,
      } as unknown as CommandOption,
    ],
  });

  return commands;
}

function buildCommand(id: string, displayName: string): CommandSchema {
  const lower = displayName.toLowerCase();
  return {
    name: id,
    description: `talk to ${lower}`,
    options: [
      { name: 'prompt', description: `what to say to ${lower}`, type: STRING_OPTION_TYPE, required: true },
      { name: 'ephemeral', description: 'only you see the reply', type: BOOLEAN_OPTION_TYPE, required: false },
    ],
  };
}

export async function fetchApplicationId(botToken: string): Promise<string | undefined> {
  const response = await fetch(`${DISCORD_API_BASE}/applications/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    console.warn(`publish-commands: could not fetch /applications/@me (status ${response.status})`);
    return undefined;
  }
  const data = (await response.json()) as { id?: string };
  return data.id;
}
