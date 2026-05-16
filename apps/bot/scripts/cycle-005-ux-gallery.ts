#!/usr/bin/env bun
/**
 * cycle-005 UX gallery — the missing "what does ruggy ACTUALLY look like".
 *
 * Authored 2026-05-16 in response to the operator's "i want to nitpick the
 * UX for ruggy because there's alot we should be surfacing which i'm not
 * seeing in the chats" message. The autonomous-run E2E proved the pipeline
 * shape but never SHOWED what a real post looks like.
 *
 * This script:
 *   1. fetches REAL prod factor_stats for all 3 dim-channel zones (window=30)
 *   2. calls Claude SDK to generate the actual voice header + outro per
 *      the cycle-005 voice-brief (T2.4 · the missing piece) — ONLY if
 *      ANTHROPIC_API_KEY is set; otherwise uses canned fallback
 *   3. composes via composeDigestForZone with REAL voice
 *   4. renders the FULL Discord-formatted post (content + embed)
 *   5. simulates mobile word-wrap (~40 chars in code blocks)
 *   6. shows both the dominant REAL state (shape A at current volume) AND
 *      a synthetic shape-C "what if activity ramps" scenario
 *
 * NO Discord delivery. Pure rendering for visual inspection.
 *
 * Run:
 *   SCORE_API_URL=https://score-api-production.up.railway.app \
 *   MCP_KEY=... \
 *   ANTHROPIC_API_KEY=sk-... \
 *   bun run apps/bot/scripts/cycle-005-ux-gallery.ts
 */

// Note: @anthropic-ai/claude-agent-sdk is resolved via the persona-engine
// workspace symlink (apps/bot doesn't depend on it directly · transitive
// resolution from the symlinked workspace package).
import { query } from '../../../packages/persona-engine/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs';
import {
  composeDigestForZone,
} from '@freeside-characters/persona-engine/compose/digest';
import {
  buildVoiceBrief,
  parseVoiceResponse,
} from '@freeside-characters/persona-engine/compose/voice-brief';
import {
  appendVoiceMemory,
  readLastVoiceMemory,
  formatPriorWeekHint,
  isoWeek,
  type VoiceMemoryEntry,
} from '@freeside-characters/persona-engine/compose/voice-memory';
import { initOtelTest } from '@freeside-characters/persona-engine/observability/otel-test';
import type {
  PulseDimensionBreakdown,
  PulseDimensionFactor,
  ZoneId,
  FactorStats,
} from '@freeside-characters/persona-engine/score/types';

// ─── MCP transport (copied from S0 spike pattern) ─────────────────────

const MCP_PROTOCOL_VERSION = '2024-11-05';

async function fetchDimensions(): Promise<Map<string, PulseDimensionBreakdown>> {
  const SCORE_API_URL = process.env.SCORE_API_URL ?? 'https://score-api-production.up.railway.app';
  const MCP_KEY = process.env.MCP_KEY;
  if (!MCP_KEY) throw new Error('MCP_KEY not set');
  const url = `${SCORE_API_URL.replace(/\/$/, '')}/mcp`;
  const h = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-MCP-Key': MCP_KEY,
  };
  const initRes = await fetch(url, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'ux-gallery', version: '0' } },
    }),
  });
  const sid = initRes.headers.get('Mcp-Session-Id');
  if (!sid) throw new Error('no Mcp-Session-Id');
  await initRes.text();
  const sh = { ...h, 'Mcp-Session-Id': sid };
  await fetch(url, {
    method: 'POST',
    headers: sh,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
  });

  const out = new Map<string, PulseDimensionBreakdown>();
  let nextId = 2;
  for (const dim of ['og', 'nft', 'onchain'] as const) {
    nextId += 1;
    const r = await fetch(url, {
      method: 'POST',
      headers: sh,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: nextId,
        method: 'tools/call',
        params: { name: 'get_dimension_breakdown', arguments: { window: 30, dimension: dim } },
      }),
    });
    const body = await r.text();
    const line = body.split(/\r?\n/).find((l) => l.startsWith('data: '));
    if (!line) continue;
    const env = JSON.parse(line.slice(6));
    if (env.error) continue;
    const text = env.result?.content?.find((c: any) => c.type === 'text')?.text;
    if (!text) continue;
    const parsed = JSON.parse(text);
    const row = parsed.dimensions?.[0];
    if (row) out.set(dim, row as PulseDimensionBreakdown);
  }
  return out;
}

// ─── Voice generation (Claude SDK + canned fallback) ──────────────────

async function generateVoice(
  brief: ReturnType<typeof buildVoiceBrief>,
): Promise<{ header: string; outro: string; via: 'claude-sdk' | 'canned' }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      header: '(no api key — canned header)',
      outro: '(no api key — canned outro)',
      via: 'canned',
    };
  }
  let collected = '';
  try {
    for await (const msg of query({
      prompt: brief.user,
      options: {
        model: 'claude-sonnet-4-5',
        systemPrompt: brief.system,
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
      },
    })) {
      if (msg.type === 'assistant') {
        for (const block of msg.message?.content ?? []) {
          if (block.type === 'text') collected += block.text;
        }
      }
    }
  } catch (err) {
    return {
      header: `(sdk error: ${(err as Error).message.slice(0, 40)})`,
      outro: 'canned outro',
      via: 'canned',
    };
  }
  const parsed = parseVoiceResponse(collected);
  return { header: parsed.header, outro: parsed.outro, via: 'claude-sdk' };
}

// ─── Render layer ─────────────────────────────────────────────────────

function wrapMobile(text: string, width = 40): string {
  if (!text) return text;
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    if (line.length <= width) {
      lines.push(line);
      continue;
    }
    // word-wrap heuristic; Discord's actual algorithm is more complex (it
    // respects soft hyphens, splits at zero-width spaces, etc.) but this
    // approximates the mobile experience reasonably for visual inspection
    const words = line.split(/(\s+)/);
    let current = '';
    for (const w of words) {
      if (current.length + w.length <= width) {
        current += w;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }
  return lines.join('\n');
}

function renderPostAscii(zone: ZoneId, payload: ReturnType<typeof composeDigestForZone>['payload'], label: string): void {
  console.log('');
  console.log(`╔═══ ${label} · ${zone} ${'═'.repeat(Math.max(0, 88 - label.length - zone.length))}╗`);
  if (!payload) {
    console.log('║ <skipped · mode=skip>                                                                        ║');
    console.log(`╚${'═'.repeat(94)}╝`);
    return;
  }
  const embed = payload.embeds[0];
  console.log(`║ content.fallback: ${payload.content.slice(0, 70).padEnd(75)} ║`);
  if (embed?.description) {
    console.log('║ ─── embed.description (the voice) ─────                     ║');
    for (const ln of embed.description.split('\n')) {
      console.log(`║   ${ln.slice(0, 90).padEnd(90)} ║`);
    }
  }
  for (const field of embed?.fields ?? []) {
    console.log(`║ ─── embed.field[${field.name}] (${field.value.length}ch) ─────                ║`);
    // The field rows are joined by " · "; print one row per line for clarity
    for (const row of field.value.split(' · ')) {
      console.log(`║   ${row.slice(0, 55).padEnd(55)} ║`);
    }
  }
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝');
}

function renderMobileAscii(payload: ReturnType<typeof composeDigestForZone>['payload']): void {
  if (!payload) return;
  console.log('  📱 mobile (~40ch wrap):');
  const embed = payload.embeds[0];
  if (embed?.description) {
    console.log('  ┌─ voice ──────────────────────────────┐');
    for (const ln of wrapMobile(embed.description).split('\n')) {
      console.log(`  │ ${ln.padEnd(38)} │`);
    }
    console.log('  └──────────────────────────────────────┘');
  }
  for (const field of embed?.fields ?? []) {
    console.log(`  ┌─ ${field.name} ────────────────────────────────┐`);
    for (const row of field.value.split(' · ')) {
      for (const ln of wrapMobile(row).split('\n')) {
        console.log(`  │ ${ln.padEnd(38)} │`);
      }
    }
    console.log('  └──────────────────────────────────────┘');
  }
}

// ─── Layout-args builder (mirrors digest.ts logic) ────────────────────

function buildAllZones(
  dimensions: Map<string, PulseDimensionBreakdown>,
  scenario: 'real' | 'synthetic-hot',
): Map<ZoneId, PulseDimensionBreakdown | undefined> {
  const allZones = new Map<ZoneId, PulseDimensionBreakdown | undefined>();
  for (const zone of ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'] as ZoneId[]) {
    const dimId = zone === 'bear-cave' ? 'og' : zone === 'el-dorado' ? 'nft' : zone === 'owsley-lab' ? 'onchain' : null;
    const dim = dimId ? dimensions.get(dimId) : undefined;
    if (scenario === 'real' || !dim) {
      allZones.set(zone, dim);
    } else {
      // Synthesize hot version: bump top factor's rank to 96 + p95 reliable
      const hot: PulseDimensionBreakdown = {
        ...dim,
        top_factors: dim.top_factors.map((f, i) =>
          i === 0 && f.factor_stats
            ? {
                ...f,
                factor_stats: {
                  ...f.factor_stats,
                  magnitude: {
                    ...f.factor_stats.magnitude,
                    current_percentile_rank: 96,
                    percentiles: {
                      ...f.factor_stats.magnitude.percentiles,
                      p95: { value: 45, reliable: true },
                    },
                  },
                },
              }
            : f,
        ),
      };
      allZones.set(zone, hot);
    }
  }
  return allZones;
}

function deriveBriefInput(
  zone: ZoneId,
  dim: PulseDimensionBreakdown | undefined,
  shape: 'A-all-quiet' | 'B-one-dim-hot' | 'C-multi-dim-hot',
  isNoClaim: boolean,
  validationViolations: number,
  priorWeekHint?: string,
): Parameters<typeof buildVoiceBrief>[0] {
  if (!dim) {
    return {
      zone,
      shape: 'A-all-quiet',
      isNoClaimVariant: true,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 0,
      windowDays: 30,
      previousPeriodEvents: 0,
      priorWeekHint,
    };
  }
  const permitted = dim.top_factors
    .filter(
      (f) =>
        (f.factor_stats?.magnitude?.current_percentile_rank ?? 0) >= 90 &&
        f.factor_stats?.magnitude?.percentiles?.p95?.reliable === true,
    )
    .map((f) => ({ display_name: f.display_name, stats: f.factor_stats! }));
  return {
    zone,
    shape,
    isNoClaimVariant: isNoClaim,
    permittedFactors: permitted,
    silencedFactors: [],
    totalEvents: dim.total_events,
    windowDays: 30,
    previousPeriodEvents: dim.previous_period_events,
    priorWeekHint,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  cycle-005 UX gallery — what ruggy actually looks like');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  voice generation: ${process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4-5 (LIVE)' : 'CANNED (set ANTHROPIC_API_KEY for live)'}`);
  console.log('');

  const dimensions = await fetchDimensions();
  console.log('  fetched prod dimensions (window=30):');
  for (const [id, d] of dimensions) {
    console.log(`    · ${id}: ${d.top_factors.length} top · ${d.cold_factors.length} cold · ${d.total_events}ev`);
  }

  const otel = initOtelTest();
  const zonesToRender: ZoneId[] = ['bear-cave', 'el-dorado', 'owsley-lab'];

  // Seed last-week memory for the continuity demo (only if the file
  // doesn't already exist — preserves real history if the gallery has
  // been run before · gitignored under .run/).
  const lastWeekSeeds: Array<VoiceMemoryEntry> = [
    {
      at: '2026-05-09T00:00:00Z',
      iso_week: '2026-W19',
      zone: 'bear-cave',
      shape: 'A-all-quiet',
      header: '26 events across thirty days. the bears stir, then settle.',
      outro: 'the honey waits. see you in the deep.',
      key_numbers: { total_events: 26, previous_period_events: 30, permitted_factor_names: [] },
    },
    {
      at: '2026-05-09T00:00:00Z',
      iso_week: '2026-W19',
      zone: 'el-dorado',
      shape: 'A-all-quiet',
      header: '1236 events but no rank-90 cross. the gold scatters.',
      outro: 'the prowlers prowl. back next sunday.',
      key_numbers: { total_events: 1236, previous_period_events: 800, permitted_factor_names: [] },
    },
    {
      at: '2026-05-09T00:00:00Z',
      iso_week: '2026-W19',
      zone: 'owsley-lab',
      shape: 'A-all-quiet',
      header: '433 events past thirty days. the lab hums low.',
      outro: 'chain-actions cool. next week we check the readings.',
      key_numbers: { total_events: 433, previous_period_events: 380, permitted_factor_names: [] },
    },
  ];
  // Use a dedicated demo history path so we don't accumulate gallery noise
  // in production-bound .run/ruggy-voice-history.jsonl
  const demoHistoryPath = '/tmp/ruggy-ux-gallery-history.jsonl';
  // Reset for fresh demo run
  try {
    const { unlinkSync, existsSync: ex } = await import('node:fs');
    if (ex(demoHistoryPath)) unlinkSync(demoHistoryPath);
  } catch {
    /* ignore */
  }
  for (const e of lastWeekSeeds) {
    await appendVoiceMemory(e, { path: demoHistoryPath });
  }
  console.log('');
  console.log(`  seeded last-week voice memory at ${demoHistoryPath} (3 zones · iso_week=2026-W19)`);

  // ─── SCENARIO 1: real prod data (what ships now) WITH continuity ──
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SCENARIO 1 · REAL prod state + cross-week memory');
  console.log('  (week N references week N-1 · ruggy threads continuity)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const realAllZones = buildAllZones(dimensions, 'real');
  const thisWeek = isoWeek();
  for (const zone of zonesToRender) {
    const dimId = zone === 'bear-cave' ? 'og' : zone === 'el-dorado' ? 'nft' : 'onchain';
    const dim = dimensions.get(dimId);
    if (!dim) continue;

    // Read last week's voice memory for this zone
    const lastWeek = await readLastVoiceMemory(zone, { path: demoHistoryPath });
    const priorHint = lastWeek ? formatPriorWeekHint(lastWeek) : undefined;

    // Pre-compose to know the shape (so the voice brief can match)
    const provisional = composeDigestForZone({
      zone,
      dimension: dim,
      allZones: realAllZones,
      voice: { header: '', outro: '' },
      draft: '',
      tracer: otel.tracer,
    });

    const briefInput = deriveBriefInput(zone, dim, provisional.shape, provisional.isNoClaim, provisional.validation.violations.length, priorHint);
    const brief = buildVoiceBrief(briefInput);
    const voice = await generateVoice(brief);

    const finalResult = composeDigestForZone({
      zone,
      dimension: dim,
      allZones: realAllZones,
      voice: { header: voice.header, outro: voice.outro },
      draft: voice.header + ' ' + voice.outro,
      tracer: otel.tracer,
    });

    console.log(`\n[${zone}] shape=${finalResult.shape} · voice.via=${voice.via}`);
    if (priorHint) console.log(`  ← prior week: "${lastWeek?.header}"`);
    renderPostAscii(zone, finalResult.payload, 'desktop');
    renderMobileAscii(finalResult.payload);

    // Write this week's voice to memory (so next gallery run sees it)
    await appendVoiceMemory(
      {
        at: new Date().toISOString(),
        iso_week: thisWeek,
        zone,
        shape: finalResult.shape,
        header: voice.header,
        outro: voice.outro,
        key_numbers: {
          total_events: dim.total_events,
          previous_period_events: dim.previous_period_events,
          permitted_factor_names: briefInput.permittedFactors.map((f) => f.display_name),
        },
      },
      { path: demoHistoryPath },
    );
  }

  // ─── SCENARIO 2: synthetic-hot (what users WOULD see if activity ramps) ──
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SCENARIO 2 · SYNTHETIC ramped activity (preview · top factor rank=96 + p95 reliable)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const hotAllZones = buildAllZones(dimensions, 'synthetic-hot');
  // Only render bear-cave for shape-B/C demo (the others would be similar)
  const zone: ZoneId = 'bear-cave';
  const hotDim = hotAllZones.get(zone);
  if (hotDim) {
    const provisional = composeDigestForZone({
      zone,
      dimension: hotDim,
      allZones: hotAllZones,
      voice: { header: '', outro: '' },
      draft: '',
      tracer: otel.tracer,
    });
    const briefInput = deriveBriefInput(zone, hotDim, provisional.shape, provisional.isNoClaim, provisional.validation.violations.length);
    const brief = buildVoiceBrief(briefInput);
    const voice = await generateVoice(brief);

    const finalResult = composeDigestForZone({
      zone,
      dimension: hotDim,
      allZones: hotAllZones,
      voice: { header: voice.header, outro: voice.outro },
      draft: voice.header + ' ' + voice.outro,
      tracer: otel.tracer,
    });

    console.log(`\n[${zone}] shape=${finalResult.shape} · voice.via=${voice.via}`);
    renderPostAscii(zone, finalResult.payload, 'desktop · ramped-activity preview');
    renderMobileAscii(finalResult.payload);
  }

  // ─── OTEL trace summary ──────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  OTEL trace summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const spans = otel.getFinishedSpans();
  const rootSpans = spans.filter((s) => !s.parentSpanContext);
  console.log(`  ${rootSpans.length} chat.invoke roots · ${spans.length} total spans`);
  const eventSummary = new Map<string, number>();
  for (const root of rootSpans) {
    for (const e of root.events) {
      eventSummary.set(e.name, (eventSummary.get(e.name) ?? 0) + 1);
    }
  }
  for (const [name, count] of eventSummary) {
    console.log(`    · ${name}: ${count}x`);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  done. read both scenarios. nit-pick the voice.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('ux-gallery failed:', err);
  process.exit(1);
});
