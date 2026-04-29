# character-ruggy

Participation-agent profile for **Ruggy** — festival-NPC voice, lowercase-OG register,
mibera-codex aware. Consumed by `apps/bot/` via the persona-engine substrate.

## Files

| File | Purpose |
|---|---|
| `character.json` | Substrate-readable config (id, persona path, emoji affinity, exemplars dir). |
| `persona.md` | The full persona doc — system-prompt template + 6 post-type fragments + voice rules. |
| `creative-direction.md` | The creative arc — tensions, decisions, voice anchors that drive persona iteration. |
| `exemplars/` | In-Context Exemplars by post type — REAL past Ruggy posts the LLM matches against. |

## Civic-layer placement

Ruggy is a **participation agent** (speaker), not a system agent (governor). The
substrate at `packages/persona-engine/` owns cron, delivery, MCP orchestration; this
character supplies voice + identity only. The two layers communicate exclusively
through `CharacterConfig` injected at boot.

## Stage: character (V0.6)

Per Eileen's vault canon (`puruhani-as-spine.md`,
`agent-native-civic-architecture.md`), the **daemon** stage requires dNFT mint
machinery, ERC-6551 token-bound accounts, state transitions (Dormant → Soul),
and designed-voice templates. We don't have those yet. Ruggy is character-stage:
LLM-driven persona, identity rooted in this folder + the Mibera codex, no
on-chain state. Trajectory is character → daemon when the machinery lands.
