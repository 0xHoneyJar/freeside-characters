/**
 * Publish slash commands to Discord — CLI entry point.
 *
 * The actual registration logic lives in `src/lib/publish-commands.ts` so
 * it can be reused from `src/index.ts` (auto-publish on bot startup).
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
 * After 2026-05-04 the bot also auto-publishes on every startup (gated by
 * AUTO_PUBLISH_COMMANDS env, default true). This CLI tool remains for
 * ad-hoc registration during local dev or off-deploy fixes.
 */

import { loadCharacters } from '../src/character-loader.ts';
import {
  buildCommandSet,
  fetchApplicationId,
  publishCommands,
} from '../src/lib/publish-commands.ts';

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

  const commands = buildCommandSet(characters);
  const scope = guildId ? `guild ${guildId}` : 'GLOBAL (1-hour propagation)';
  console.log(`publish-commands: registering ${commands.length} commands → ${scope}`);
  for (const cmd of commands) {
    console.log(`  · /${cmd.name} — ${cmd.description}`);
  }

  try {
    const result = await publishCommands({
      botToken,
      applicationId,
      guildId,
      characters,
    });
    console.log(`publish-commands: registered ${result.registered} commands successfully`);
    for (const r of result.commands) {
      console.log(`  ✓ /${r.name} → id ${r.id}`);
    }
  } catch (err) {
    console.error('publish-commands: FAILED');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('publish-commands: fatal:', err);
  process.exit(1);
});
