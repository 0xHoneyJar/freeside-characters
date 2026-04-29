/**
 * Emojis — in-bot SDK MCP server (V0.5-D, refined 2026-04-29).
 *
 * Lets ruggy use the THJ guild's mibera + ruggy custom emojis. The LLM
 * can list / search / pick + render the discord-syntax string ready
 * to drop into prose.
 *
 * Variance: pick_by_mood SHUFFLES results so the model doesn't always
 * grab the same first entry. random_pick gives one random emoji
 * matching loose criteria — for when the LLM wants to express something
 * but doesn't want to deliberate.
 *
 * Use rule (from persona): emojis are EXPRESSION, not decoration.
 * - 0-1 custom emoji per post is the default
 * - DON'T repeat the same emoji across consecutive posts in a channel
 * - Use the ACTUAL Discord name (registry has real names from THJ guild)
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  EMOJIS,
  ALL_MOODS,
  pickByMood,
  findByName,
  renderEmoji,
  shuffle,
  type EmojiKind,
  type EmojiMood,
} from './registry.ts';

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

const KindSchema = z.enum(['mibera', 'ruggy']);
const MoodSchema = z.enum(ALL_MOODS as [EmojiMood, ...EmojiMood[]]);

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

export const emojisServer = createSdkMcpServer({
  name: 'emojis',
  version: '0.2.0',
  tools: [
    tool(
      'list_moods',
      'Lists all available emoji mood tags. Use this first to see what moods are available, then call pick_by_mood to get the actual emojis.',
      {},
      async () => {
        return ok({ moods: ALL_MOODS });
      },
    ),

    tool(
      'pick_by_mood',
      'Returns ONE random emoji matching a mood. Pass `mood` and optionally narrow by `kind`. Pass `scope` (typically zone name) — server auto-excludes emojis recently used in that scope. Use the returned `render` string verbatim.\n\nIMPORTANT: this returns ONE random pick, not a list. Trust the pick — do not call repeatedly looking for a "better fit". The variance IS the point.\n\nIf you want to browse all candidates instead, call `list_all` with a kind filter.',
      {
        mood: MoodSchema.describe('Mood tag to filter by'),
        kind: KindSchema.optional().describe('Optionally narrow to mibera or ruggy emojis only'),
        scope: z.string().optional().describe('Scope identifier (typically zone name) for recent-used filtering'),
        exclude_names: z.array(z.string()).optional().describe('Names to ALSO exclude beyond the auto-recent filter'),
      },
      async ({ mood, kind, scope, exclude_names }) => {
        const autoExclude = recentNames(scope);
        const manualExclude = new Set(exclude_names ?? []);
        const matches = pickByMood(mood as EmojiMood, kind as EmojiKind | undefined).filter(
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
      },
    ),

    tool(
      'random_pick',
      'Returns ONE random emoji from the catalog. AUTO-EXCLUDES emojis recently used in `scope` (typically zone name). Use this when you want expression but no specific mood — rotates the catalog naturally.',
      {
        kind: KindSchema.optional(),
        moods: z.array(MoodSchema).optional().describe('Optional mood filter — pick from these moods only'),
        scope: z.string().optional().describe('Scope identifier (typically zone name) for recent-used filtering'),
        exclude_names: z.array(z.string()).optional(),
      },
      async ({ kind, moods, scope, exclude_names }) => {
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
          return ok({ found: false, hint: 'No emoji matches the filters', recent_excluded: [...autoExclude] });
        }
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        return ok({ found: true, scope: scope ?? null, ...entryToView(pick) });
      },
    ),

    tool(
      'mark_used',
      'Records that an emoji was just used in a scope (e.g. zone name). Persists to a recent-used cache so future pick_by_mood / random_pick calls skip it. Call this AFTER you decide which emoji to use in your post — once per emoji you actually emit.',
      {
        name: z.string().describe('The emoji name you just used'),
        scope: z.string().describe('Scope (typically zone name) — should match the scope used in pick calls'),
      },
      async ({ name, scope }) => {
        const entry = findByName(name);
        if (!entry) {
          return ok({ recorded: false, hint: 'Unknown emoji name; did not record' });
        }
        appendRecent(scope, name);
        return ok({ recorded: true, scope, name });
      },
    ),

    tool(
      'render_by_name',
      'Renders a custom emoji to its discord-syntax string for inclusion in prose. Useful when you already know the name from a previous call. Names are the ACTUAL Discord guild emoji names (e.g. "ruggy_dab", "spiraling", "ackshually") — do not invent.',
      {
        name: z.string().describe('Real Discord emoji name (e.g. "ruggy_cheers", "spiraling")'),
      },
      async ({ name }) => {
        const entry = findByName(name);
        if (!entry) {
          return ok({
            found: false,
            name,
            hint: 'Unknown emoji name. Call list_moods + pick_by_mood OR random_pick to discover available emojis. Do NOT guess names.',
          });
        }
        return ok({ found: true, ...entryToView(entry) });
      },
    ),

    tool(
      'list_all',
      'Returns the FULL catalog (43 emojis). Heavy — prefer pick_by_mood / random_pick for most cases. Use only when you want to see everything available at once.',
      {
        kind: KindSchema.optional(),
      },
      async ({ kind }) => {
        const filtered = kind ? EMOJIS.filter((e) => e.kind === kind) : EMOJIS;
        return ok({
          count: filtered.length,
          emojis: filtered.map(entryToView),
        });
      },
    ),
  ],
});
