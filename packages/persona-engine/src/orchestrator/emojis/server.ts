/**
 * Emojis — in-bot SDK MCP server (V0.7-A.4 contract refactor).
 *
 * Lets characters use the THJ guild's mibera + ruggy custom emojis. The
 * LLM can list / search / pick + render the discord-syntax string ready
 * to drop into prose.
 *
 * V0.7-A.4 (kickoff seed §4.2 worked example):
 *   - Tool name + description + input shape derive from `./schema.ts`
 *     contracts (single source of truth · Effect.Schema canonical).
 *   - SDK Zod registration uses the parity-checked Zod shapes from
 *     schema.ts (compile-time enforced equivalence with Effect schema).
 *   - Handler bodies stay here — they touch runtime state
 *     (recent-used cache, registry filtering, render helpers) that has
 *     no place in a contract module.
 *   - The exported `emojisServer` is the SDK instance; the exported
 *     `emojisServerContract` (schema.ts) is the manifest used by the
 *     surface-completeness + persona-tool-drift tests.
 *
 * Variance: pick_by_mood + random_pick still random-pick from candidate
 * pools so the model doesn't deliberate on a "best fit" — variance IS
 * the point. The contract describes shape; the handler describes feel.
 *
 * Use rule (from persona): emojis are EXPRESSION, not decoration.
 *   - 0-1 custom emoji per post is the default
 *   - DON'T repeat the same emoji across consecutive posts in a channel
 *   - Use the ACTUAL Discord name (registry has real names from THJ guild)
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  EMOJIS,
  ALL_MOODS,
  pickByMood,
  findByName,
  renderEmoji,
  type EmojiKind,
  type EmojiMood,
} from './registry.ts';
import {
  listMoodsContract,
  pickByMoodContract,
  randomPickContract,
  markUsedContract,
  renderByNameContract,
  listAllContract,
  listMoodsInputZod,
  pickByMoodInputZod,
  randomPickInputZod,
  markUsedInputZod,
  renderByNameInputZod,
  listAllInputZod,
} from './schema.ts';
export { emojisServerContract } from './schema.ts';

// ─── recent-used cache ───────────────────────────────────────────────
// Append-only log of emoji uses per scope (e.g. zone). Survives across
// processes — cron sweeps + digest-once CLI fires share state. Filters
// the last N uses out of pick results so the model can't repeat without
// explicitly choosing to.
//
// V0.6-A: substrate moved to packages/persona-engine. Cache path now
// resolves against process.cwd() (the runtime's working dir, typically
// apps/bot/) rather than the substrate's own location, since this is
// runtime state not engine code.

const CACHE_PATH = resolve(process.cwd(), '.run/emoji-recent.jsonl');
const RECENT_WINDOW = 6;

interface RecentEntry {
  ts: number;
  scope: string;
  name: string;
}

function readRecent(): RecentEntry[] {
  try {
    const raw = readFileSync(CACHE_PATH, 'utf8').trim();
    if (!raw) return [];
    return raw
      .split('\n')
      .map((l) => {
        try {
          return JSON.parse(l) as RecentEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is RecentEntry => e !== null);
  } catch {
    return [];
  }
}

function appendRecent(scope: string, name: string): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    appendFileSync(CACHE_PATH, JSON.stringify({ ts: Date.now(), scope, name } as RecentEntry) + '\n');
  } catch (err) {
    console.warn('[emojis] failed to write recent-used cache:', err);
  }
}

function recentNames(scope?: string): Set<string> {
  const all = readRecent();
  const filtered = scope ? all.filter((e) => e.scope === scope) : all;
  return new Set(filtered.slice(-RECENT_WINDOW).map((e) => e.name));
}

function ok(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function entryToView(e: ReturnType<typeof findByName> & {}) {
  return {
    name: e.name,
    kind: e.kind,
    moods: e.moods,
    animated: e.animated,
    visual: e.visual,
    use_when: e.use_when,
    render: renderEmoji(e),
  };
}

// ─── handlers ────────────────────────────────────────────────────────
// Exported as a named map so the boundary contract test (§4.3a) can
// invoke them directly without booting the SDK loop. The SDK tool()
// registrations below thread the same functions; single source of truth
// for both runtime and tests.
//
// Each handler takes the DECODED tool input (parsed by SDK Zod) and
// returns the SDK envelope `{ content: [{ type: 'text', text }] }`.
// Tests JSON.parse the text payload and validate against the output
// schema declared in `./schema.ts`.

async function handleListMoods() {
  return ok({ moods: ALL_MOODS });
}

async function handlePickByMood(args: {
  mood: EmojiMood;
  kind?: EmojiKind;
  scope?: string;
  exclude_names?: string[];
}) {
  const { mood, kind, scope, exclude_names } = args;
  const autoExclude = recentNames(scope);
  const manualExclude = new Set(exclude_names ?? []);
  const matches = pickByMood(mood, kind).filter(
    (e) => !autoExclude.has(e.name) && !manualExclude.has(e.name),
  );
  if (matches.length === 0) {
    return ok({
      found: false,
      mood,
      kind: kind ?? 'any',
      scope: scope ?? null,
      recent_excluded: [...autoExclude],
      hint: 'No emoji matches the filters; try a different mood or use random_pick',
    });
  }
  const pick = matches[Math.floor(Math.random() * matches.length)]!;
  return ok({
    found: true,
    mood,
    scope: scope ?? null,
    recent_excluded: [...autoExclude],
    pool_size: matches.length,
    ...entryToView(pick),
  });
}

async function handleRandomPick(args: {
  kind?: EmojiKind;
  moods?: EmojiMood[];
  scope?: string;
  exclude_names?: string[];
}) {
  const { kind, moods, scope, exclude_names } = args;
  const autoExclude = recentNames(scope);
  const manualExclude = new Set(exclude_names ?? []);
  const moodSet = moods ? new Set(moods) : null;
  const pool = EMOJIS.filter(
    (e) =>
      !autoExclude.has(e.name) &&
      !manualExclude.has(e.name) &&
      (kind ? e.kind === kind : true) &&
      (moodSet ? e.moods.some((m) => moodSet.has(m)) : true),
  );
  if (pool.length === 0) {
    return ok({
      found: false,
      hint: 'No emoji matches the filters',
      recent_excluded: [...autoExclude],
    });
  }
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  return ok({ found: true, scope: scope ?? null, ...entryToView(pick) });
}

async function handleMarkUsed(args: { name: string; scope: string }) {
  const { name, scope } = args;
  const entry = findByName(name);
  if (!entry) {
    return ok({ recorded: false, hint: 'Unknown emoji name; did not record' });
  }
  appendRecent(scope, name);
  return ok({ recorded: true, scope, name });
}

async function handleRenderByName(args: { name: string }) {
  const { name } = args;
  const entry = findByName(name);
  if (!entry) {
    return ok({
      found: false,
      name,
      hint: 'Unknown emoji name. Call list_moods + pick_by_mood OR random_pick to discover available emojis. Do NOT guess names.',
    });
  }
  return ok({ found: true, ...entryToView(entry) });
}

async function handleListAll(args: { kind?: EmojiKind }) {
  const filtered = args.kind ? EMOJIS.filter((e) => e.kind === args.kind) : EMOJIS;
  return ok({
    count: filtered.length,
    emojis: filtered.map(entryToView),
  });
}

export const emojisHandlers = {
  list_moods: handleListMoods,
  pick_by_mood: handlePickByMood,
  random_pick: handleRandomPick,
  mark_used: handleMarkUsed,
  render_by_name: handleRenderByName,
  list_all: handleListAll,
} as const;

export const emojisServer = createSdkMcpServer({
  name: 'emojis',
  version: '0.3.0',
  tools: [
    tool(listMoodsContract.name, listMoodsContract.description, listMoodsInputZod, handleListMoods),
    tool(pickByMoodContract.name, pickByMoodContract.description, pickByMoodInputZod, handlePickByMood),
    tool(randomPickContract.name, randomPickContract.description, randomPickInputZod, handleRandomPick),
    tool(markUsedContract.name, markUsedContract.description, markUsedInputZod, handleMarkUsed),
    tool(renderByNameContract.name, renderByNameContract.description, renderByNameInputZod, handleRenderByName),
    tool(listAllContract.name, listAllContract.description, listAllInputZod, handleListAll),
  ],
});
