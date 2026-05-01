/**
 * Publish slash commands to Discord (V0.7-A.0 → V0.7-A.1).
 *
 * One-shot script — run after character set or command schema changes.
 * Registers every command declared by every loaded character. Characters
 * that don't declare `slash_commands` get the V0.7-A.0 default `/<id>
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

interface DiscordCommandSchema {
  name: string;
  description: string;
  options: SlashCommandOption[];
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

  // Flatten every character's resolved (declared or defaulted) commands
  // into one Discord-shaped registration payload. Reject duplicates loud
  // — Discord silently overwrites by name, but a clash within our own
  // codebase is a config error worth surfacing rather than papering over.
  const commands: DiscordCommandSchema[] = [];
  const ownerByName = new Map<string, string>();
  for (const c of characters) {
    for (const spec of resolveSlashCommands(c)) {
      const existingOwner = ownerByName.get(spec.name);
      if (existingOwner) {
        console.error(
          `publish-commands: duplicate command name /${spec.name} declared by both ${existingOwner} and ${c.id}`,
        );
        process.exit(1);
      }
      ownerByName.set(spec.name, c.id);
      commands.push(toDiscordSchema(spec));
    }
  }

  const url = guildId
    ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${guildId}/commands`
    : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;

  const scope = guildId ? `guild ${guildId}` : 'GLOBAL (1-hour propagation)';
  console.log(`publish-commands: registering ${commands.length} commands → ${scope}`);
  for (const cmd of commands) {
    const owner = ownerByName.get(cmd.name) ?? 'unknown';
    console.log(`  · /${cmd.name} (${owner}) — ${cmd.description}`);
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

function toDiscordSchema(spec: SlashCommandSpec): DiscordCommandSchema {
  return {
    name: spec.name,
    description: spec.description,
    options: spec.options ?? [],
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
