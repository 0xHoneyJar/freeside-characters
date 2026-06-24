# MCP Federation — 3-Flavor Strategy

> Authored 2026-05-02 in session 03 (kickoff: `~/bonfire/grimoires/bonfire/specs/freeside-mcp-organization-kickoff-2026-05-01.md`).
> Anchor: TIER 1 substrate per `~/vault/wiki/concepts/multi-axis-daemon-architecture.md` v1.1 §14.
> Aligns with: `~/vault/wiki/concepts/gateway-as-registry.md` (operational doctrine).

---

## TL;DR

MCPs in this stack come in three flavors. Each has a different deploy
posture, a different observability surface, and a different promotion
path. Pick the right flavor before you author the MCP — promoting later
costs more than deciding right.

| Flavor | Lives in | Deploy | Use when |
|---|---|---|---|
| 🏠 **Substrate-internal** | `packages/persona-engine/src/orchestrator/<mcp>/` | bundled with bot · zero infra | small in-process tools · single-bot consumer |
| 🌐 **Federated tenant** | per-MCP repo · routed via `mcp.0xhoneyjar.xyz/<slug>/*` | independent · railway/ECS | multi-bot consumers · cross-team capability · external auth |
| 🎴 **Per-character scope** | `apps/character-<id>/character.json` `mcps[]` | data-only · no infra | filter which characters can call which MCPs |

The substrate enforces them via:
- `orchestrator/index.ts` `buildMcpServers(config)` — registers flavor-1 + flavor-2.
- `orchestrator/index.ts` `buildAllowedTools(servers, character.mcps)` — applies flavor-3 filter.
- `orchestrator/_schema/` — Effect.Schema contracts shared across flavors so promotion is a deploy
  question, not a contract rewrite.

---

## §1 · Flavor 1 — Substrate-internal MCP

**What it is**: an in-process MCP server registered via the SDK's
`createSdkMcpServer`. Lives in this repo, ships with the bot, no separate
deploy.

**Today**: `rosenzu`, `emojis`, `freeside_auth`, `imagegen`.
(`emojis` is the worked example for the Effect.Schema contract pattern
— see `packages/persona-engine/src/orchestrator/emojis/{schema,server}.ts`.)

### When to use this flavor

- Single consumer (this bot)
- No external state; tools touch in-process registries or files
- Latency-critical (in-process is ~free vs HTTP)
- Tightly coupled to substrate types you don't want to broadcast

### Authoring shape

```
orchestrator/
  <mcp>/
    schema.ts       ← Effect.Schema contracts (canonical · single source of truth)
    server.ts       ← SDK tool() registration · derives from schema.ts
    server.test.ts  ← boundary contract tests (§4.3a · per-MCP)
    <internals>     ← anything else (registry, helpers, runtime state)
```

`schema.ts` declares:
- One `Schema.Struct` per tool input
- One `Schema.Struct` per tool output (with `Schema.Union` for tagged
  success/empty branches when relevant)
- A Zod parity shape (parity-checked at compile time via
  `assertZodParity<T>()`)
- One `McpToolContract` per tool
- One `McpServerContract` aggregating the tools

`server.ts` imports the contracts and binds each to a runtime handler
via the SDK's `tool()` API. The contract supplies `name`,
`description`, and the input shape; the handler supplies the body.

### Boundary tests

Per `packages/persona-engine/src/orchestrator/emojis/server.test.ts`
template:

1. **Input validity**: valid input round-trips through Effect's
   `decodeUnknownSync` without throwing.
2. **Input rejection**: invalid input (wrong type, missing required
   field, off-enum literal) throws ParseError.
3. **Output round-trip**: handler called with valid input produces an
   SDK envelope; the parsed JSON inside `content[0].text` decodes
   through the output schema.

These run via `bun test`. Substrate-internal MCPs co-locate their
`server.test.ts` next to `server.ts`.

---

## §2 · Flavor 2 — Federated tenant on `freeside-mcp-gateway`

**What it is**: an MCP exposed at `mcp.0xhoneyjar.xyz/<slug>/*` via the
[`freeside-mcp-gateway`](https://github.com/0xHoneyJar/freeside-mcp-gateway).
The MCP itself lives in its own repo, deploys independently, and the
gateway routes incoming requests to it.

**Today (live)**:
- ✅ `mcp.0xhoneyjar.xyz/codex/*` → [`construct-mibera-codex`](https://github.com/0xHoneyJar/construct-mibera-codex) (gumi · since gateway v0.1)
- ✅ `mcp.0xhoneyjar.xyz/score/*` → [`score-mibera`](https://github.com/0xHoneyJar/score-mibera) (zerker · added gateway v0.2)

This bot consumes them via `CODEX_MCP_URL` and `SCORE_API_URL` config
keys. The chat-mode + digest-mode SDK passes those through to the LLM
as HTTP MCPs.

### When to use this flavor

- Multiple consumers (other bots, agents, future clients) need this MCP
- The MCP has its own deploy schedule independent of any bot release
- External state (DB, indexer, third-party API)
- Federation contract matters — the MCP is broadcasting capabilities
  beyond its original consumer

### The 4-axis ownership split (canonical)

Per `gateway-as-registry` doctrine — read it before authoring a flavor-2
MCP. Summarized:

| Axis | Owner | Concretely |
|---|---|---|
| Connectivity (routing) | Gateway | `mcp.0xhoneyjar.xyz/{slug}/mcp` proxies to upstream |
| Servicing (index) | Gateway | `/.well-known/federation.json` aggregates declarations |
| Distribution (proxy) | Gateway | streaming pass-through; bytes-untouched |
| **Identity + auth + capabilities** | **Upstream MCP** | upstream's `/.well-known/mcp.json` |

The gateway is a registry, not a vault. Each MCP determines what it
is — the gateway just routes.

### Promotion path (flavor-1 → flavor-2)

When a substrate-internal MCP outgrows in-bot:

1. Extract the MCP into its own repo. Keep `schema.ts` shape — the
   Effect.Schema contracts travel.
2. Wrap with an HTTP server that speaks MCP protocol (Hono works; use
   the gateway's stack as a template).
3. Author the upstream's `/.well-known/mcp.json` per v0.3 broadcast
   contract — federation-extended schema delta describing tools,
   visibility, access policy.
4. PR the gateway's `src/tenants.ts` to add a tenant entry (slug →
   upstream URL + visibility + access).
5. Run `pnpm smoke` against the gateway with the new tenant.
6. Update consuming bots to point at the gateway path
   (`mcp.0xhoneyjar.xyz/<slug>/*`) rather than the in-bot path.

The skill `registering-mcp-tenant` (in
[`construct-freeside`](https://github.com/0xHoneyJar/construct-freeside))
is the procedural reference for steps 4-5. Authored as part of this
session's §4.5 deliverable.

### Promotion candidates

- **`freeside_auth`** — currently in-bot (flavor 1). Multi-bot identity
  resolution would benefit federation. Promote when a second consumer
  appears.
- **`emojis`** — currently in-bot. Probably stays in-bot indefinitely —
  the THJ guild emoji catalog is a single-bot concern with no external
  state.
- **`rosenzu`** — currently in-bot. Spatial primitives may be specific
  enough to characters that federation isn't useful. Defer.
- **`imagegen`** — currently in-bot, calls Bedrock externally. Could
  promote if the imagegen pipeline becomes a cross-bot service (per
  the `creative-direction-construct-split` thread).

---

## §3 · Flavor 3 — Per-character capability scope

**What it is**: each character declares which MCP servers it can call
via `apps/character-<id>/character.json` `mcps[]`. The orchestrator
filters `allowedTools` by this list at digest + chat time.

**Today**:
- `ruggy.mcps = ["score", "codex", "emojis", "rosenzu", "freeside_auth"]`
- `satoshi.mcps = ["score", "codex", "rosenzu", "freeside_auth", "imagegen"]`

The orchestrator's `buildAllowedTools(mcpServers, character.mcps)`
intersects character intent with substrate availability. Names in
`character.mcps` that aren't currently registered (env-gated MCP not
configured, OR a typo) are silently dropped — surface check via
`apps/bot/src/tests/persona-tool-drift.test.ts` + the
`orchestrator: character X declared mcps [...] not currently registered`
warning.

### When to expand a character's scope

- The character's persona.md prompts the LLM to call a tool not in the
  current scope (catches drift class — see `persona-tool-drift.test.ts`)
- A new use case wants this character to access a tool the substrate
  already exposes

### When to narrow a character's scope

- A tool's voice signature pollutes the character's register (e.g.,
  satoshi got `emojis` originally but the dense-block voice doesn't
  use them — narrowed by exclusion)
- A capability is expensive (LLM token cost · external API cost) and
  the character doesn't need it

### Drift detection

Two tests catch flavor-3 drift:

1. **Surface-completeness** (`apps/bot/src/tests/surface-completeness.test.ts`)
   — every name in any character's `mcps[]` resolves to a registered
   MCP server when the bot is fully configured.

2. **Persona-tool-drift** (`apps/bot/src/tests/persona-tool-drift.test.ts`)
   — every `mcp__<server>__<tool>` reference in a character's
   `persona.md` maps to a server in that character's `mcps[]` AND the
   tool name exists in the canonical tool registry for that server.

Run both via `bun test`. Pre-merge gate.

---

## §4 · Capability request flow

When a consumer needs a new tool from an existing MCP:

### For flavor-1 MCPs (in this repo)

- Open a PR adding the tool's contract to `<mcp>/schema.ts` + handler
  to `<mcp>/server.ts` + boundary test to `<mcp>/server.test.ts`.
- Update any `persona.md` that prompts the LLM to call it.
- Update the `IN_BOT_TOOLS` allowlist in
  `apps/bot/src/tests/persona-tool-drift.test.ts`.

### For flavor-2 MCPs (external repos)

Capability requests live on the **upstream MCP repo**, not on the
gateway. Per `gateway-as-registry`: each MCP determines what it is.
File issues via the per-repo template:

- [`score-mibera`](https://github.com/0xHoneyJar/score-mibera) →
  `.github/ISSUE_TEMPLATE/capability-request.md` (filed in §4.6 of
  this session's kickoff)
- [`construct-mibera-codex`](https://github.com/0xHoneyJar/construct-mibera-codex) →
  same

Templates use the Effect.Schema shape — capability requests describe
the schema delta + the broadcast surface change (the
`/.well-known/mcp.json` field add), not just prose. This makes review
mechanical and keeps federation discipline tight.

When an external MCP ships a new tool, the consuming bot also needs:
- Updated `EXTERNAL_TOOLS` allowlist in
  `apps/bot/src/tests/persona-tool-drift.test.ts`
- (When the v0.3 broadcast contract lands gateway-side) automated
  fetch of the upstream's federation manifest at build time, which
  replaces the manual allowlist.

---

## §5 · Federation roadmap (informational)

The gateway today (v0.2) handles routing + per-tenant access. v0.3
introduces the upstream broadcast contract: each upstream serves
`/.well-known/mcp.json` extending with federation metadata; the gateway
fetches at boot, merges into the federation manifest exposed at
`/.well-known/federation.json`. `tenants.ts` shrinks to routing +
gateway-side policy.

When v0.3 lands:
- Each flavor-2 MCP MUST serve a v0.3-shaped `/.well-known/mcp.json`
- Capability requests can be expressed as schema diffs against the
  upstream's broadcast manifest
- Build-time fetch replaces the manual `EXTERNAL_TOOLS` allowlist in
  `persona-tool-drift.test.ts`

The substrate's Effect.Schema contracts (this repo's
`orchestrator/_schema/` + `<mcp>/schema.ts`) are designed to share
shape with the broadcast manifest. A flavor-1 MCP that promotes to
flavor-2 reuses the same contract types — federation is a deploy
question, not a contract rewrite.

---

## §6 · References

| Topic | Source |
|---|---|
| `gateway-as-registry` doctrine | `~/vault/wiki/concepts/gateway-as-registry.md` |
| Multi-axis daemon architecture (TIER 1 substrate) | `~/vault/wiki/concepts/multi-axis-daemon-architecture.md` v1.1 §14 |
| Constructs MCP deployment topology | `~/vault/wiki/concepts/constructs-mcp-deployment-topology.md` |
| `freeside-mcp-gateway` (live · `mcp.0xhoneyjar.xyz`) | https://github.com/0xHoneyJar/freeside-mcp-gateway |
| `construct-freeside` (operator-owned distillation target) | https://github.com/0xHoneyJar/construct-freeside |
| `score-mibera` (federated tenant · gateway v0.2) | https://github.com/0xHoneyJar/score-mibera |
| `construct-mibera-codex` (federated tenant · gateway v0.1) | https://github.com/0xHoneyJar/construct-mibera-codex |
| Effect.Schema docs | https://effect.website/docs/schema/introduction |
| Live federation index | https://mcp.0xhoneyjar.xyz/.well-known/federation.json |
| Live codex routing example | https://mcp.0xhoneyjar.xyz/codex/.well-known/mcp.json |

Session 03 kickoff (this doc's source brief):
`~/bonfire/grimoires/bonfire/specs/freeside-mcp-organization-kickoff-2026-05-01.md`
