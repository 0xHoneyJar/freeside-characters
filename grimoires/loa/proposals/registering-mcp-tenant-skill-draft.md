---
type: skill-draft
target_repo: 0xHoneyJar/construct-freeside
target_path: skills/registering-mcp-tenant/SKILL.md
session: 03 (freeside-mcp-organization-kickoff)
authored: 2026-05-02
status: DRAFT — awaits operator review before push
coordination: "operator owns construct-freeside · confirm naming convention + structure against existing skills (consuming-codex-overrides / coordinating-cutover) before opening PR"
---

# Draft: `registering-mcp-tenant` skill for `construct-freeside`

> Per kickoff seed §4.5 (operator-named 2026-05-01-PM). The full SKILL.md
> body follows below — copy into `0xHoneyJar/construct-freeside/skills/registering-mcp-tenant/SKILL.md`
> and adjust headings / frontmatter to match construct-freeside's
> existing skill convention. The 8 existing skills
> (`consuming-codex-overrides`, `coordinating-cutover`,
> `flipping-kv-pointer`, `mirroring-storage`, `provisioning-manifest-resolver`,
> `reading-registry`, `synthesizing-from-codex`, `use-freeside`) will set
> the canonical shape; this draft assumes Loa's standard SKILL.md layout
> and may need light reshaping.

---

# Registering an MCP Tenant on freeside-mcp-gateway

> Construct: `construct-freeside`
> Skill: `registering-mcp-tenant`
> Authored: 2026-05-02 (drafted from `freeside-mcp-organization-kickoff-2026-05-01.md` §4.5)

The freeside-mcp-gateway (`mcp.0xhoneyjar.xyz`) is a path-routed
federation surface for MCP services. Adding an MCP as a tenant means:
the gateway routes `mcp.0xhoneyjar.xyz/<slug>/*` to your upstream URL,
broadcasts its presence in `/.well-known/federation.json`, and applies
per-tenant access policy. The MCP itself stays autonomous — the gateway
is a registry, not a vault.

## When to invoke this skill

- Promoting an in-bot MCP (flavor-1) to a federated tenant (flavor-2).
  Common drivers: a second consumer needs the MCP, the MCP's deploy
  cadence wants independence from the bot, external state requires its
  own infrastructure.
- Authoring a new MCP that should be federated from day one. Signal:
  multiple bots / agents will consume it, OR it has external state that
  belongs outside any single bot's process.
- Documenting an existing MCP's federation surface as part of a
  v0.3-upstream-broadcast migration (when the gateway begins fetching
  `/.well-known/mcp.json` from each tenant at boot).

## When NOT to invoke this skill

- Single-bot, in-process tools that touch nothing external — keep these
  flavor-1 (`packages/<bot>/src/orchestrator/<mcp>/`).
- Capability requests for an EXISTING federated MCP — those go to the
  upstream MCP's repo via its `.github/ISSUE_TEMPLATE/capability-request.md`.
  This skill is for routing-layer work, not contract-evolution work.

## Doctrine anchors (read these first)

- `gateway-as-registry` — the gateway broadcasts; each MCP determines
  what it is. Source: `~/vault/wiki/concepts/gateway-as-registry.md`.
- 4-axis ownership table — connectivity / servicing / distribution /
  identity-auth-capabilities. Gateway owns the first three; upstream
  owns the fourth. The skill respects this split.
- `constructs-mcp-deployment-topology` — Path C: data-shaped MCPs
  belong behind the gateway. Most flavor-2 candidates are Path C.

## Inputs

| Input | Source | Required |
|---|---|---|
| MCP slug | operator pick (kebab-case · stable · matches upstream service name) | yes |
| Upstream URL | the MCP's deployed HTTP endpoint (railway / ECS / wherever) | yes |
| Visibility class | `public` / `internal` / `restricted` (gateway v0.2 axes) | yes |
| Access policy | `open` / `api-key` / `allowlist` / `x402-returns-402` | yes |
| Capability list | tools the MCP exposes (names + Effect.Schema shapes) | yes |
| Owner contact | operator + co-owners (slack/discord handle) | yes |

## Outputs

The skill produces three artifacts:

1. **Curator-side: `tenants.ts` PR** to `freeside-mcp-gateway`. Adds a
   tenant entry routing `mcp.0xhoneyjar.xyz/<slug>/*` to the upstream
   URL with the declared visibility / access / owner.

2. **Upstream-side: `/.well-known/mcp.json` document** authored in the
   MCP's own repo. Shape: federation-extended manifest declaring tools,
   schemas, capability axes. Becomes load-bearing when gateway v0.3
   ships (the gateway will fetch this at boot and merge into the
   federation manifest).

3. **Gateway-side: smoke test entry** ensuring the new tenant route
   responds. Adds a check to the gateway's `pnpm smoke` regression so
   tenant additions don't silently break under deployment.

## Procedure

### Step 1: confirm the MCP is ready to federate

- Effect.Schema contracts authored for every tool the MCP exposes.
  These are the source of truth for both the upstream's `/.well-known/mcp.json`
  manifest and the consumer-side allowlists.
- HTTP server (Hono recommended; matches gateway stack) is deployed at
  a stable URL. Confirm the endpoint responds to MCP `initialize` /
  `list_tools` / `call_tool` (run a smoke against it before federating).
- Boundary contract tests pass. Per-MCP tests (`<mcp>/server.test.ts`)
  must verify input/output contracts before federation — federated
  consumers can't easily test the upstream from outside.

### Step 2: author the upstream's `/.well-known/mcp.json`

The federation-extended manifest. Shape (per gateway v0.3 destination):

```json
{
  "name": "<slug>",
  "version": "<semver>",
  "description": "<one-line · what this MCP does>",
  "owner": {
    "operator": "<handle>",
    "repo": "<github-url>"
  },
  "capabilities": {
    "tools": [
      {
        "name": "<tool_name>",
        "description": "<from contract.description>",
        "input": { /* JSON Schema 7 from Schema.JSONSchema.make(contract.input) */ },
        "output": { /* JSON Schema 7 from Schema.JSONSchema.make(contract.output) */ }
      }
    ]
  },
  "access": {
    "policy": "<open|api-key|allowlist|x402>",
    "header": "<X-MCP-Key|Authorization|...>",
    "auth_url": "<optional · where consumers retrieve credentials>"
  },
  "visibility": "<public|internal|restricted>"
}
```

The schemas come from each tool's `McpToolContract` via Effect's
`JSONSchema.make(contract.input)` — wire-shape and in-process shape
share the same source of truth.

Serve this at `/.well-known/mcp.json` on the upstream's URL. Until
gateway v0.3 lands, this file is documentation; once v0.3 ships, the
gateway fetches it at boot.

### Step 3: PR `tenants.ts` on freeside-mcp-gateway

```ts
// freeside-mcp-gateway/src/tenants.ts
{
  slug: '<slug>',
  upstream: '<https://upstream-url>',
  visibility: 'public' | 'internal' | 'restricted',
  access: {
    policy: 'open' | 'api-key' | 'allowlist' | 'x402',
    // ...per gateway v0.2 schema
  },
  owner: {
    operator: '<handle>',
    repo: '<github-url>',
  },
}
```

Open a PR. Tag the gateway maintainer (jani as of 2026-05-02). The PR
should reference the upstream's deployed URL and the
`/.well-known/mcp.json` you authored in step 2.

### Step 4: extend the gateway's smoke

`pnpm smoke` in the gateway repo exercises every tenant's `mcp` and
`/.well-known/mcp.json` endpoints. Add the new tenant to the smoke
list. Run locally; confirm green.

### Step 5: notify consumers

For each consumer of this MCP (bots, agents, other clients):

- Update their config to point at the gateway path
  (`mcp.0xhoneyjar.xyz/<slug>/*`) instead of the direct upstream URL.
- Update their EXTERNAL_TOOLS allowlist (if they have a persona-tool-drift
  test) to include the new tools.
- For bots with Effect.Schema substrate: import the upstream's contract
  types directly so type-checking covers the federation seam.

### Step 6: deprecate the direct path

Once consumers have migrated, optionally restrict the upstream's direct
URL to internal access only — forcing all external traffic through the
gateway. This depends on the upstream's deployment topology.

## Verify

- `mcp.0xhoneyjar.xyz/<slug>/.well-known/mcp.json` returns the
  federation-extended manifest.
- `mcp.0xhoneyjar.xyz/.well-known/federation.json` includes the new
  tenant in its index.
- `mcp.0xhoneyjar.xyz/<slug>/mcp` accepts MCP-protocol requests and
  forwards to the upstream.
- Gateway smoke (`pnpm smoke`) passes against the new tenant.
- A consumer (e.g., this bot) calls a tool through the gateway path
  and gets the same response as the direct path.

## Failure modes + fixes

- **Gateway routes correctly but upstream returns 401**: gateway access
  policy is set to `open` but upstream requires auth. Update the
  tenant's `access.policy` in `tenants.ts` to match the upstream's
  expected auth header.
- **`/.well-known/mcp.json` exists but tools field is empty**: the
  upstream isn't broadcasting its capabilities. Verify the manifest
  is generated from contract `JSONSchema.make` calls + served at the
  expected path.
- **Federation manifest doesn't include the new tenant**: gateway v0.2
  reads `tenants.ts` at boot — restart the gateway service after the
  PR merges. v0.3 will fetch live; this failure mode goes away.
- **Consumer's persona-tool-drift test fails**: update the consumer's
  EXTERNAL_TOOLS allowlist with the new tool names. Until v0.3 lands,
  this is manual bookkeeping.

## Cross-references

- `gateway-as-registry` doctrine
- 4-axis ownership table (connectivity / servicing / distribution /
  identity+auth+capabilities)
- `constructs-mcp-deployment-topology` (Path C: data-shaped MCPs
  belong behind the gateway)
- `freeside-mcp-gateway` README (current shape · v0.2)
- This bot's `docs/MCP-FEDERATION.md` (consumer-side perspective)

## Related skills (in this construct)

- `flipping-kv-pointer` — for tenants that ship versioned manifests
  via the operator-mutable KV pointer pattern.
- `coordinating-cutover` — when migrating consumers from direct URL to
  gateway path needs a coordinated flip rather than dual-path support.
- `provisioning-manifest-resolver` — for tenants that participate in
  the manifest-pattern beyond MCP federation.

---

## Authoring notes (for the operator merging this draft)

- This draft was authored without checking out construct-freeside
  locally; the existing skill convention (frontmatter format, header
  structure, "When to invoke" / "When NOT to invoke" sections, etc.)
  may differ from this draft. Reshape accordingly.
- The 4-axis ownership table and v0.3 broadcast contract details are
  sourced from `freeside-mcp-gateway` README + the kickoff seed §3 +
  `gateway-as-registry` doctrine; verify against current gateway docs
  before merging.
- Cross-references to skills assume their existence. Adjust the
  "Related skills" section if names don't match construct-freeside's
  current skill set.
