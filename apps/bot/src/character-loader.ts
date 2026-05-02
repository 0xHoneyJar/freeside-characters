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
import type {
  CharacterConfig,
  EmojiAffinityKind,
  SlashCommandSpec,
} from '@freeside-characters/persona-engine';

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
  /** V0.7-A.1: per-character slash command set. Omit for default
   *  `/<id> prompt:<text> ephemeral:<bool>` (V0.7-A.0 parity). */
  slash_commands?: SlashCommandSpec[];
  /** V0.7-A.1: per-character MCP scope (digest path only). Omit for
   *  bot-wide MCP access (V0.6 parity). */
  mcps?: string[];
  /** V0.7-A.1: operator-authored tool-invocation guidance — affirmative
   *  blueprints, no fences. Substituted into the environment-context
   *  block at compose time. Optional; omit for no guidance line. */
  tool_invocation_style?: string;
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
    slash_commands: json.slash_commands,
    mcps: json.mcps,
    tool_invocation_style: json.tool_invocation_style,
  };
}

export function loadCharacters(): CharacterConfig[] {
  return selectedCharacterIds().map(loadCharacter);
}

/**
 * Default slash command for a character that doesn't declare its own.
 * Preserves the V0.7-A.0 shape (`/<id> prompt:<text> ephemeral:<bool>`)
 * routed through the `chat` handler. Lookup-friendly so dispatch + publish
 * both see the same fallback.
 */
export function defaultSlashCommands(c: CharacterConfig): SlashCommandSpec[] {
  const lower = (c.displayName ?? c.id).toLowerCase();
  return [
    {
      name: c.id,
      description: `talk to ${lower}`,
      handler: 'chat',
      options: [
        { name: 'prompt', description: `what to say to ${lower}`, type: 3, required: true },
        { name: 'ephemeral', description: 'only you see the reply', type: 5, required: false },
      ],
    },
  ];
}

/** Returns the character's declared slash commands or the V0.7-A.0 default. */
export function resolveSlashCommands(c: CharacterConfig): SlashCommandSpec[] {
  return c.slash_commands ?? defaultSlashCommands(c);
}

/**
 * Resolve which character owns a given slash command name and what handler
 * the command should route to. Returns null when no character claims the
 * name. Single-pass lookup across all characters' declared (or defaulted)
 * commands — preserves the kickoff spec's command-name → handler mapping.
 */
export function resolveSlashCommandTarget(
  commandName: string,
  characters: CharacterConfig[],
): { character: CharacterConfig; spec: SlashCommandSpec } | null {
  for (const c of characters) {
    const match = resolveSlashCommands(c).find((s) => s.name === commandName);
    if (match) return { character: c, spec: match };
  }
  return null;
}
