/**
 * freeside-characters bot — entry point.
 *
 * V0.6-A pipeline (substrate split — system-agent layer extracted to
 * @freeside-characters/persona-engine):
 *   1. Load runtime config + selected characters from `apps/character-<id>`
 *   2. (If DISCORD_BOT_TOKEN) Login to Discord
 *   3. Schedule three cadences (digest backbone + pop-in random +
 *      weaver weekly) via substrate's `schedule()`
 *   4. On fire: composeForCharacter(config, character, zone, postType)
 *      → deliverZoneDigest(config, zone, payload)
 *   5. Stay up (or exit if cadence=manual)
 *
 * Multi-character routing (V0.6-D): for now the bot dispatches all fires
 * through the FIRST loaded character (V0.5-E parity). When V0.6-D lands
 * the router will pick a character per fire from affinity + mention.
 */

import {
  loadConfig,
  selectedZones,
  getZoneChannelId,
  composeForCharacter,
  schedule,
  deliverZoneDigest,
  getBotClient,
  shutdownClient,
  exemplarStats,
  loadSystemPrompt,
  ZONE_FLAVOR,
  getWindowEventCount,
  getCodexLineCount,
  type FireRequest,
  type CharacterConfig,
} from '@freeside-characters/persona-engine';
import { loadCharacters } from './character-loader.ts';

const banner = `─── freeside-characters bot · v0.6.0-A ────────────────────────`;

async function main(): Promise<void> {
  const config = loadConfig();
  const characters = loadCharacters();
  if (characters.length === 0) {
    console.error('bot: no characters loaded — set CHARACTERS env or ensure apps/character-ruggy/ exists');
    process.exit(1);
  }
  // V0.6-A: route everything through the primary (first) character. V0.6-D
  // will introduce per-fire character selection via affinity + mentions.
  const primary = characters[0]!;

  console.log(banner);
  console.log(`characters:     ${characters.map((c) => c.displayName ?? c.id).join(' · ')} (primary: ${primary.id})`);
  console.log(`data:           ${config.STUB_MODE ? 'STUB (synthetic ZoneDigest)' : 'LIVE (score-mcp)'}`);
  console.log(`llm:            ${describeLlmMode(config)}`);
  console.log(`zones:          ${selectedZones(config).map((z) => `${ZONE_FLAVOR[z].emoji} ${z}`).join(' · ')}`);
  console.log(`digest cadence: ${config.DIGEST_CADENCE}` + (config.DIGEST_CADENCE !== 'manual' ? ` · ${config.DIGEST_DAY} ${String(config.DIGEST_HOUR_UTC).padStart(2, '0')}:00 UTC` : ''));
  console.log(`pop-ins:        ${config.POP_IN_ENABLED ? `every ${config.POP_IN_INTERVAL_HOURS}h · ${config.POP_IN_PROBABILITY * 100}% chance/zone/tick` : 'disabled'}`);
  console.log(`weaver:         ${config.WEAVER_ENABLED ? `${config.WEAVER_DAY} ${String(config.WEAVER_HOUR_UTC).padStart(2, '0')}:00 UTC → ${config.WEAVER_PRIMARY_ZONE}` : 'disabled'}`);
  console.log(`delivery:       ${describeDelivery(config)}`);

  try {
    const prompt = loadSystemPrompt(primary);
    const codexLines = getCodexLineCount();
    const exemplars = exemplarStats(primary);
    const exemplarTotal = Object.values(exemplars).reduce((s, n) => s + n, 0);
    const exemplarSummary = exemplarTotal === 0
      ? 'no exemplars (ICE off — rules-only voice)'
      : Object.entries(exemplars).filter(([, n]) => n > 0).map(([t, n]) => `${t}:${n}`).join(' · ');
    console.log(`persona:        loaded (${prompt.length} chars · ${codexLines} codex lines)`);
    console.log(`exemplars:      ${exemplarSummary}`);
  } catch (err) {
    console.error('persona/codex load failed:', err);
    process.exit(1);
  }

  if (config.DISCORD_BOT_TOKEN) {
    try {
      const client = await getBotClient(config);
      if (client) {
        console.log(`discord:        bot client connected (${client.user?.tag ?? 'unknown'})`);
      }
    } catch (err) {
      console.error('discord bot client failed to connect:', err);
      process.exit(1);
    }
  }

  console.log('────────────────────────────────────────────────────────────────\n');

  const zones = selectedZones(config);

  const fireOne = async (req: FireRequest): Promise<void> => {
    const t0 = Date.now();
    console.log(`${primary.id}: fire ${req.zone}/${req.postType} at ${new Date().toISOString()}`);
    try {
      const result = await composeForCharacter(config, primary, req.zone, req.postType);
      if (!result) {
        console.log(`${primary.id}: ${req.zone}/${req.postType} skipped (data didn't fit)`);
        return;
      }
      console.log(`${primary.id}: ${req.zone}/${req.postType} composed (${getWindowEventCount(result.digest.raw_stats)} events) in ${Date.now() - t0}ms`);

      const delivery = await deliverZoneDigest(config, req.zone, result.payload);
      if (delivery.posted) {
        console.log(`${primary.id}: ${req.zone}/${req.postType} posted via ${delivery.via}` + (delivery.messageId ? ` (msg ${delivery.messageId})` : ''));
      } else if (delivery.dryRun) {
        console.log(`${primary.id}: ${req.zone}/${req.postType} dry-run (${delivery.via})`);
      }
    } catch (err) {
      console.error(`${primary.id}: ${req.zone}/${req.postType} failed:`, err);
    }
  };

  const handle = schedule({ config, zones, onFire: fireOne });
  if (handle.digestExpression) console.log(`${primary.id}: digest cron · ${handle.digestExpression}`);
  if (handle.popInExpression) console.log(`${primary.id}: pop-in cron · ${handle.popInExpression}`);
  if (handle.weaverExpression) console.log(`${primary.id}: weaver cron · ${handle.weaverExpression}`);

  // Always fire digest sweep once on boot in dev or manual
  if (config.NODE_ENV === 'development' || config.DIGEST_CADENCE === 'manual') {
    console.log(`${primary.id}: firing digest sweep once on boot (dev/manual mode)`);
    for (const zone of zones) {
      await fireOne({ zone, postType: 'digest' });
    }
  }

  if (config.DIGEST_CADENCE === 'manual') {
    console.log(`${primary.id}: manual mode — exiting after single fire`);
    handle.stop();
    await shutdownClient();
    process.exit(0);
  }

  const shutdown = async (signal: string) => {
    console.log(`\n${primary.id}: ${signal} — shutting down`);
    handle.stop();
    await shutdownClient();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function describeLlmMode(config: ReturnType<typeof loadConfig>): string {
  if (config.ANTHROPIC_API_KEY) return `anthropic-direct (${config.ANTHROPIC_MODEL})`;
  if (config.STUB_MODE) return 'STUB (canned digest)';
  if (config.FREESIDE_API_KEY) return `freeside agent-gw (${config.FREESIDE_AGENT_MODEL})`;
  return 'UNCONFIGURED';
}

function describeDelivery(config: ReturnType<typeof loadConfig>): string {
  if (config.DISCORD_BOT_TOKEN) {
    const mapped = (['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'] as const).filter((z) =>
      getZoneChannelId(config, z),
    );
    return `BOT (${mapped.length}/4 zones mapped: ${mapped.join(', ')})`;
  }
  if (config.DISCORD_WEBHOOK_URL) {
    return `WEBHOOK (${config.DISCORD_WEBHOOK_URL.slice(0, 50)}...)`;
  }
  return 'DRY-RUN (stdout)';
}

main().catch((err) => {
  console.error('bot: fatal:', err);
  shutdownClient().finally(() => process.exit(1));
});
