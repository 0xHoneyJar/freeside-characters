---
status: candidate
mode: dig+arch+feel
authored_by: claude opus 4.7 (1m) acting as OPERATOR + KEEPER + FEEL
authored_for: zksoju
operator_session: 2026-05-15
lenses: keeper · 3-plane · craft (ALEXANDER)
related_artifacts:
  - freeside-mediums (`@0xhoneyjar/medium-registry` v0.2.0 sprint-3 cycle R)
  - freeside-cli (zone `discord-deploy` aspirational, operator-named priority for next cycle)
  - packages/persona-engine/src/orchestrator/emojis/registry.ts (current hardcoded 43 THJ emojis)
  - packages/persona-engine/src/deliver/wardrobe-resolver.ts (existing per-character override resolver)
  - cycle-spec-ruggy-leaderboard-2026-05-15.md (sibling — consumes this schema for FR-3)
  - vault/wiki/concepts/chat-medium-presentation-boundary.md (CMP-boundary doctrine)
operator_vision_quote: |
  ideally via freeside discord module eventually it can source all of the emojis automatically and
  then it's easy for users/agents to flip through them and label them so that agents can be
  scoped/fenced to certain ones. i want to enable flexibility in the sense that we have a open
  playground where agents can evolve and have access to more capabilities within these different mediums.
expiry: until shipped or explicitly retired
---

# track · medium-registry as the emoji discovery + label + scope primitive

## tl;dr

The operator's vision (above quote): emojis (and more broadly: medium-bound
expressive primitives) should be **discovered from the medium**, **labeled by
users/agents**, and **scoped per-character** through medium-registry. Right
now, this repo hardcodes 43 THJ-guild emojis with static mood-tags in
`orchestrator/emojis/registry.ts`. The vision generalizes:

```
HARDCODED         →    DISCOVERED         →    LABELED              →    SCOPED
(today)                (Discord API)            (user/agent)              (per-character)

43 emojis in TS        guild.emojis fetch       moodTags as data,         mediumOverrides
file w/ mood-tags      → catalog capability     not as code               .emojiCatalog
+ pickByMoods          surfaced via             evolve via Discord        scope subset
function               medium-registry          slash command UI
```

This unblocks a much larger flex: every chat-medium-bound capability
(emojis, stickers, slash commands, modal shapes, embed templates) becomes a
discoverable + label-able + scope-able PRIMITIVE that any character can
introspect at runtime. Agents become **medium-aware** rather than
medium-illiterate.

This track scopes the emoji slice. Other capabilities follow the same pattern.

## current state

### where emoji lookup lives

`packages/persona-engine/src/orchestrator/emojis/registry.ts:23-580` —
hardcoded `EMOJIS: EmojiEntry[]` array with 43 entries. Each entry:

```ts
{
  id: string;              // Discord snowflake
  kind: 'mibera' | 'ruggy'; // batch — implicit per-character scope
  name: string;
  moods: EmojiMood[];      // 27-value enum, static
  visual: string;          // operator-curated visual notes
  use_when: string;        // operator-curated context
  animated: boolean;
}
```

Lookup surface: `findById` / `findByName` / `pickByMoods(moods, kind)`. The
`kind` parameter is the de-facto per-character scope ("ruggy can use mibera +
ruggy emojis; satoshi could use a separate kind").

Fetched 2026-04-29 from `GET /api/v10/guilds/1135545260538339420/emojis`. ANY
change to the THJ guild emoji set requires a re-fetch + manual TS update.

### where medium-capability lives

`@0xhoneyjar/medium-registry` v0.2.0:

- `packages/protocol/src/capability.ts` — `MediumCapability` discriminated union (Schema.Union by `_tag`)
- `packages/protocol/src/descriptors/` — const singletons: `DISCORD_WEBHOOK_DESCRIPTOR`, `DISCORD_INTERACTION_DESCRIPTOR`, `CLI_DESCRIPTOR`, etc.
- `packages/protocol/src/overrides.ts` — per-character override merging (sparse `Record<MediumId, Partial<MediumCapability>>`)
- `packages/protocol/src/accessors.ts` — `hasCapability(medium, 'embed')` style queries

The shape is established. The Discord webhook descriptor today exposes static
capability flags (embed support, attachment support, etc) but does NOT expose
the guild's emoji catalog. Adding it is additive (per architect lock A7).

### where the connection happens (today)

`packages/persona-engine/src/deliver/wardrobe-resolver.ts` already resolves
per-character medium-capability overrides at the compose boundary. It accepts
a `MediumCapabilityOverridesType` from each character's config. Right now
overrides shape stickers / brand-tokens / embed-color preferences. Adding an
`emojiCatalog` field to the override shape is the seam.

## proposal — the emoji-catalog capability

### schema additions to `@0xhoneyjar/medium-registry`

```typescript
// packages/protocol/src/descriptors/discord.ts (extension)

const EmojiLabel = Schema.Struct({
  /** Discord emoji snowflake — content-addressable id. */
  id: Schema.String,
  /** Discord emoji name. */
  name: Schema.String,
  /** Animated flag — affects render syntax (<a:name:id> vs <:name:id>). */
  animated: Schema.Boolean,
  /** Multi-label classification.
   *  Authoring source can be: hardcoded YAML (today), operator-curated
   *  via slash command (when discord-deploy zone ships), or agent-proposed
   *  via labeling action (future).
   */
  labels: Schema.Array(Schema.String),
  /** Optional context cue for LLM picking. */
  use_when: Schema.optional(Schema.String),
  /** Operator-curated visual description (for accessibility + agent grounding). */
  visual_description: Schema.optional(Schema.String),
  /** Provenance — who labeled this. Lineage matters for "agents evolve". */
  label_provenance: Schema.optional(Schema.Struct({
    source: Schema.Literal('operator', 'agent', 'community', 'discord-api'),
    timestamp: Schema.String,
    actor: Schema.optional(Schema.String),
  })),
});

const DiscordEmojiCatalog = Schema.Struct({
  /** Guild snowflake. */
  guild_id: Schema.String,
  /** Last-fetched timestamp (ISO). */
  fetched_at: Schema.String,
  /** Discovery source — operator-edited YAML, Discord API live, etc. */
  source: Schema.Literal('hardcoded', 'discord-api', 'operator-yaml'),
  /** The catalog itself. */
  emojis: Schema.Array(EmojiLabel),
});

// Extend DISCORD_WEBHOOK_DESCRIPTOR:
const DISCORD_WEBHOOK_DESCRIPTOR = Schema.Struct({
  _tag: Schema.Literal('discord_webhook'),
  // ... existing fields
  emoji_catalog: Schema.optional(DiscordEmojiCatalog),  // ← NEW
});
```

### per-character scope via existing overrides shape

```typescript
// packages/protocol/src/overrides.ts (extension)

const MediumCapabilityOverrides = Schema.Struct({
  // ... existing override fields
  /** Per-character emoji scope. When set, the character may only use
   *  emojis whose id appears in this allow-list. When unset, the character
   *  has access to the full catalog. The allow-list is by id (not name)
   *  because Discord allows duplicate names within a guild.
   */
  emojiScopeIds: Schema.optional(Schema.Array(Schema.String)),
  /** Per-character mood-label augmentation. The character may declare
   *  additional labels for specific emojis without globally affecting
   *  the catalog. Sparse map; keys are emoji ids.
   *  Example: ruggy may label "KIII" as ["soft", "warm"] in his scope,
   *  while satoshi's scope labels it as ["acknowledgment"].
   */
  emojiLabelOverrides: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) })
  ),
});
```

### consumer shape in `freeside-characters`

```typescript
// packages/persona-engine/src/orchestrator/emojis/registry.ts (refactor)

// Replace hardcoded EMOJIS array with capability-lookup:
import { resolveEmojiCatalog } from '../../deliver/wardrobe-resolver.ts';

export function findByName(name: string, character: CharacterConfig, medium: MediumCapability): EmojiEntry | null {
  const catalog = resolveEmojiCatalog(character, medium);
  return catalog?.emojis.find(e => e.name === name && isInScope(e.id, character.mediumOverrides)) ?? null;
}

export function pickByLabels(labels: string[], character: CharacterConfig, medium: MediumCapability): EmojiEntry[] {
  const catalog = resolveEmojiCatalog(character, medium);
  if (!catalog) return [];
  return catalog.emojis.filter(e =>
    isInScope(e.id, character.mediumOverrides) &&
    labels.some(l => e.labels.includes(l) || (character.mediumOverrides?.emojiLabelOverrides?.[e.id] ?? []).includes(l))
  );
}
```

Note the API shift: `kind: 'ruggy' | 'mibera'` (hardcoded enum) becomes
`character: CharacterConfig` (data-driven). Existing call sites
(`compose/reply.ts:103`, etc) update to pass `character` + the resolved medium.

## where the discovery primitive lives — freeside-cli `discord-deploy` zone

The `freeside-cli` README lists `discord-deploy` as **aspirational**, "NEW
repo needed · operator-named priority for next cycle." This is the right home
for the Discord-emoji discovery + label-edit primitives. Suggested verbs:

```
freeside discord emojis fetch <guild-id>          # GET /api/v10/guilds/{id}/emojis → cache + emit catalog
freeside discord emojis list [--scope <character>] # show current catalog (+ scope filter)
freeside discord emojis label <emoji-id> --add <label> [--source <operator|agent|community>]
freeside discord emojis scope <character> --add <emoji-id> [--remove <emoji-id>]
freeside discord emojis publish                    # validate catalog → write back into character config / medium-registry
```

Each command is `incur`-generated, so each is auto-discoverable via `--llms`,
`--mcp`, and auto-generated skill files (per the freeside-cli pattern). This
is what closes the "agents evolve" loop: agents have a typed CLI surface for
proposing label edits, scope changes, and catalog refreshes. The operator
remains the gatekeeper via the `publish` verb.

## proposed phasing

### phase 1 · ship the schema additively, no behavior change

- freeside-mediums v0.3.0 ships the `EmojiCatalog` + `MediumCapabilityOverrides.emojiScopeIds/emojiLabelOverrides` schemas
- `freeside-characters` adds a SHIM that translates the existing hardcoded `EMOJIS` array → `EmojiCatalog` shape at module load
- All existing `findByName` / `pickByMoods` callers work unchanged (`moods` becomes a special class of `labels`)
- Zero runtime behavior change; consumers can now START reading from the catalog shape

### phase 2 · per-character scope wired

- ruggy + satoshi character.json declare `mediumOverrides.emojiScopeIds`
- ruggy: 43 emojis (current full catalog) — no change
- satoshi: explicit scope of ~3-5 emojis that fit his sparse register
- runtime enforces scope; out-of-scope emoji refs trigger the existing translate-emoji-shortcodes drop pattern

### phase 3 · freeside-cli discord-deploy zone ships

- `freeside discord emojis fetch` writes the LIVE Discord guild catalog into a managed YAML at `config/medium-catalogs/discord/<guild_id>.yaml`
- the YAML becomes source of truth; the hardcoded TS array deprecates
- the cycle-spec-ruggy-leaderboard FR-3 mood-emoji rules consume the catalog labels (not hardcoded unicode)

### phase 4 · agent-proposed label edits

- a slash command + a `freeside-cli` verb let operators / users / agents propose labels
- agent-proposed labels carry `source: 'agent'` provenance; operator promotes via `publish`
- "agents evolve" loop is closed

## the mad-AI move — the medium IS the agent's body

KEEPER read of operator's vision: the agent's **body** is its medium. ruggy
without an emoji catalog is ruggy with no facial muscles. ruggy with a
labeled, scoped, discoverable catalog has expressive musculature. and ruggy
with a labeling LOOP (agent can propose; operator approves; labels evolve)
has the equivalent of muscle memory — a body that learns through use.

This is closer to the operator's "mad agent ai stuff" framing than HERALD
was. It's not about adding a character. It's about giving every character a
richer embodiment in the medium they live in. Mediums are bodies. Bodies
are made of capabilities. Capabilities are discoverable, label-able,
scope-able. Agents evolve through label propose → operator approve → body
grows.

The substrate-vs-renderer boundary (cycle-022) closed the boundary at the
DATA layer. This proposal closes it at the EXPRESSIVE layer. Together they
form a complete contract: substrate says what's true; medium says what can
be expressed; characters compose within both.

## refs

- @0xhoneyjar/medium-registry README
- freeside-cli zones listing (discord-deploy aspirational)
- packages/persona-engine/src/orchestrator/emojis/registry.ts (current hardcoded catalog)
- packages/persona-engine/src/deliver/wardrobe-resolver.ts (override resolution path)
- vault/wiki/concepts/chat-medium-presentation-boundary.md (CMP-boundary doctrine)

## one open question

does the operator want this track to be a follow-up FROM cycle-ruggy-leaderboard
(i.e., leaderboard cycle ships with hardcoded unicode mood-emoji, this catalog
work ships AFTER as cleanup), OR a precondition (leaderboard cycle blocks on
freeside-mediums v0.3.0 + catalog discovery)?

recommendation: **follow-up**. leaderboard cycle is unblocked by hardcoded
unicode emoji; per-row mood signal is recoverable. catalog cycle ships as a
sibling refactor that the leaderboard cycle migrates onto. minimizes the
critical path; preserves the discovery-loop's freedom to evolve without
deadline pressure.
