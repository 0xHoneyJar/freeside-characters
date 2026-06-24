---
type: gh-issue-template-draft
target_repos:
  - 0xHoneyJar/score-mibera
  - 0xHoneyJar/construct-mibera-codex
target_path: .github/ISSUE_TEMPLATE/capability-request.md
session: 03 (freeside-mcp-organization-kickoff)
authored: 2026-05-02
status: DRAFT — awaits operator review + cross-team coordination before push
coordination: |
  Per seed §9.2-9.3:
  - score-mibera (zerker): operator may want to slack/discord zerker before opening PR
  - construct-mibera-codex (gumi): same — gumi co-owns the codex MCP
  Either repo's `.github/ISSUE_TEMPLATE/` may already have other templates;
  this is additive and shouldn't conflict.
---

# Draft: capability-request gh-issue template (score-mibera + construct-mibera-codex)

> Per kickoff seed §4.6. The template body below is written to be
> generic across both federated MCP repos; only the "Examples" section
> is repo-specific. Each repo gets its own copy with the example tweaked
> for that MCP's vocabulary.

The intent (per seed §4.6): capability requests describe the **schema
delta** + the **broadcast surface change** — not just prose. This makes
review mechanical and keeps federation discipline tight.

---

## Generic template body

```markdown
---
name: Capability request
about: Request a new tool or extend an existing tool's contract
title: 'capability: <one-line summary>'
labels: ['capability-request']
---

# Capability Request

## What capability is being requested?

<!-- One paragraph: what should this MCP be able to do that it can't today? -->

## Why is this an MCP capability vs. a consumer-side workaround?

<!-- A capability belongs in the MCP when:
     - Multiple consumers would benefit
     - The data / logic lives behind this MCP's source-of-truth boundary
     - Consumer-side composition would require duplicating MCP-internal state
     If those don't apply, prefer a consumer-side fix. -->

## Schema delta

### Tool name(s) added or changed

- [ ] New tool: `<tool_name>`
- [ ] Modified tool: `<existing_tool_name>` (describe what changes)
- [ ] Deprecated tool: `<existing_tool_name>` (with sunset date)

### Effect.Schema input contract

```ts
const <ToolName>Input = Schema.Struct({
  // ...
});
```

### Effect.Schema output contract

```ts
const <ToolName>Output = Schema.Union(
  Schema.Struct({
    // success branch
  }),
  Schema.Struct({
    // empty / error branch
  }),
);
```

### Description (LLM-facing prompt copy)

<!-- This text shows up in the MCP's `tool()` registration and is what
     the LLM reads when deciding whether to call this tool. Be precise
     about WHEN to use it (and just as importantly, when NOT to). -->

## Broadcast surface change

### `/.well-known/mcp.json` delta (federation-extended manifest)

<!-- The upstream's broadcast manifest declares its tools to the
     gateway. Sketch the delta this capability change introduces.

     For new tools: the addition under `capabilities.tools[]`.
     For modified tools: the diff in input/output schemas.
     For deprecations: the removal + sunset window the manifest should
       carry until removal. -->

```diff
{
  "capabilities": {
    "tools": [
+     {
+       "name": "<tool_name>",
+       "description": "<from contract>",
+       "input": { /* JSON Schema 7 */ },
+       "output": { /* JSON Schema 7 */ }
+     }
    ]
  }
}
```

### Access policy

<!-- Does this capability change visibility / access? If the new tool
     should be gated (api-key, allowlist, x402-pay), declare here. -->

- [ ] No access change
- [ ] Visibility change: `<from> → <to>`
- [ ] Access policy change: `<from> → <to>`

## Consumer impact

<!-- Which consumers (bots / agents / clients) need to update when this
     ships? Include changes to per-consumer allowlists, persona prompts,
     SDK schemas, etc. -->

- [ ] Consumer X needs `<change>`
- [ ] Consumer Y needs `<change>`

## Acceptance criteria

<!-- What does "done" look like for this capability? Boundary contract
     test, federation manifest update, smoke against the gateway,
     documentation. -->

- [ ] Effect.Schema contract authored
- [ ] Boundary contract test passes (input round-trip, output round-trip,
      invalid-input rejection)
- [ ] `/.well-known/mcp.json` updated to broadcast the new shape
- [ ] Gateway smoke (`pnpm smoke` in `freeside-mcp-gateway`) green for
      this MCP's slug after deploy
- [ ] Consumer documentation updated where applicable

## Coordination

<!-- Who needs to ack this before merge? -->

- Upstream maintainer: `<@handle>`
- Gateway maintainer: `@jani` (when access policy changes)
- Affected consumers: `<list>`

## Reference

- Federation pattern: see `0xHoneyJar/freeside-characters/docs/MCP-FEDERATION.md`
- 4-axis ownership: `gateway-as-registry` doctrine
- Effect.Schema: https://effect.website/docs/schema/introduction
- This MCP's contract source: `<repo-relative path to schema.ts>`
```

---

## Per-repo notes

### `0xHoneyJar/score-mibera`

The example schema in the template should reference score-mibera's
shape. Suggested example for the placeholder:

```ts
// example: hypothetical "compare_zones" tool
const CompareZonesInput = Schema.Struct({
  zones: Schema.Array(Schema.Literal(
    'stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'
  )),
  window: Schema.Literal('weekly', 'daily'),
});

const CompareZonesOutput = Schema.Struct({
  comparison: Schema.Array(Schema.Struct({
    zone: Schema.String,
    delta_score: Schema.Number,
    top_factors: Schema.Array(Schema.String),
  })),
});
```

Coordination: zerker. Tag in PR description.

### `0xHoneyJar/construct-mibera-codex`

The example schema should reference codex's shape:

```ts
// example: hypothetical "lookup_relationship" tool
const LookupRelationshipInput = Schema.Struct({
  source_type: Schema.Literal('archetype', 'grail', 'mibera', 'factor'),
  source_id: Schema.String,
  target_type: Schema.optional(Schema.Literal(
    'archetype', 'grail', 'mibera', 'factor'
  )),
});

const LookupRelationshipOutput = Schema.Struct({
  relationships: Schema.Array(Schema.Struct({
    target_type: Schema.String,
    target_id: Schema.String,
    relationship_kind: Schema.String,
    confidence: Schema.Number,
  })),
});
```

Coordination: gumi. Note that codex is the existing gateway tenant
(live since v0.1) and serves as the canonical example for federation
shape — gumi will likely have strong opinions on the template.

---

## Authoring notes (for the operator pushing these PRs)

- This is ONE shared template body with two per-repo example variants.
  Either repo can land first; the second can adapt from the first.
- Template lives at `.github/ISSUE_TEMPLATE/capability-request.md` per
  GitHub's standard issue-template directory.
- The `labels: ['capability-request']` frontmatter creates the label
  on first use. If either repo prefers different label hygiene
  (e.g., `kind/feature` vs `capability-request`), adjust before merging.
- The "Reference" section's link to `MCP-FEDERATION.md` works only
  after this session's §4.4 doc has merged in `freeside-characters`.
  Either:
  - Land the doc PR first, then file these template PRs (recommended)
  - Use the github URL directly:
    `https://github.com/0xHoneyJar/freeside-characters/blob/main/docs/MCP-FEDERATION.md`
- The 4-axis ownership table (referenced in the Reference section) is
  in `freeside-mcp-gateway`'s README; that link is stable.
