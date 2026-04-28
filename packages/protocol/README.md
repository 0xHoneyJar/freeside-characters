# @freeside-ruggy/protocol

Sealed-schema sub-package per [[loa-org-naming-conventions]] doctrine. Lives at `packages/protocol/` to match the `freeside-*` module convention (parallel to `loa-freeside/themes/sietch/src/packages/core/protocol/`).

## V1 status

**Empty placeholder.** Ruggy V1 is a CONSUMER of [[score-vault]] schemas (`ActivitySummary`, `RecentActivityResponse`). It doesn't publish schemas of its own.

Local mirror types live in `apps/bot/src/score/types.ts` until score-vault repo ships and we can `import { ActivitySummary } from '@score-vault/ports'`.

## Future schemas (V2+)

If Ruggy ever publishes schemas itself, they go here. Candidates:

- **`ChannelConfig`** — per-Discord-guild config (cadence, channel ID, persona overrides) when ruggy is multi-guild deployed
- **`DigestPostMeta`** — metadata about each digest post for downstream analytics (delivery time, embed shape, summary hash)
- **`PersonaOverride`** — per-instance persona tweaks (e.g., `freeside-ruggy-test` runs a softer persona variant)

None of these exist in V1 because V1 is single-guild + single-persona + stateless.

## Conventions

- TypeScript types + Zod runtime validators (parallel pattern)
- JSON Schema fixtures in `packages/protocol/fixtures/` if multi-language consumers ever appear
- semver — major bumps signal breaking schema change
- never delete; always supersede via the [[supersession contract]]
