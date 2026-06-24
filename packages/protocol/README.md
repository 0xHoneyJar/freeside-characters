# @freeside-characters/protocol

Sealed-schema sub-package per [[loa-org-naming-conventions]] doctrine. Lives at `packages/protocol/` to match the `freeside-*` module convention (parallel to `loa-freeside/themes/sietch/src/packages/core/protocol/`).

## Status

**Empty placeholder.** Ruggy is a CONSUMER of [[score-vault]] schemas (`ZoneDigest`, `RawStats`, `NarrativeShape`). It doesn't publish schemas of its own.

Local mirror types live in `packages/persona-engine/src/score/types.ts` until score-vault repo ships and we can `import { ZoneDigest } from '@score-vault/ports'`.

## Future schemas

If Ruggy ever publishes schemas itself, they go here. Candidates:

- **`ChannelConfig`** — per-Discord-guild config (cadence, channel ID, persona overrides) when ruggy is multi-guild deployed
- **`DigestPostMeta`** — metadata about each digest post for downstream analytics (delivery time, embed shape, summary hash)
- **`PersonaOverride`** — per-instance persona tweaks (e.g., a `freeside-characters-test` runs a softer persona variant)
- **`SiblingRegistry`** — when sibling persona-layer bots coordinate (one ruggy, one different character, both posting to the same guild) — registry of who-posts-where to prevent overlap

None of these exist today because the current shape is single-guild + single-persona + stateless (state lives in score-mcp, midi_profiles, and `.run/` jsonl caches).

## Conventions

- TypeScript types + Zod runtime validators (parallel pattern)
- JSON Schema fixtures in `packages/protocol/fixtures/` if multi-language consumers ever appear
- semver — major bumps signal breaking schema change
- never delete; always supersede via the [[supersession contract]]
