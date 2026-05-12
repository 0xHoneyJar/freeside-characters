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
  initGrailCache,
  isGrailCacheEnabled,
  type FireRequest,
  type CharacterConfig,
} from '@freeside-characters/persona-engine';
import { loadCharacters } from './character-loader.ts';
import {
  startInteractionServer,
  type InteractionServerHandle,
} from './discord-interactions/server.ts';
import { setQuestRuntime } from './discord-interactions/dispatch.ts';
import { buildMemoryDevQuestRuntime } from './quest-runtime-bootstrap.ts';
import {
  buildEnvTenantPgPoolFactory,
  buildProductionQuestRuntime,
  envConnectionStringSource,
} from './quest-runtime-production.ts';
import { pgPoolBuilder } from './lib/pg-pool-builder.ts';
import type { WorldManifestQuestSubset } from './world-resolver.ts';
import { publishCommands } from './lib/publish-commands.ts';

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

  // === QUEST_RUNTIME · feature-flag selection · 3-mode ============
  // Operator-authorized 2026-05-04 PM: testing in production server is OK.
  // Runtime selection composes orthogonally to staging/production:
  //
  //   QUEST_RUNTIME=disabled    backward-compat · noQuestRuntime · /quest = ephemeral
  //   QUEST_RUNTIME=memory      in-process state · QA dogfood · works in prod or staging
  //   QUEST_RUNTIME=production  real Pg pools + world-manifest source · operator-wired
  //
  // staging/production environment separation is a DIFFERENT axis (Railway
  // service environment · bot binary · DISCORD_GUILD_ID values). Memory mode
  // is environment-agnostic — works wherever the bot is deployed.
  // =================================================================
  //
  // QUEST_GUILD_ID overrides if quest substrate runs in a different guild
  // than the chat character substrate. Default: fall back to DISCORD_GUILD_ID
  // (the canonical guild env var · already set on Railway production).
  const questRuntimeMode = (process.env.QUEST_RUNTIME ?? 'disabled').trim();
  if (questRuntimeMode === 'memory') {
    const guildId = process.env.QUEST_GUILD_ID ?? process.env.DISCORD_GUILD_ID;
    const runtime = buildMemoryDevQuestRuntime({
      guildId,
      characters,
    });
    setQuestRuntime(runtime);
    const runtimeContext = `mode=memory world=mongolian guild=${guildId ?? 'unset'}`;
    console.log(
      `quest-runtime:  memory · world=${'mongolian'} · guild=${guildId ?? '(unset · /quest will return polite no-path reply)'} · ${runtimeContext}`,
    );
  } else if (questRuntimeMode === 'production') {
    // === PRODUCTION RUNTIME · cycle-B sprint-1 · B-1.8 ============
    // Composition:
    //   - world manifests: hardcoded mibera entry until B-1.12 lands the
    //     freeside-worlds registry loader. Operator extends this list as
    //     additional worlds onboard (cubquest in B-2 · others in V2).
    //   - tenant Pg pool factory: env-driven · TENANT_<TENANT>_DATABASE_URL
    //     · pools created lazily via `pg.Pool` on first access · cached
    //     for process lifetime.
    //   - catalog: defaults to memory stub (Mongolian munkh-introduction-v1)
    //     until B-1.13 lands cartridge loader. Same shape as memory-mode
    //     bootstrap — swap-in target.
    //   - resolvePlayer: defaults to anon-only (PRD D4) · auth-bridge wires
    //     verified player identity at the dispatch layer (B-1.6 ports
    //     declared · operator wires bridge call in dispatch.ts upstream).
    //
    // Per Lock-7 the production runtime composes orthogonally with
    // AUTH_BACKEND. Operator runs `QUEST_RUNTIME=production AUTH_BACKEND=anon`
    // to validate Pg path before flipping verified.
    // =================================================================
    const guildId =
      process.env.QUEST_GUILD_ID ?? process.env.DISCORD_GUILD_ID;
    const worldManifests: readonly WorldManifestQuestSubset[] = [
      {
        slug: 'mongolian',
        tenant_id: 'mibera',
        guild_ids: guildId ? [guildId] : [],
        auth: { backend: 'freeside-jwt' },
        quest_namespace: 'mongolian',
        quest_engine_config: {
          questAcceptanceMode: 'auth-required',
          submissionStyle: 'inline_thread',
          positiveFrictionDelayMs: 12000,
        },
      },
    ];

    // === FAIL-CLOSED PRECONDITION CHECK · cycle-B sprint-1 review fix ====
    // Cross-reviewer flatline (PR #53 · CRITICAL Blocker #2): production runtime
    // must NOT silently fall back to memory when TENANT_<TENANT>_DATABASE_URL
    // is unset. Lock-7 fail-closed posture: missing env at QUEST_RUNTIME=production
    // is a configuration error · throw at startup so Railway logs surface it
    // before any interaction lands.
    //
    // Each manifest with tenant_id MUST have its TENANT_<TENANT>_DATABASE_URL
    // env populated. The check runs before pool factory construction so the
    // failure is operator-readable in the boot banner.
    const requiredTenantEnvVars = worldManifests
      .filter((w) => w.tenant_id)
      .map((w) => ({
        tenant_id: w.tenant_id!,
        env_key: `TENANT_${w.tenant_id!.toUpperCase().replace(/-/g, '_')}_DATABASE_URL`,
      }));
    const missing = requiredTenantEnvVars.filter(
      ({ env_key }) => !process.env[env_key] || process.env[env_key]!.trim().length === 0,
    );
    if (missing.length > 0) {
      throw new Error(
        `QUEST_RUNTIME=production fail-closed precondition: missing env var(s) for ` +
          `tenant${missing.length > 1 ? 's' : ''} ` +
          missing.map((m) => `${m.tenant_id} (${m.env_key})`).join(', ') +
          `. Set the connection string(s) on Railway env or downgrade to ` +
          `QUEST_RUNTIME=memory for QA. Manifest source: hardcoded mibera ` +
          `entry (cycle-B B-1.12 swap target).`,
      );
    }

    const tenantPgPoolFactory = buildEnvTenantPgPoolFactory(
      pgPoolBuilder,
      envConnectionStringSource(),
    );

    const runtime = buildProductionQuestRuntime({
      worldManifests,
      characters,
      tenantPgPoolFactory,
    });
    setQuestRuntime(runtime);

    const tenantsConfigured = requiredTenantEnvVars
      .map((t) => t.tenant_id)
      .join(',') || '(none)';
    console.log(
      `quest-runtime:  production · world=mongolian · guild=${guildId ?? '(unset)'} ` +
        `· tenants_configured=${tenantsConfigured}`,
    );
  } else {
    console.log(
      `quest-runtime:  disabled · /quest returns ephemeral (set QUEST_RUNTIME=memory for QA)`,
    );
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

  // V0.7-A.4 (cycle-003): warm the grail bytes cache before the
  // interactions handler accepts traffic. Closes the ~28s cold-latency
  // gap operator-named in V0.7-A.3 dogfood (~21:08 PT 2026-05-02 ·
  // "feels a bit slow"). Boot delay acceptable per spec §2 invariant 5
  // — bounded by `concurrency` (default 5) × `timeoutMs` (default 5s)
  // × ceil(URLs / concurrency) ≤ ~10s for the V1 7-grail set; ~50s
  // worst-case for the V1.5 canonical 43.
  //
  // Failures during prefetch are logged but DON'T fail the bot — the
  // runtime cache-miss path (composeWithImage live-fetch fallback) handles
  // any URL that didn't warm. Operators can disable the cache entirely
  // via `GRAIL_CACHE_ENABLED=false` if STAMETS DIG telemetry shows CDN
  // isn't a meaningful contributor to cold latency post-deploy.
  if (isGrailCacheEnabled()) {
    try {
      const cacheResult = await initGrailCache();
      const total = cacheResult.fetched + cacheResult.failed;
      // F6 follow-up (2026-05-02): the boot log prints `N/M cached` where
      // M is the V1 subset size (7), not the canonical-43 universe.
      // Operators reading the log should know V1 conservatively prefetches
      // only the 7 verified grails; V1.5 dynamic discovery will expand
      // to the full canonical 43 when `list_archetypes` is wired.
      console.log(
        `grail-cache:    init ${cacheResult.fetched}/${total} (V1 subset) ` +
          `cached in ${cacheResult.durationMs}ms` +
          (cacheResult.failed > 0 ? ` (${cacheResult.failed} failed · live-fetch fallback)` : ''),
      );
    } catch (err) {
      // initGrailCache itself catches per-URL failures, so this is the
      // unexpected-throw path (programming error). Log + continue — the
      // bot still works without warm cache (V0.7-A.3 live-fetch behavior).
      console.warn('grail-cache: init threw unexpectedly · falling back to live-fetch:', err);
    }
  } else {
    console.log('grail-cache:    DISABLED (GRAIL_CACHE_ENABLED=false · live-fetch every call)');
  }

  // === AUTO-PUBLISH SLASH COMMANDS · on every bot start ============
  // When the bot deploys (Railway env change · git push · etc), commands
  // auto-sync with Discord. Each environment's bot syncs to its own guild
  // via DISCORD_GUILD_ID. Disable with AUTO_PUBLISH_COMMANDS=false.
  //
  // Idempotent: Discord PUT /applications/{id}/guilds/{guild}/commands
  // replaces the full set · no dupes · no leak.
  //
  // Failure mode: registration error logs but does NOT block bot startup.
  // Bot still serves existing (cached) commands until next successful sync.
  //
  // Authorized 2026-05-04 PM via /autonomous · operator framing:
  // "Can you make it so that merge code autopushes to discord?"
  // =================================================================
  const autoPublish = (process.env.AUTO_PUBLISH_COMMANDS ?? 'true').trim().toLowerCase();
  if (autoPublish !== 'false' && autoPublish !== '0' && autoPublish !== 'no') {
    try {
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const applicationId = process.env.DISCORD_APPLICATION_ID;
      const guildId = process.env.DISCORD_GUILD_ID;

      if (!botToken) {
        console.warn('auto-publish:   DISCORD_BOT_TOKEN not set · skipping command sync');
      } else {
        const results = await publishCommands({
          botToken,
          applicationId,
          guildId,
          characters,
        });
        for (const result of results) {
          console.log(
            `auto-publish:   synced ${result.registered} commands · ` +
              `${result.scope}=${result.guildId ?? '(global)'} · ` +
              `[${result.commands.map((c) => `/${c.name}`).join(' ')}]`,
          );
        }
      }
    } catch (err) {
      // Don't block bot startup on registration failure. Log and continue —
      // bot still serves the previously cached command set until next sync.
      console.error('auto-publish:   command sync failed (bot continues with cached commands):', err);
    }
  } else {
    console.log('auto-publish:   disabled via AUTO_PUBLISH_COMMANDS · skipping');
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

      const delivery = await deliverZoneDigest(config, primary, req.zone, result.payload);
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

  // V0.7-A.0: Discord Interactions endpoint for slash commands.
  // Disjoint from digest cron — failure here doesn't affect Pattern B writes.
  let interactionServer: InteractionServerHandle | null = null;
  if (config.DISCORD_PUBLIC_KEY) {
    try {
      interactionServer = startInteractionServer({ config, characters, port: config.INTERACTIONS_PORT });
      console.log(
        `interactions:   listening on :${interactionServer.port} · ` +
          `commands /${characters.map((c) => c.id).join(' /')}`,
      );
    } catch (err) {
      console.error('interactions: failed to start —', err);
      interactionServer = null;
    }
  } else {
    console.log(`interactions:   DISABLED (set DISCORD_PUBLIC_KEY to enable slash commands)`);
  }

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
    interactionServer?.stop();
    await shutdownClient();
    process.exit(0);
  }

  const shutdown = async (signal: string) => {
    console.log(`\n${primary.id}: ${signal} — shutting down`);
    handle.stop();
    interactionServer?.stop();
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
