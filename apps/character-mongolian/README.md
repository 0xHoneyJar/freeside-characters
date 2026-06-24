# character-mongolian

NPC persona for **Munkh**, the Mongolian Grail (#507, Ancestor).
First mibera-as-npc instance. Quest character with judgment capability.

## Status

Draft — authored by Gumi (@gumibera), 2026-05-04.

## Files

| File | Purpose |
|------|---------|
| `character.json` | Config, MCP tools, webhook identity |
| `persona.md` | Voice, identity, judgment, introspection, award copy, memory |
| `codex-anchors.md` | Mongolian Grail #507 lore grounding |
| `creative-direction.md` | Gumi's creative direction decisions |
| `badge-spec.md` | Badge design spec (fly agaric, cave art style) |
| `package.json` | Package metadata |
| `exemplars/` | Example interactions (to be populated) |

## Destination

PR to `0xHoneyJar/freeside-characters/apps/character-mongolian/` when ready.

## Badge

Fly agaric mushroom in Mongolian cave art style. Art by Gumi. Spec in `badge-spec.md`.

## Quest Substrate (cycle-Q · sprint-3 SHELL · architect lock A6)

`character.json` ships a `quest_substrate` block with `TODO_TRACK_A` markers
(per SDD §8.2). Substrate (cycle-Q sprint-3) wires the bot dispatch path; Track A
(Gumi via [`construct-mibera-codex#76`](https://github.com/0xHoneyJar/construct-mibera-codex/issues/76))
authors:

- `quest_substrate.rubric_pointer.cell_id` — the codex cell holding Munkh's
  per-quest grading rubric (Track A authors the construct, substrate dereferences
  it via the construct slug → codex cell pointer)
- `quest_substrate.mention_allowed_channels` — Discord channel IDs where
  `@mongolian <message>` triggers a thread (per SDD §5.6 mention+thread surface)
- `quest_substrate.slash_allowed_channels` — channels where `/quest browse|accept|submit|status`
  is permitted (defaults to all if omitted, but Mongolian is mention+thread first)
- `quest_substrate.submission_style_override` — `inline_thread` (default) or `modal_form`
  (per ARCADE pair-decision D2)
- `quest_substrate.positive_friction_delay_ms_override` — character-specific override
  of the world default (per kickoff §9.5 principle 1)
- `quest_substrate.voice_cadence.*` — per-phase curator-voice cadence prose
  consumed by CMP transform 4 (`phaseToNarrative`). All keys optional;
  substrate ships fallback cadence.

Until Track A populates these, the bot loads Mongolian's character.json with
substrate-default cadence + the runtime falls back to the world-level engine
config (`apps/character-mongolian/character.json` is loaded by the bot's
character-loader; the quest_substrate block is read by the bot's
quest-runtime.ts during dispatch).

## Track A handoff

See `~/bonfire/grimoires/bonfire/specs/wire-quest-ui-into-freeside-characters-2026-05-04.md`
for the cycle-Q wiring brief and the upstream SDD §8.3 packet spec.
