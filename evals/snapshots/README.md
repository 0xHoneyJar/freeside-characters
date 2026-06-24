# Behavioral Snapshot Baseline (Sprint 1 / S0)

Pre-refactor golden snapshots — the regression net DURING the cycle-004 substrate
refactor, BEFORE the eval harness exists. Per sprint.md Sprint 1 + SDD §1.5.

## What a snapshot captures

Each `pre-refactor/<character>-<zone>-<post_type>.snapshot.yaml` records the
**deterministic surface** of current output — the part that is *code-determined*
and therefore stable across runs:

- `content_populated` + `content` — the message content line
- `embed_color` — the zone/room color
- `embed_footer_pattern` — footer shape (timestamps abstracted to `<ISO8601>`)
- `tool_call_trace` — tool-call sequence + identity
- `no_leak_checks` — tool-markup leak, raw emoji shortcode (both must be `false`)

`rendered_prose` is recorded for reference but is **NOT the regression signal** —
raw LLM prose is non-deterministic (SDD §1.5). Under `STUB_MODE=true` the prose is
canned and therefore stable, so it is captured here as a reference; the diff that
gates the refactor is the deterministic surface only.

## Why these are agent-captured (no operator gate)

Per sprint.md v0.6 (reconciled with SDD §1.5): the deterministic surface comes
from the *code*, not the LLM provider or the Discord transport. Capturing it via
the repo's local CLI (`bun run digest:once` with delivery env emptied → forced
`DRY-RUN`) is equivalent to a production-Discord capture *for the regression-net
function*. No bot token is loaded; no Discord post occurs.

Optional, non-blocking: the operator MAY later add production-fidelity prose
snapshots — they are not the regression signal and do not gate the cycle.

## How to capture

```bash
# digests (one per zone) — forced dry-run, no Discord post:
STUB_MODE=true DISCORD_BOT_TOKEN= DISCORD_WEBHOOK_URL= ANTHROPIC_API_KEY= \
  bun run digest:once

# alt post types:
STUB_MODE=true POST_TYPE=micro DISCORD_BOT_TOKEN= DISCORD_WEBHOOK_URL= \
  bun run digest:once   # repeat for weaver / lore_drop / question / callout
```

Each snapshot carries provenance: `capture_id`, `bot_commit_sha`, `adapter`,
`captured_at`. Run a redaction pass (secret scan, wallet/handle scrub) before
commit — stub data uses synthetic wallets, but the discipline holds for any
future live captures.

## How snapshots become Sprint 2 fixtures

Sprint 2 (S1A) front-loads conversion: every conformant snapshot here becomes an
`evals/fixtures/*.fixture.yaml` so each later sprint runs the full corpus, not a
subset (Flatline Sprint SKP-003).

## Status (S0 progress · 2026-05-14)

- [x] S0.T1 — directory created
- [x] S0.T2 — 4 digest snapshots captured (stonehenge, bear-cave, el-dorado, owsley-lab)
- [x] S0.T3 — 5 alt-post-type snapshots captured on ruggy (micro/weaver/lore_drop/question/callout)
- [x] S0.T5 — this README
- [x] S0.T7 — provenance inline in all 9 snapshots (`capture_id` + `bot_commit_sha` + `adapter` + `captured_at`)
- [ ] S0.T4 — chat-mode replies — **needs a chat-mode capture harness** (`composeReply` path; no `reply:once` CLI exists yet). Build via `/implement`, then capture ruggy + satoshi ×3 + other characters ×1.
- [ ] S0.T6 — final commit + canonical re-affirm

9 snapshots committed (4 digest + 5 alt-post-type). 5/6 acceptance criteria met; resume via `/run-resume` for S0.T4.
