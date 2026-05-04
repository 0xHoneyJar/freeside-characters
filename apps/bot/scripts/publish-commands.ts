/**
 * Publish slash commands to Discord (V0.7-A.1).
 *
 * One-shot script — run after character set or command schema changes.
 * Registers `/ruggy`, `/satoshi`, and any additional characters loaded
 * via the standard CHARACTERS env mechanism.
* Registers every command declared by every loaded character. Characters
 * Registers `/ruggy`, `/satoshi`, and any additional characters loaded
 * that don't declare `slash_commands` get the V0.7-A.0 default `/<id>
 * via the standard CHARACTERS env mechanism.
 * prompt:<text> ephemeral:<bool>` (chat handler).
 *
 * V0.7-A.1: characters can now declare divergent command sets in their
 * `character.json`. Eileen's framing: "commands are diff otherwise they'd
 * be reporting the same shit." E.g. /satoshi (chat) + /satoshi-image
 * (imagegen handler).
 *
 * Usage:
 *   # guild-only (immediate propagation in a single guild · use during dev):
 *   DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... DISCORD_GUILD_ID=... \
 *     bun run apps/bot/scripts/publish-commands.ts
 *
 *   # global (up to 1-hour propagation · use for prod cutover):
 *   DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... \
 *     bun run apps/bot/scripts/publish-commands.ts
 *
 * Propagation gotcha (Gemini DR 2026-04-30): GLOBAL command sync can take
 * up to 1 HOUR to propagate · users may invoke OLD CACHED schemas during
 * the window, sending malformed payloads to the new backend. For breaking
 * changes, prefer guild-only registration during dev and stage carefully
 * for prod cutover.
 *
 * The script does NOT read DISCORD_APPLICATION_ID from the standard config
 * schema (it's a deploy-time concern, not a runtime one). The bot token
 * is the only secret in `.env` strictly required for this script.
 */

import { loadCharacters, resolveSlashCommands } from '../src/character-loader.ts';
import type { SlashCommandOption, SlashCommandSpec } from '@freeside-characters/persona-engine';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface CommandOption {
  name: string;
  description: string;
  /** Discord application command option type. STRING=3, BOOLEAN=5. */
  type: number;
  required?: boolean;
}

interface CommandSchema {
  name: string;
  description: string;
  options: CommandOption[];
}

async function main(): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('publish-commands: DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }

  const applicationId =
    process.env.DISCORD_APPLICATION_ID ?? (await fetchApplicationId(botToken));
  if (!applicationId) {
    console.error(
      'publish-commands: DISCORD_APPLICATION_ID not set and could not be derived from /applications/@me',
    );
    process.exit(1);
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const characters = loadCharacters();
  if (characters.length === 0) {
    console.error('publish-commands: no characters loaded — set CHARACTERS env or ensure apps/character-* exists');
    process.exit(1);
  }

  const commands: CommandSchema[] = characters.map((c) => buildCommand(c.id, c.displayName ?? c.id));

if (characters.some((c) => c.id === 'satoshi')) {
  commands.push({
    name: 'satoshi-image',
    description: 'Ask Satoshi to generate an image',
    options: [
      {
        name: 'prompt',
        description: 'Describe the image you want Satoshi to generate',
        type: 3,
        required: true,
      },
      {
        name: 'ephemeral',
        description: 'only you see the reply',
        type: 5,
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
const QUEST_SUBCOMMAND_OPTION_TYPE = 1; // SUB_COMMAND
const QUEST_STRING_OPTION_TYPE = 3; // STRING
commands.push({
  name: 'quest',
  description: 'browse · accept · submit · check the path',
  options: [
    {
      name: 'browse',
      description: 'see the quests on offer',
      type: QUEST_SUBCOMMAND_OPTION_TYPE,
    } as unknown as CommandOption,
    {
      name: 'accept',
      description: 'mark a quest as accepted',
      type: QUEST_SUBCOMMAND_OPTION_TYPE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        options: [
          {
            name: 'quest_id',
            description: 'the quest to accept',
            type: QUEST_STRING_OPTION_TYPE,
            required: true,
          },
        ],
      } as any),
    } as unknown as CommandOption,
    {
      name: 'submit',
      description: 'submit your offering for an accepted quest',
      type: QUEST_SUBCOMMAND_OPTION_TYPE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        options: [
          {
            name: 'quest_id',
            description: 'the quest you are submitting for',
            type: QUEST_STRING_OPTION_TYPE,
            required: true,
          },
        ],
      } as any),
    } as unknown as CommandOption,
    {
      name: 'status',
      description: 'see your marks',
      type: QUEST_SUBCOMMAND_OPTION_TYPE,
    } as unknown as CommandOption,
  ],
});

  const url = guildId
    ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${guildId}/commands`
    : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;

  const scope = guildId ? `guild ${guildId}` : 'GLOBAL (1-hour propagation)';
  console.log(`publish-commands: registering ${commands.length} commands → ${scope}`);
  for (const cmd of commands) {
    console.log(`  · /${cmd.name} — ${cmd.description}`);
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '<unreadable>');
    console.error(`publish-commands: FAILED status=${response.status}`);
    console.error(txt);
    process.exit(1);
  }

  const result = (await response.json()) as Array<{ id: string; name: string }>;
  console.log(`publish-commands: registered ${result.length} commands successfully`);
  for (const r of result) {
    console.log(`  ✓ /${r.name} → id ${r.id}`);
  }
}

function buildCommand(id: string, displayName: string): CommandSchema {
  const lower = displayName.toLowerCase();
  return {
    name: id,
    description: `talk to ${lower}`,
    options: [
      { name: 'prompt', description: `what to say to ${lower}`, type: 3, required: true },
      { name: 'ephemeral', description: 'only you see the reply', type: 5, required: false },
    ],
  };
}

async function fetchApplicationId(botToken: string): Promise<string | undefined> {
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

main().catch((err) => {
  console.error('publish-commands: fatal:', err);
  process.exit(1);
});
