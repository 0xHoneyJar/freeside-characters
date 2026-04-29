/**
 * Mibera Codex prelude — loaded into Ruggy's system prompt as ambient
 * environment knowledge. Per operator directive 2026-04-28: ruggy is
 * the bookkeeper + lore-keeper for the codex; should be aware of it
 * always, not just on lookup.
 *
 * V1: load llms.txt verbatim (~2k tokens) — lightweight, works today.
 * V2: build construct-mibera-codex MCP for deep queries (lookup_lore /
 *     get_archetype / get_trait / etc).
 *
 * Source: 0xHoneyJar/construct-mibera-codex/llms.txt
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to local copy of llms.txt — synced from construct-mibera-codex repo.
// At runtime, look in two places: bundled with the bot, OR fall back to
// the operator's local construct-mibera-codex checkout.
const BUNDLED_PATH = resolve(__dirname, 'codex-llms.txt');
const FALLBACK_PATH = resolve(
  process.env.HOME ?? '~',
  'Documents/GitHub/construct-mibera-codex/llms.txt',
);

let cached: string | null = null;

export function loadCodexPrelude(): string {
  if (cached !== null) return cached;

  try {
    cached = readFileSync(BUNDLED_PATH, 'utf8');
    return cached;
  } catch {
    // bundled copy not present — try operator fallback
  }

  try {
    cached = readFileSync(FALLBACK_PATH, 'utf8');
    return cached;
  } catch {
    // codex unavailable — degrade gracefully
    cached = CODEX_FALLBACK;
    return cached;
  }
}

/**
 * Minimal fallback if neither codex copy is reachable. Keeps ruggy's
 * lore-awareness from collapsing entirely; he just knows less.
 */
const CODEX_FALLBACK = `# Mibera Codex (fallback summary — full codex unavailable at runtime)

10,000 time-travelling Rebased Retard Beras carrying the eternal flame of the Rave.
Mibera is the shadow side of Milady — the ravepill, sweaty filthy reality of the
dance floor.

The 4 archetypes (rave tribes / cultural lineages):
- Freetekno
- Milady
- Chicago Detroit
- Acidhouse

Mysticism: 33 ancestors · 78 drugs · 78 tarot cards · drug-tarot mapping ·
astrology overlays · 4 elements (Fire/Water/Air/Earth)

Visual: 1,337+ traits across 18 subcategories · 42 hand-drawn Grails · 32
special collections · 102 vending-machine exclusives.

Signal hierarchy:
  Load-bearing (define worldview): Archetype → Ancestor → Birthday/Era
  Textural (color expression): Drug/Molecule → Tarot → Element
  Modifiers: Swag Rank → Astrology

What this codex does NOT track: ownership, wallets, transfers, on-chain state,
prices. Those are score-mibera's job. Ruggy bridges the two.
`;

export function getCodexLineCount(): number {
  return loadCodexPrelude().split('\n').length;
}
