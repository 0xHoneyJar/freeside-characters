---
title: per-tool MCP schema versioning + consumer-side runtime validation (cross-repo RFC)
status: candidate
mode: pre-planning
created: 2026-05-13
source_session: pr-review · score-mibera#109 cycle-021 proposal reply
expiry: when RFC drafted + zerker accepts/rejects OR operator revokes
use_label: usable
boundaries:
  - cross-repo design — one file score-mibera side, one validator persona-engine side
  - replaces the rejected `@freeside/score-mcp-corpus` shared-types pattern
  - not a unilateral commitment — depends on zerker accepting the counter-proposal in PR #109
related-cycles:
  - score-mibera cycle-020 (in flight, defines feature-flag.ts + tools-list-contract.test.ts patterns)
  - score-mibera cycle-021 (proposal stage, would adopt schema-versioning from kickoff if accepted)
---

# track · MCP schema versioning RFC

## frame

PR #109 reply (2026-05-13) counter-proposed schema-versioning instead
of corpus. operator framing in-session:

> "Downstream consumers/agents should be aware of MCP tools and changes
> by MCP schema versioning and other tech. We do not want to have
> multiple places where we are maintaining schemas. Implementations
> can change but schemas/contracts are well defined and versioned."

translation: stop hand-mirroring TypeScript types from score-mibera
into `packages/persona-engine/src/score/types.ts`. instead, score-mibera
emits versioned schemas via the MCP protocol surface (`inputSchema` per
tool + `schema_version` per response), and consumers validate at runtime
against the schemas score advertises.

## the architectural shape

```
  ┌──────────────────────────────────────────────────┐
  │  score-mibera (producer · single source of truth) │
  │  ─────────────────────────────────────────────────│
  │  tools/list → inputSchema per tool + version    │
  │  tool response → { ...data, schema_version: "X" }│
  └────────────────────────┬─────────────────────────┘
                           │ MCP protocol
                           ▼
  ┌──────────────────────────────────────────────────┐
  │  persona-engine score client (consumer · middle)  │
  │  ─────────────────────────────────────────────────│
  │  on boot: introspect tools/list, cache schemas   │
  │  on response: validate against cached schema     │
  │  on version mismatch: log + degrade gracefully   │
  └──────────────────────────────────────────────────┘
```

current state: ~9 hand-mirrored shapes in `score/types.ts` (5 cycle-020
+ 5 cycle-021 incoming). proposal kills this pattern.

## scope (RFC content)

### score-mibera side (1 file)

- per-tool `schema_version` field in input + output schemas (semver-ish: `"1.0.0"`)
- versioning discipline doc — when to bump major vs minor (breaking field rename = major; additive field = minor)
- `tools/list` response includes `inputSchema` with explicit `$schema` + `$id` (already MCP-native, just enforce discipline)
- migration path for the 10 existing tools (legacy zone tools get versioned retroactively as 1.0.0)

### persona-engine side (1 validator)

- runtime schema validator at score-client boundary (zod or ajv — pick one)
- introspection on boot: cache `tools/list` schemas in memory, refresh on cycle restart
- response validation: every score-mibera response checked against cached schema
- mismatch behavior:
  - **minor mismatch** (extra fields, missing optional) → log warn, pass through
  - **major mismatch** (missing required, type drift) → log error, degrade to fallback or skip
- delete `packages/persona-engine/src/score/types.ts` (or shrink to just the local enums like `ZONE_TO_DIMENSION`)

## not in scope

- a shared npm package (the rejected corpus pattern)
- generated TypeScript types (operator's frame: "implementations can change but schemas/contracts are well defined" — runtime contracts, not compile-time types, are the load-bearing surface)
- versioning score-mibera's HTTP API surface (that's a separate concern; this RFC is MCP-only)
- migration of `freeside_auth` MCP to the same pattern (could follow, but not blocking)

## open questions for soju

- zod or ajv on consumer side? (zod = idiomatic for our stack; ajv = native JSON Schema support, less duplication)
- where does the RFC live — score-mibera repo or here? (likely score-mibera since producer owns the contract surface)
- does this need a "schema registry" abstraction or is in-memory cache from `tools/list` introspection enough?
- versioning of `inputSchema` separately from response schema, or unified?

## status of zerker's response

posted to score-mibera#109 as counter-proposal. zerker has not yet
responded. RFC drafting blocked until he accepts (or proposes an
alternative).

## activation receipts

- operator's in-session frame on schema versioning (2026-05-13) — usable, expiry: this conversation + downstream tracks
