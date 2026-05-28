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
  registerRecallWedgeDemoCommand,
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

  const hasPublishGuilds = characters.some(
    (c) => c.publishGuilds && c.publishGuilds.length > 0,
  );
  const fallbackScope = guildId ? `guild ${guildId}` : 'GLOBAL (1-hour propagation)';
  if (hasPublishGuilds) {
    console.log(
      `publish-commands: ${characters.length} characters · routing per-character publishGuilds (fallback: ${fallbackScope})`,
    );
  } else {
    const commands = buildCommandSet(characters);
    console.log(`publish-commands: registering ${commands.length} commands → ${fallbackScope}`);
    for (const cmd of commands) {
      console.log(`  · /${cmd.name} — ${cmd.description}`);
    }
  }

  try {
    const results = await publishCommands({
      botToken,
      applicationId,
      guildId,
      characters,
    });
    for (const result of results) {
      const scope = result.guildId ? `guild ${result.guildId}` : 'GLOBAL';
      console.log(`publish-commands: registered ${result.registered} commands → ${scope}`);
      for (const r of result.commands) {
        console.log(`  ✓ /${r.name} → id ${r.id}`);
      }
    }

    // Phase 39C: dev-only Recall Wedge demo registration. SEPARATE from the
    // character command publish above — it never enters buildCommandSet (so
    // it can never reach the global route). Skipped unless BOTH
    // RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS === "true" AND
    // RECALL_WEDGE_DISCORD_DEMO_GUILD_ID is set; always guild-scoped.
    const demo = await registerRecallWedgeDemoCommand({ botToken, applicationId });
    if (demo.registered) {
      console.log(
        `publish-commands: registered dev-only /recall-wedge-demo → guild ${demo.guildId} (id ${demo.command.id})`,
      );
    } else {
      console.log(
        `publish-commands: /recall-wedge-demo NOT registered (${demo.reason})`,
      );
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
