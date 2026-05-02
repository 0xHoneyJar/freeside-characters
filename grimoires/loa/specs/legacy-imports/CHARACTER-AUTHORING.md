# Character authoring

How to add a new participation-agent profile under
`apps/character-<id>/`. Read `CIVIC-LAYER.md` first — it explains why
characters are markdown + JSON only and the substrate handles all runtime.

## Folder shape

```
apps/character-<id>/
├── character.json        ← substrate-readable manifest
├── persona.md            ← REQUIRED — voice + system-prompt template + post-type fragments
├── creative-direction.md ← optional — the "why" arc; tensions and decisions
├── exemplars/            ← optional — per-post-type voice exemplars (ICE)
│   ├── digest/
│   ├── micro/
│   ├── weaver/
│   ├── lore_drop/
│   ├── question/
│   └── callout/
├── ledger.md             ← optional but recommended — what the character speaks, when
├── README.md             ← optional — civic-layer placement explanation
└── package.json          ← workspace member declaration
```

## `character.json` contract

```jsonc
{
  "$schema": "https://freeside-characters/schema/character.v0.json",
  "id": "satoshi",
  "displayName": "Satoshi",
  "personaFile": "persona.md",
  "exemplarsDir": "exemplars",
  "emojiAffinity": {
    "primary": "mibera",
    "fallback": "ruggy"
  },
  "anchoredArchetypes": ["Veteran", "Chaos-Agent"],
  "mcps": ["codex", "imagegen"],
  "slash_commands": [
    {
      "name": "satoshi",
      "description": "talk to satoshi",
      "handler": "chat",
      "options": [
        { "name": "prompt", "description": "what to say to satoshi", "type": 3, "required": true },
        { "name": "ephemeral", "description": "only you see the reply", "type": 5, "required": false }
      ]
    },
    {
      "name": "satoshi-image",
      "description": "satoshi generates an image",
      "handler": "imagegen",
      "options": [
        { "name": "prompt", "description": "image prompt — be explicit about subject + scene + light", "type": 3, "required": true }
      ]
    }
  ],
  "doc": {
    "creativeDirection": "creative-direction.md"
  },
  "stage": "character",
  "stageNotes": "Brief explanation of stage choice."
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | stable handle. Must match the folder name (`apps/character-satoshi/` → `id: "satoshi"`). |
| `displayName` | no | human-readable label. Defaults to `id`. |
| `personaFile` | yes | path relative to character dir (typically `persona.md`). |
| `exemplarsDir` | no | path relative to character dir. Omit → no In-Context Exemplars (rule-based voice only). |
| `emojiAffinity` | no | hint for emoji MCP. Currently informational; V0.6-D wires into MCP filtering. |
| `anchoredArchetypes` | no | 1-2 cabal archetypes that genuinely map to who the character IS (not rotating filters). |
| `slash_commands` | no | per-character slash commands (V0.7-A.1+). Omit for default `/<id> chat` shape. See §slash commands. |
| `mcps` | no | per-character MCP scope on the digest path (V0.7-A.1+). Omit for bot-wide access. See §MCP scoping. |
| `stage` | no | `character` (V0.6) or `daemon` (V0.7+ once mint machinery lands). |

## Slash commands (V0.7-A.1+)

Eileen's framing 2026-04-30: "commands are diff otherwise they'd be reporting
the same shit." Each character can declare its own command set in
`character.json`. When omitted, the substrate auto-generates the V0.7-A.0
default `/<id> prompt:<text> ephemeral:<bool>` routed to the `chat` handler
— so existing characters keep working without changes.

```jsonc
"slash_commands": [
  {
    "name": "satoshi",
    "description": "talk to satoshi",
    "handler": "chat",
    "options": [
      { "name": "prompt", "description": "what to say to satoshi", "type": 3, "required": true },
      { "name": "ephemeral", "description": "only you see the reply", "type": 5, "required": false }
    ]
  },
  {
    "name": "satoshi-image",
    "description": "satoshi generates an image",
    "handler": "imagegen",
    "options": [
      { "name": "prompt", "description": "image prompt", "type": 3, "required": true }
    ]
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Discord command name. Must match `^[-_\p{L}\p{N}]{1,32}$`. |
| `description` | yes | 1-100 char description shown in Discord autocomplete. |
| `handler` | yes | Substrate-side handler. `chat` (composeReply pipeline · V0.7-A.0) or `imagegen` (Bedrock Stability · V0.7-A.1). Future: `stats`, `lore`, etc. |
| `options` | no | Discord application command options. `type` values: 3=STRING, 4=INTEGER, 5=BOOLEAN, 10=NUMBER. |

The substrate flattens all characters' commands at publish time and rejects
duplicate names loud. Run `bun run apps/bot/scripts/publish-commands.ts`
after editing — Discord caches command schemas (1-hour TTL globally,
instant in single-guild mode).

## MCP scoping (V0.7-A.1+)

Per-character MCP access on the digest path. Names listed in `mcps` are the
servers the character is allowed to call from `runOrchestratorQuery`. Names
not currently registered (env-gated MCPs like `codex` when `CODEX_MCP_URL`
is unset) are silently dropped — the field expresses INTENT; what's actually
available is the intersection with what the substrate has wired.

```jsonc
// ruggy — reporter · data-grounded · no imagegen (won't hallucinate-and-illustrate)
"mcps": ["score", "codex", "emojis", "rosenzu", "freeside_auth"]

// satoshi — mibera-agent · cross-realms · no score (stays gnomic, not zone-stat analyst)
"mcps": ["codex", "imagegen"]
```

When `mcps` is omitted, the character has access to ALL registered MCPs
(V0.6 parity). Affects ONLY the digest path. Chat-mode replies
(`composeReply`) bypass MCPs entirely by design and are unaffected.

Currently registered MCP names (substrate-side):

| Name | Source | When registered |
|---|---|---|
| `rosenzu` | `orchestrator/rosenzu/` | always (in-process SDK MCP) |
| `emojis` | `orchestrator/emojis/` | always (in-process SDK MCP) |
| `freeside_auth` | `orchestrator/freeside_auth/` | always (warns + falls back to truncated wallet when DB unavailable) |
| `score` | zerker's HTTP MCP | when `MCP_KEY` is set |
| `codex` | gumi's mibera-codex HTTP MCP | when `CODEX_MCP_URL` is set |
| `imagegen` | `orchestrator/imagegen/` | when `AWS_REGION` + `BEDROCK_STABILITY_MODEL_ID` set |

## `persona.md` conventions

The persona doc is BOTH the human-facing voice document AND the substrate's
system-prompt source. It uses three substrate-canonical conventions:

### 1. System-prompt template section

The doc must contain a section header `## System prompt template` followed by
a fenced code block (use ```` ```` four-tick fences so embedded ``` triple-fences
don't break it). The fenced content IS the template the substrate substitutes
placeholders into:

````markdown
## System prompt template

```
You are <character voice...>

{{POST_TYPE_GUIDANCE}}

{{EXEMPLARS}}

═══ INPUT PAYLOAD ═══

zone: {{ZONE_ID}}
post type: {{POST_TYPE}}

{{POST_TYPE_OUTPUT_INSTRUCTION}}
```
````

The marker `═══ INPUT PAYLOAD ═══` (note the box-drawing chars) splits the
template into a system-prompt half (everything before) and a user-message half
(everything after). The substrate enforces this split.

### 2. Per-post-type fragments

Six post-types must each have a fragment block:

```markdown
<!-- @FRAGMENT: digest -->
Guidance specific to digest posts goes here. Tone, constraints, examples.
<!-- @/FRAGMENT -->

<!-- @FRAGMENT: micro -->
Guidance for micro posts.
<!-- @/FRAGMENT -->

<!-- @FRAGMENT: weaver -->
…
<!-- @/FRAGMENT -->
```

Required fragment names: `digest`, `micro`, `weaver`, `lore_drop`, `question`,
`callout`. Missing one will throw at compose-time.

### 3. Placeholders

The substrate substitutes these placeholders during prompt build:

| Placeholder | What gets substituted |
|---|---|
| `{{ZONE_ID}}` | current zone (e.g. `bear-cave`) |
| `{{POST_TYPE}}` | current post type (e.g. `digest`) |
| `{{POST_TYPE_GUIDANCE}}` | the post-type's fragment block content |
| `{{POST_TYPE_OUTPUT_INSTRUCTION}}` | brief "write the post now" instruction |
| `{{CODEX_PRELUDE}}` | Mibera Codex `llms.txt` content (~2k tokens) |
| `{{EXEMPLARS}}` | In-Context Exemplar block (empty if no exemplars on disk) |

## Exemplars (ICE)

In-Context Exemplars are real past posts the LLM matches against — far more
load-bearing for voice fidelity than rule-based prompts. To add exemplars for
a post-type, drop `*.md` files into `exemplars/<post-type>/`. The substrate
randomly samples up to 5 per fire (Fisher-Yates shuffle) and injects them into
`{{EXEMPLARS}}`.

Frontmatter is optional. If present (`---\n…\n---\n`), it's stripped before
injection. Files named `README.md` are skipped.

## Enabling a character at runtime

The bot reads the `CHARACTERS` env var (comma-separated character ids):

```bash
CHARACTERS=ruggy             # default — only ruggy
CHARACTERS=satoshi           # only satoshi
CHARACTERS=ruggy,satoshi     # both (V0.6-D routing decides who speaks per fire)
```

Default is `ruggy`. The first character in the list is the "primary" — for
the digest path, all fires dispatch through the primary (V0.6-A behavior).
V0.6-D will add per-fire affinity routing. V0.7-A.0 slash commands route
explicitly to the invoked character regardless of primary.

## Smoke-test a new character

After adding files, run:

```bash
# Typecheck — catches missing files, malformed character.json
bun run typecheck

# Stub-mode dry-run — exercises the compose pipeline without external calls
STUB_MODE=true LLM_PROVIDER=stub CHARACTERS=<id> POST_TYPE=digest \
  ZONES=stonehenge bun run digest:once
```

If both pass, the character loads and the substrate accepts it. Voice quality
needs a real LLM call (`LLM_PROVIDER=anthropic`) and human review.

## Stage promotion (character → daemon, V0.7+)

Per Eileen's `puruhani-as-spine.md` canon, characters elevate to **daemons**
when ALL FOUR conditions land:

1. **dNFT mint machinery** — token-bound account (ERC-6551) per character
2. **State-transition handlers** — Dormant → Stirring → Breathing → Soul
3. **Designed-voice templates** — replace pure-LLM with template-driven voice
4. **Memory ledger** — jani's storage architecture; 5-way memory matrix

Until then, `stage: "character"` is the right shape and the codex grail page
(or analogous canonical text) is the identity anchor. Don't introduce
"freeside-daemon" terminology or behaviors until the machinery exists —
applying the daemon vocabulary prematurely conflates this work with Eileen's
puruhani-daemon canon.
