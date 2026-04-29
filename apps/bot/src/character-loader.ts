/**
 * character-loader — reads `apps/character-<id>` directories, produces
 * CharacterConfig values the substrate consumes.
 *
 * Civic-layer note: the BOT loads characters; the SUBSTRATE doesn't know
 * about filesystem layout. Characters are participation agents whose
 * identity lives in `apps/character-<id>/character.json` + persona.md +
 * exemplars/. The substrate accepts CharacterConfig at boot and never
 * touches the filesystem to discover characters.
 *
 * Selection: CHARACTERS env (comma-separated). Default: 'ruggy'.
 *   CHARACTERS=ruggy            single character (V0.5-E parity)
 *   CHARACTERS=ruggy,satoshi    multi-character (V0.6-C onward)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterConfig, EmojiAffinityKind } from '@freeside-characters/persona-engine';

interface CharacterJson {
  id: string;
  displayName?: string;
  personaFile: string;
  exemplarsDir?: string;
  emojiAffinity?: {
    primary?: EmojiAffinityKind;
    fallback?: EmojiAffinityKind;
  };
  /** V0.6-D: HTTPS URL for per-message webhook avatar override (Pattern B). */
  webhookAvatarUrl?: string;
  /** V0.6-D: per-message webhook username override (defaults to displayName ?? id). */
  webhookUsername?: string;
  /** V0.6-D voice/v4: anchored cabal archetypes (1-2 per character). */
  anchoredArchetypes?: string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/bot/src/ → apps/ via ../..
const APPS_DIR = resolve(__dirname, '../..');

export function selectedCharacterIds(): string[] {
  const env = process.env.CHARACTERS;
  if (!env || env.trim() === '') return ['ruggy'];
  return env.split(',').map((s) => s.trim()).filter(Boolean);
}

export function loadCharacter(id: string): CharacterConfig {
  const charDir = resolve(APPS_DIR, `character-${id}`);
  const configPath = resolve(charDir, 'character.json');
  if (!existsSync(configPath)) {
    throw new Error(
      `character-loader: ${configPath} not found. Did you create apps/character-${id}/character.json?`,
    );
  }
  const raw = readFileSync(configPath, 'utf8');
  const json = JSON.parse(raw) as CharacterJson;
  if (json.id !== id) {
    throw new Error(
      `character-loader: id mismatch — config says "${json.id}" but folder is "character-${id}"`,
    );
  }
  return {
    id: json.id,
    displayName: json.displayName,
    personaPath: resolve(charDir, json.personaFile),
    exemplarsDir: json.exemplarsDir ? resolve(charDir, json.exemplarsDir) : undefined,
    emojiAffinity: json.emojiAffinity,
    webhookAvatarUrl: json.webhookAvatarUrl,
    webhookUsername: json.webhookUsername,
    anchoredArchetypes: json.anchoredArchetypes as CharacterConfig['anchoredArchetypes'],
  };
}

export function loadCharacters(): CharacterConfig[] {
  return selectedCharacterIds().map(loadCharacter);
}
