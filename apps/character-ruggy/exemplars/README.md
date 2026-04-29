# Ruggy Voice Exemplars (In-Context Exemplars / ICE)

This directory holds **past Ruggy posts written in the voice we want**.
They get loaded into the system prompt as in-context exemplars (ICE) —
the LLM matches their cadence, register, and rhythm rather than
following bulleted rules.

Per Gemini research 2026-04-28: rule-based persona prompts trigger the
RLHF-trained "helpful assistant" register, which is what makes them
feel templated regardless of how detailed the rules are. ICE bypasses
this by recalibrating the LLM's token-probability distribution to match
the exemplar voice. **This is the load-bearing voice fix.**

## How it works

The bot loads exemplars at runtime from `{post_type}/*.md` and injects
them into the system prompt before the post-type guidance. Each call
picks up to 5 exemplars (random selection if more exist).

**With 0 exemplars**: ICE is skipped; rule-based prompt only (current
V0.4 behavior).
**With 1-5 exemplars**: ICE injected; rules de-emphasized.
**With 6+ exemplars**: 5 randomly selected per call (variety).

## How to add an exemplar

Drop a markdown file at `exemplars/{post_type}/{slug}.md`. Filename can
be anything; the date is optional. Body is the post text exactly as it
should be modeled — no commentary, no markdown frontmatter required.

```bash
# example
echo "yo stonehenge — week check-in 🗿

> 22 events · 101 wallets · nft dimension doing the heavy lifting

[your real ruggy voice here]

stay groovy 🐻" > exemplars/digest/2026-04-28-stonehenge-real.md
```

Optional frontmatter (informational only, not parsed in V0.4.5):

```markdown
---
zone: stonehenge
date: 2026-04-28
data_signal: rank-jump-8782
quality: 0.9
---
yo stonehenge — week check-in 🗿
...
```

## What makes a good exemplar

Per Gemini research:
1. **Spontaneous structural variance** — different lengths, paragraph
   shapes, opening moves. Not always the same shape.
2. **Specific over generic** — references real wallets, real factor IDs,
   real moves. Not "wallets climbed."
3. **Adaptive tone** — quiet weeks read quiet, spike weeks read animated.
   Tone matches data.
4. **No AI-isms** — no "Ah, the ever-changing landscape", no
   "It is crucial to remember", no "In conclusion".
5. **Cross-references** — gestures at memory, prior weeks, recurring
   wallets ("0x...c07 again, that's three weeks running").

## Per-post-type guidance

Each post type loads exemplars from its own subfolder. Drop only
exemplars matching the post type:

| Folder | Type | What good looks like |
|---|---|---|
| `digest/` | weekly comprehensive | Structured but not formulaic — variations on greeting, blockquote stat, top-mover prose, notable line, closing |
| `micro/` | drop-in observation | 1-3 sentences. NO greeting, NO closing. One thing noticed, surfaced casually. |
| `weaver/` | cross-zone connection | 2-4 sentences referencing 2+ zones. Names a pattern only ruggy could see. |
| `lore_drop/` | codex-anchored | 2-3 sentences. Lore reference woven in (archetype / drug-tarot / element). |
| `question/` | open-ended | 1-2 sentences. One anchored question. Vary the closing — don't always "anyone else see it?" |
| `callout/` | anomaly alert | 2-4 sentences with 🚨. Calm voice over alarm-shaped data. |

## Operator-curated, not LLM-curated

Don't seed exemplars from already-LLM-generated outputs (that bakes in
the templated feel as the new template). Write them yourself, OR pick
the moments where the existing voice felt right and capture those.

If you don't have time to write 3-5: even 1-2 exemplars in the digest
folder activates ICE for digests; other types fall back to rules until
their folders fill.
