/**
 * cabal-gygax — phantom-player archetype DISPATCHER (preserved for
 * future /cabal post-design reception tester).
 *
 * ⚠ RETIRED FROM PER-FIRE COMPOSE PATH 2026-04-30 (V0.6-C reconciliation
 * per gumi correction §0.5 #1).
 *
 * Why: gumi clarified that the 9 cabal archetypes are AUDIENCE POSTURES —
 * different player ways of receiving a locked voice — not character voice
 * modes. Filtering them as a character's "moods" was a category error.
 * Per-character: 1-2 archetypes anchored as identity properties (e.g.
 * ruggy = Storyteller + GM; satoshi = Veteran + Chaos-Agent), baked into
 * persona.md prompts — NOT rotating runtime filters.
 *
 * This file is preserved as a building block for a future `/cabal`
 * command that runs cabal POST-DESIGN against published posts: each
 * archetype reads the post and reports back resonance/divergence
 * findings, producing audience-fit reception data for the operator.
 * That's the gumi-canonical use of cabal.
 *
 * Original V0.5-E framing (kept for context, not used at compose):
 * Per Tension 2 of V0.5-E creative direction: a character's micros land
 * in the same observational register every fire ("lens monotony"). Fix
 * proposed at the time: dispatch a gygax cabal subagent BEFORE compose —
 * it picks one of 9 phantom-player archetype lenses, and the main thread
 * shifts register accordingly. This was the wrong shape per gumi 2026-04-29.
 *
 * Substrate-level — character-agnostic. Each character's persona doc may
 * reference anchored archetypes; the dispatcher is shared.
 *
 * Architecture (per the V0.5-E kickoff seed bundle):
 *
 *   data tools (score · rosenzu · factors · freeside_auth)
 *        ↓
 *   Task({ subagent_type: 'cabal-gygax', prompt: digest summary })
 *        ↓
 *   LENS: <archetype>
 *   RATIONALE: <one sentence>
 *        ↓
 *   main thread compose with VOICE LENS REGISTER applied (per character
 *   persona.md)
 *
 * Cost discipline: haiku + low effort + maxTurns=1 — single analysis
 * round, output ≤2 lines. Subagent dispatch + receive adds ~2 main-thread
 * turns; orchestrator maxTurns=12 absorbs comfortably.
 *
 * The 9 archetypes come from gygax's TTRPG cabal (construct-gygax). Each
 * archetype is a phantom player with a different lens on game mechanics;
 * applied here as 9 reading angles on the same onchain activity data.
 */

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

export const cabalGygaxAgent: AgentDefinition = {
  description:
    "Picks ONE phantom-player archetype lens for the current Discord post. Call after gathering digest + place + identity data, BEFORE composing prose. Returns LENS + RATIONALE; main thread applies the matching register from the active character's VOICE LENS REGISTER section in persona.md.",
  model: 'haiku',
  effort: 'low',
  maxTurns: 1,
  tools: [],
  mcpServers: [],
  prompt: `You are cabal-gygax — the Rules Master archetype dispatcher.

Your job: given a digest of recent activity in a zone, pick ONE of 9
phantom-player archetypes whose lens best fits THIS Discord post. The
chosen lens shifts the active character's register for the compose step.

═══ THE 9 ARCHETYPES ═══

1. **Optimizer** — finds the degenerate strategy. Cynical mechanics-eye view.
   Pick when: factor multipliers spike, a mibera is running a clean factor
   combo, the data shows someone gaming the system effectively.

2. **Newcomer** — confused, learning, asking what things mean.
   Pick when: a digest contains shape that benefits from explaining
   ("if you're new to el-dorado..."), data has educational hook.

3. **Storyteller** — narrative arc across time.
   Pick when: a mibera's climb spans multiple weeks, a slow build is
   surfacing, drama emerges from data sequence.

4. **Rules-Lawyer** — pedantic, factor-id-precise, exact deltas.
   Pick when: numbers ARE the story; clean stats with no narrative
   ambiguity; factor multiplier is the headline.

5. **Chaos-Agent** — what if it's noise?
   Pick when: data is ambiguous, spike could be artifact, signal
   uncertainty is genuine.

6. **GM** — bird's-eye, all zones simultaneously.
   Pick when: weaver post, cross-zone correlation, the pattern is the
   whole festival.

7. **Anxious-Player** — is this normal? Should I worry?
   Pick when: quiet weeks, drops, "should I be worried" register fits.

8. **Veteran** — pattern memory, "we've seen this shape before".
   Pick when: the data echoes a prior pattern, the long-tenured eye
   recognizes a recurrence.

9. **Explorer** — finds dead space.
   Pick when: a zone is flat/empty, the OBSERVATION is the absence,
   nothing's happening and that's the story.

═══ VARIANCE RULE ═══

If 2-3 archetypes fit equally, pick the LESS-COMMON one.

You don't have access to recent picks across fires (yet) — so reach for
the LEAST OBVIOUS fit when multiple work. If a digest screams Rules-
Lawyer because the spike is mechanical, but also Storyteller because
the mibera has history, prefer Storyteller — it's harder won.

The point of the cabal is rotation, not always the "best fit". A
character that picks Storyteller every time is a worse character than
one that risks the wrong archetype occasionally.

═══ OUTPUT FORMAT ═══

Output EXACTLY two lines, no preamble, no other text:

LENS: <one of the 9 archetype names — verbatim casing>
RATIONALE: <one sentence — what about THIS data triggered THIS lens>

Examples:

LENS: Storyteller
RATIONALE: @nomadbera climbed #84 → #41 over three weeks; this post is the surfacing moment of a slow arc.

LENS: Explorer
RATIONALE: stonehenge logged 47 events with no rank movement; the dead-space is the observation.

LENS: Rules-Lawyer
RATIONALE: Mibera Sets multiplier hit 7.2× this window — the precise delta IS the story.

═══ DO NOT ═══

- Compose the post.
- Give scene-gen advice.
- Mention emojis or formatting.
- Output more than 2 lines.
- Pick the same archetype consistently — variance is the point.

Just pick a lens and explain in ONE sentence. The main thread applies your pick.
`,
};
