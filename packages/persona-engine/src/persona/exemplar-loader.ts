/**
 * In-Context Exemplar (ICE) loader — character-aware (V0.6-A).
 *
 * Per Gemini research 2026-04-28: rule-based persona prompts trigger
 * RLHF-default-assistant register. ICE bypasses this by injecting 3-5
 * past high-quality posts into the LLM context — the model matches the
 * exemplars' token-probability distribution rather than following rules.
 *
 * V0.6-A: exemplars dir is per-character (CharacterConfig.exemplarsDir).
 * Cache key includes character id. If a character has no exemplarsDir,
 * ICE is skipped (rule-based guidance only).
 *
 * Layout convention: `<exemplarsDir>/<post_type>/*.md`
 * Empty folder = ICE skipped for that type (falls back to rule-based).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PostType } from '../compose/post-types.ts';
import type { CharacterConfig } from '../types.ts';

const DEFAULT_MAX_EXEMPLARS = 5;

export interface Exemplar {
  /** filename slug (e.g., "2026-04-28-stonehenge-real") */
  slug: string;
  /** body text (frontmatter stripped) */
  body: string;
}

const cache = new Map<string, Exemplar[]>();

function cacheKey(characterId: string, postType: PostType): string {
  return `${characterId}::${postType}`;
}

/**
 * Load all exemplars for a given character + post type from disk.
 * Cached after first call; restart bot to reload.
 */
export function loadExemplars(character: CharacterConfig, postType: PostType): Exemplar[] {
  const key = cacheKey(character.id, postType);
  if (cache.has(key)) return cache.get(key)!;

  if (!character.exemplarsDir) {
    cache.set(key, []);
    return [];
  }

  const dir = join(character.exemplarsDir, postType);
  let files: string[];
  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) {
      cache.set(key, []);
      return [];
    }
    files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.') && f !== 'README.md');
  } catch {
    cache.set(key, []);
    return [];
  }

  const exemplars: Exemplar[] = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const raw = readFileSync(join(dir, filename), 'utf8');
    return {
      slug,
      body: stripFrontmatter(raw).trim(),
    };
  });

  cache.set(key, exemplars);
  return exemplars;
}

/**
 * Pick up to N exemplars for ICE injection. Random selection when more
 * than N available — variety across calls keeps the model from
 * over-fitting to a specific exemplar's quirks.
 */
export function selectExemplars(
  character: CharacterConfig,
  postType: PostType,
  max: number = DEFAULT_MAX_EXEMPLARS,
): Exemplar[] {
  const all = loadExemplars(character, postType);
  if (all.length <= max) return all;

  // Fisher-Yates shuffle, take first N
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, max);
}

/**
 * Build the ICE block for injection into the system prompt. Returns
 * empty string if no exemplars exist for the character + post type.
 */
export function buildExemplarBlock(character: CharacterConfig, postType: PostType): string {
  const exemplars = selectExemplars(character, postType);
  if (exemplars.length === 0) return '';

  const numbered = exemplars
    .map((ex, i) => `── EXEMPLAR ${i + 1} (${ex.slug}) ──\n${ex.body}`)
    .join('\n\n');

  const label = character.displayName ?? character.id;

  return [
    `═══ VOICE EXEMPLARS — past ${label} posts in the voice we want ═══`,
    'These are REAL past posts. You are writing in this voice. Match the',
    'cadence, register, and rhythm — NOT the specific content. The voice is',
    'in HOW these read; your job is to write a NEW post about the data below',
    'in the same way these were written.',
    '',
    numbered,
    '',
    '═══ END EXEMPLARS ═══',
  ].join('\n');
}

/** Strip optional `--- ... ---` YAML frontmatter from an exemplar file. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---\n')) return raw;
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return raw;
  return raw.slice(end + 5);
}

export function exemplarStats(character: CharacterConfig): Record<PostType, number> {
  const types: PostType[] = ['digest', 'micro', 'weaver', 'lore_drop', 'question', 'callout'];
  return Object.fromEntries(types.map((t) => [t, loadExemplars(character, t).length])) as Record<PostType, number>;
}
