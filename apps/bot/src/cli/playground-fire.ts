#!/usr/bin/env bun
/**
 * playground-fire — cycle-007 S8 kitchen runner.
 *
 * Fires a chosen orchestrator with stubbed score-mcp + stubbed voice, captures
 * the composed result + the trace envelopes emitted during the run, persists
 * everything to `.run/playground/<run_id>.json` for the dashboard to read.
 *
 * Designed to be spawned by `scripts/dashboard.ts::POST /api/playground/fire`.
 *
 * Usage:
 *   bun run apps/bot/src/cli/playground-fire.ts \
 *     --run-id <hex> --post-type <type> --zone <zone> [--live] [--character <id>]
 *
 *   --live          Use real score-mcp + LLM (requires MCP_KEY + provider env).
 *                   Default: STUB_MODE + LLM_PROVIDER=stub (zero cost, deterministic).
 *   --character     Default 'ruggy'.
 *
 * Exit codes:
 *   0  success — playground run JSON written, full path printed to stdout
 *   1  validation failure (bad args)
 *   2  runtime failure (orchestrator threw, persisted with error: field)
 */

import {
  loadConfig,
  composeForCharacter,
  POST_TYPE_SPECS,
  type PostType,
  type ZoneId,
  ZONE_REGISTRY,
} from '@freeside-characters/persona-engine';
import {
  fetchRecentBadges,
  generateStubRecentBadges,
} from '@freeside-characters/persona-engine/score/client';
import type { GetRecentBadgesResponse } from '@freeside-characters/persona-engine/score/index';
import { loadCharacter } from '../character-loader.ts';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PLAYGROUND_DIR = resolve(process.cwd(), '.run', 'playground');
const TRACE_FILE = resolve(process.cwd(), 'apps', 'bot', '.run', 'llm-trace.jsonl');

// All cron-routable PostTypes the playground exposes. Chat-reply is intentionally
// excluded — it's the chat-mode orchestrator with different invariants and lives
// behind a slash-command/messageCreate path.
const KITCHEN_POST_TYPES = [
  'digest',
  'micro',
  'lore_drop',
  'question',
  'weaver',
  'callout',
  'recent_badges', // synthetic exhibit · issue #83 first surface (no orchestrator yet)
] as const;
type KitchenPostType = (typeof KITCHEN_POST_TYPES)[number];

interface PlaygroundRun {
  readonly run_id: string;
  readonly started_at: string;
  readonly completed_at: string;
  readonly duration_ms: number;
  readonly inputs: {
    readonly post_type: KitchenPostType;
    readonly zone: ZoneId;
    readonly character_id: string;
    readonly mode: 'stub' | 'live';
  };
  readonly result:
    | {
        readonly kind: 'compose';
        readonly post_type: PostType;
        readonly zone: ZoneId;
        readonly voice: string;
        readonly payload: unknown;
        readonly digest_window_event_count: number;
      }
    | {
        readonly kind: 'recent_badges';
        readonly badges: GetRecentBadgesResponse;
        readonly draft_voice: string;
      }
    | {
        readonly kind: 'skipped';
        readonly reason: string;
      }
    | null;
  readonly traces: ReadonlyArray<Record<string, unknown>>;
  readonly error: string | null;
}

interface ParsedArgs {
  readonly runId: string;
  readonly postType: KitchenPostType;
  readonly zone: ZoneId;
  readonly character: string;
  readonly live: boolean;
}

function fail(message: string, code = 1): never {
  console.error(`playground-fire: ${message}`);
  process.exit(code);
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--live') {
      args.live = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }

  const runId = String(args['run-id'] ?? '');
  if (!/^[a-z0-9-]{6,64}$/.test(runId)) {
    fail(`--run-id must match /^[a-z0-9-]{6,64}$/ (got: "${runId}")`);
  }

  const postType = String(args['post-type'] ?? 'digest') as KitchenPostType;
  if (!KITCHEN_POST_TYPES.includes(postType)) {
    fail(
      `--post-type must be one of: ${KITCHEN_POST_TYPES.join(', ')} (got: "${postType}")`,
    );
  }

  const zone = String(args.zone ?? 'el-dorado') as ZoneId;
  if (!Object.keys(ZONE_REGISTRY).includes(zone)) {
    fail(
      `--zone must be one of: ${Object.keys(ZONE_REGISTRY).join(', ')} (got: "${zone}")`,
    );
  }

  const character = String(args.character ?? 'ruggy');
  if (!/^[a-z0-9-]{1,32}$/.test(character)) {
    fail(`--character must match /^[a-z0-9-]{1,32}$/ (got: "${character}")`);
  }

  return {
    runId,
    postType,
    zone,
    character,
    live: args.live === true,
  };
}

/**
 * Read llm-trace.jsonl tail and return rows emitted at-or-after `since`.
 * Best-effort — playground is read-after-write, no guarantee every trace
 * landed before this returns (fsync is not held by appendTraceEntry).
 */
function readTracesSince(since: number): ReadonlyArray<Record<string, unknown>> {
  if (!existsSync(TRACE_FILE)) return [];
  const text = readFileSync(TRACE_FILE, 'utf-8');
  const out: Array<Record<string, unknown>> = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      const at = row.emitted_at ?? row.at;
      if (typeof at === 'string') {
        const t = Date.parse(at);
        if (!Number.isNaN(t) && t >= since) out.push(row);
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

async function runCompose(parsed: ParsedArgs, character: ReturnType<typeof loadCharacter>) {
  const config = loadConfig();
  const result = await composeForCharacter(
    config,
    character,
    parsed.zone,
    parsed.postType as PostType,
  );
  if (!result) {
    return {
      kind: 'skipped' as const,
      reason: `data didn't fit ${POST_TYPE_SPECS[parsed.postType as PostType]?.description ?? parsed.postType}`,
    };
  }
  const eventCount =
    (result.digest.raw_stats as { events_in_window?: number })?.events_in_window ?? 0;
  return {
    kind: 'compose' as const,
    post_type: result.postType,
    zone: result.zone,
    voice: result.voice,
    payload: result.payload,
    digest_window_event_count: eventCount,
  };
}

async function runRecentBadges(parsed: ParsedArgs): Promise<{
  kind: 'recent_badges';
  badges: GetRecentBadgesResponse;
  draft_voice: string;
}> {
  // V1 exhibit: pull stub or live data, format a simple narrative template.
  // No orchestrator yet — the playground IS the iteration surface where the
  // operator decides what the orchestrator should look like.
  //
  // 2026-05-17 operator iteration: live mode wired to real score-mcp via
  // fetchRecentBadges. Production tool returns real earnings · path B (gateway
  // route is per-LLM-call · score-mcp is a separate substrate · MCP_KEY auths
  // the score-api production railway directly).
  const config = loadConfig();
  const useStub = config.STUB_MODE || !config.MCP_KEY;
  const badges: GetRecentBadgesResponse = useStub
    ? generateStubRecentBadges({ limit: 8 })
    : await fetchRecentBadges(config, { limit: 8 });
  const rarityRank: Record<string, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
  };
  // Operator iteration 2026-05-17: "says 8 new badges but only lists 3"
  // was confusing · count + listing must agree.
  // Sort by rarity DESC · render ALL earnings (up to a sensible cap).
  // Wallet display: short-hash format `0xab12…cdef`.
  const SHOW_LIMIT = Math.min(badges.earnings.length, 12);
  const sorted = [...badges.earnings].sort(
    (a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0),
  );
  const visible = sorted.slice(0, SHOW_LIMIT);
  const hidden = badges.earnings.length - SHOW_LIMIT;
  const header =
    badges.earnings.length === 1
      ? `1 new badge earned:`
      : hidden > 0
        ? `${badges.earnings.length} new badges earned · showing top ${SHOW_LIMIT} by rarity:`
        : `${badges.earnings.length} new badges earned:`;
  const lines = [
    header,
    ...visible.map(
      (b) => `· ${b.badge_name} (${b.rarity}) — ${b.wallet.slice(0, 6)}…${b.wallet.slice(-4)}`,
    ),
    parsed.zone === 'stonehenge' ? 'the leaderboard tilted today.' : '',
  ].filter(Boolean);
  void parsed; // zone is currently informational for this exhibit
  return {
    kind: 'recent_badges' as const,
    badges,
    draft_voice: lines.join('\n'),
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  // Stub by default — operator opts into --live explicitly to burn real API budget.
  if (!parsed.live) {
    process.env.STUB_MODE = 'true';
    process.env.LLM_PROVIDER = 'stub';
  }
  // Belt-and-suspenders (operator iteration 2026-05-17): the dashboard's env
  // allowlist scrubs DISCORD_* before spawn · this delete is a defense-in-depth
  // fail-closed in case anyone spawns playground-fire directly with inherited env.
  // Playground NEVER posts to a Discord channel regardless of mode.
  delete process.env.DISCORD_BOT_TOKEN;
  delete process.env.DISCORD_WEBHOOK_URL;

  if (!existsSync(PLAYGROUND_DIR)) {
    mkdirSync(PLAYGROUND_DIR, { recursive: true });
  }

  const character = loadCharacter(parsed.character);
  const startedAt = Date.now();
  const startedIso = new Date(startedAt).toISOString();

  let result: PlaygroundRun['result'] = null;
  let error: string | null = null;

  try {
    if (parsed.postType === 'recent_badges') {
      result = await runRecentBadges(parsed);
    } else {
      result = await runCompose(parsed, character);
    }
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const completedAt = Date.now();
  // Small grace window — fire-and-forget appendTraceEntry calls may still be in
  // flight when composeForCharacter resolves. Wait briefly to let them land.
  await new Promise((r) => setTimeout(r, 150));
  const traces = readTracesSince(startedAt - 1);

  const run: PlaygroundRun = {
    run_id: parsed.runId,
    started_at: startedIso,
    completed_at: new Date(completedAt).toISOString(),
    duration_ms: completedAt - startedAt,
    inputs: {
      post_type: parsed.postType,
      zone: parsed.zone,
      character_id: parsed.character,
      mode: parsed.live ? 'live' : 'stub',
    },
    result,
    traces,
    error,
  };

  const runPath = resolve(PLAYGROUND_DIR, `${parsed.runId}.json`);
  writeFileSync(runPath, JSON.stringify(run, null, 2), { mode: 0o600 });
  // Best-effort: tighten dir perms on first-write.
  try {
    if (statSync(PLAYGROUND_DIR).mode & 0o077) {
      // setting via mkdir mode is platform-dependent · noop if already tight
    }
  } catch {
    /* ignore */
  }

  console.log(runPath);
  process.exit(error ? 2 : 0);
}

main().catch((err) => {
  console.error('playground-fire: unhandled error:', err);
  process.exit(2);
});
