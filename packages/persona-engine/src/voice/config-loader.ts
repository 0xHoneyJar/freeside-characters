/**
 * Voice config loader — reads `voice.config.yaml` at repo root,
 * validates via Zod, caches per-process.
 *
 * Operator workflow:
 *   1. Copy voice.config.yaml.example → voice.config.yaml
 *   2. Edit per-character weight distributions
 *   3. Restart the bot (or wait for next process spawn) — the cache
 *      is per-process, no hot-reload (deliberate: variance comes from
 *      the sampler, not the config · operators don't want their
 *      weights mid-flight-mutating in production).
 *
 * Failure modes (all soft · no crash):
 *   - File missing → return empty map, defaults apply (silent)
 *   - File present but parse error → stderr warn, return empty map
 *   - Schema validation fails → stderr warn with Zod issue summary,
 *     return empty map
 *
 * The loader is intentionally simple — no env-var fallback, no
 * per-character file split, no JSON pointer. One YAML file at the
 * repo root. If the operator wants to extend this surface, the
 * VoiceWeightsSchema validates a TYPED schema · we can wire a more
 * sophisticated loader later without changing the call site contract.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { VoiceWeightsSchema, type VoiceWeights } from './grimoire.ts';

const CONFIG_FILENAME = 'voice.config.yaml';

let cache:
  | { kind: 'unloaded' }
  | { kind: 'loaded'; map: Record<string, VoiceWeights> } = { kind: 'unloaded' };

/**
 * Repo-root discovery: walk up from `cwd` looking for the config file.
 * Capped at 6 levels to avoid runaway. Returns null if not found.
 */
function findConfigFile(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function loadOnce(): Record<string, VoiceWeights> {
  const path = findConfigFile();
  if (!path) return {};

  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    console.warn(`[voice-config] failed to read ${path}: ${(err as Error).message} · defaults apply`);
    return {};
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    console.warn(`[voice-config] YAML parse error in ${path}: ${(err as Error).message} · defaults apply`);
    return {};
  }

  // The YAML root has a `voice:` wrapper · pull per-character maps out.
  const voiceSection = (parsed as { voice?: Record<string, unknown> } | null)?.voice;
  if (!voiceSection || typeof voiceSection !== 'object') {
    return {};
  }

  const out: Record<string, VoiceWeights> = {};
  for (const [characterId, weights] of Object.entries(voiceSection)) {
    const result = VoiceWeightsSchema.safeParse(weights);
    if (!result.success) {
      console.warn(
        `[voice-config] invalid weights for character '${characterId}' in ${path}: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')} · defaults apply for this character`,
      );
      continue;
    }
    if (result.data) {
      out[characterId] = result.data;
    }
  }
  console.log(
    `[voice-config] loaded ${Object.keys(out).length} character weight map(s) from ${path}`,
  );
  return out;
}

/**
 * Get per-character voice weights map · cached per-process. Returns
 * empty object if no config file or all entries failed validation;
 * caller's sampler falls back to DEFAULT_VOICE_WEIGHTS in that case.
 */
export function getVoiceWeights(): Record<string, VoiceWeights> {
  if (cache.kind === 'unloaded') {
    cache = { kind: 'loaded', map: loadOnce() };
  }
  return cache.map;
}

/** Get weights for a specific character · undefined when no override. */
export function getVoiceWeightsFor(characterId: string): VoiceWeights | undefined {
  return getVoiceWeights()[characterId];
}

/** Exposed for tests · reset cache between scenarios. */
export function _resetVoiceConfigCache(): void {
  cache = { kind: 'unloaded' };
}
