/**
 * digest-once — fire one sweep and exit.
 *
 * V0.6-A: routes through @freeside-characters/persona-engine substrate
 * with the primary character (CHARACTERS env, default 'ruggy').
 *
 * Modes:
 *   default                              → digest type for each zone
 *   POST_TYPE=micro|weaver|lore_drop|... → that type for each zone
 *   MIX=true                             → random non-digest type per zone (the arcade move)
 *
 * Filter zones via the ZONES env var:
 *   ZONES=stonehenge bun run digest:once
 *   ZONES=bear-cave,el-dorado bun run digest:once
 */

import {
  loadConfig,
  selectedZones,
  composeForCharacter,
  deliverZoneDigest,
  getBotClient,
  shutdownClient,
  ZONE_FLAVOR,
  getWindowEventCount,
  getWindowWalletCount,
  POST_TYPE_SPECS,
  type PostType,
} from '@freeside-characters/persona-engine';
import { loadCharacters } from '../character-loader.ts';

const POP_IN_TYPES: PostType[] = ['micro', 'lore_drop', 'question', 'callout'];

function pickType(config: ReturnType<typeof loadConfig>): PostType | 'mix' {
  if (config.MIX) return 'mix';
  return config.POST_TYPE ?? 'digest';
}

function rollMixType(): PostType {
  return POP_IN_TYPES[Math.floor(Math.random() * POP_IN_TYPES.length)] ?? 'micro';
}

async function main(): Promise<void> {
  const config = loadConfig();
  const characters = loadCharacters();
  if (characters.length === 0) {
    console.error('digest-once: no characters loaded — set CHARACTERS env or ensure apps/character-ruggy/ exists');
    process.exit(1);
  }
  const primary = characters[0]!;
  const zones = selectedZones(config);
  const typeMode = pickType(config);

  const llmMode = config.VOICE_DISABLED
    ? 'VOICE_DISABLED (no LLM)'
    : config.ANTHROPIC_API_KEY
    ? `anthropic-direct (${config.ANTHROPIC_MODEL})`
    : config.STUB_MODE
      ? 'STUB (canned)'
      : config.FREESIDE_API_KEY
        ? `freeside (${config.FREESIDE_AGENT_MODEL})`
        : 'UNCONFIGURED';

  const deliveryMode = config.DISCORD_BOT_TOKEN
    ? 'BOT'
    : config.DISCORD_WEBHOOK_URL
      ? 'WEBHOOK'
      : 'DRY-RUN';

  console.log(`${primary.id}: digest-once · firing immediately`);
  console.log(`data: ${config.STUB_MODE ? 'STUB' : 'LIVE'} · llm: ${llmMode} · delivery: ${deliveryMode}`);
  console.log(`mode: ${typeMode === 'mix' ? 'MIX (random non-digest per zone)' : typeMode}`);
  console.log(`zones: ${zones.map((z) => `${ZONE_FLAVOR[z].emoji} ${z}`).join(' · ')}`);
  console.log();

  if (config.DISCORD_BOT_TOKEN) {
    try {
      const client = await getBotClient(config);
      if (client) console.log(`bot: connected as ${client.user?.tag ?? 'unknown'}`);
    } catch (err) {
      console.error('bot client failed:', err);
      process.exit(1);
    }
  }

  let totalMs = 0;
  let posted = 0;
  let failed = 0;
  let skipped = 0;

  for (const zone of zones) {
    const postType = typeMode === 'mix' ? rollMixType() : typeMode;
    const t0 = Date.now();
    try {
      const result = await composeForCharacter(config, primary, zone, postType);
      if (!result) {
        skipped++;
        console.log(`[${zone}/${postType}] skipped (data didn't fit ${POST_TYPE_SPECS[postType].description})`);
        continue;
      }

      const compMs = Date.now() - t0;
      console.log(
        `\n[${zone}/${postType}] composed in ${compMs}ms · ${getWindowEventCount(result.digest.raw_stats)} events · ${getWindowWalletCount(result.digest.raw_stats)} miberas`,
      );

      const delivery = await deliverZoneDigest(config, primary, zone, result.payload);
      if (delivery.posted) {
        posted++;
        console.log(`[${zone}/${postType}] posted via ${delivery.via}` + (delivery.messageId ? ` (msg ${delivery.messageId})` : ''));
      } else if (delivery.dryRun) {
        console.log(`[${zone}/${postType}] dry-run (${delivery.via})`);
      }

      totalMs += Date.now() - t0;
    } catch (err) {
      failed++;
      console.error(`[${zone}/${postType}] failed:`, err);
    }
  }

  console.log(`\n${primary.id}: ${zones.length} zones · ${posted} posted · ${failed} failed · ${skipped} skipped · ${totalMs}ms total`);
  await shutdownClient();
}

main().catch(async (err) => {
  console.error('digest-once failed:', err);
  await shutdownClient();
  process.exit(1);
});
