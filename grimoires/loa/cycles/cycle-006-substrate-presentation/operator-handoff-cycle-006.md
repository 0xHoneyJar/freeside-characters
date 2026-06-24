# cycle-006 · operator handoff (live-behavior commits + deferred work)

> Per CLAUDE.md "operator-attested live-behavior changes accumulate" pattern.
> Each item below requires explicit operator authorization before merging
> to main / executing in production.

## Cron wire-ups (T7.4 deferred to operator)

These are configuration commits the operator must execute post-merge:

### 1. Daily-pulse cron schedule

The `pulse-orchestrator.ts::composeActivityPulse` is wired and tested but
NOT scheduled. To enable daily pulse posts:

```typescript
// apps/bot/src/cron/scheduler.ts (or similar entry point)
import { composeActivityPulse } from '@freeside-characters/persona-engine/orchestrator/pulse-orchestrator';

// Schedule pattern (operator-tunable):
cron.schedule('0 9 * * *', async () => {  // 09:00 UTC daily
  const message = await composeActivityPulse(config);
  await deliverActivityPulse(config, primary, message);
});
```

Operator decisions deferred:
- **Cadence**: daily / 2× daily / weekly?
- **Target channel**: hub channel (stonehenge) or per-zone routing?
- **Delivery adapter**: needs `deliverActivityPulse(config, character, message)` companion to `deliverZoneDigest`.

### 2. Digest cron (existing, unchanged)

No action required. cycle-005's weekly Sunday-midnight digest cadence is
preserved through the orchestrator path (composer.ts dispatches digest
through composeDigestPost).

## S5 deferred items (chat-reply migration)

S5 landed the AC-RT-007 foundation (3-tuple `keyForChatReply`) + the new
orchestrator entry point. The full cutover requires:

- **T5.5** Update `apps/bot/src/discord-interactions/dispatch.ts` to call
  `composeChatReply(config, character, { guildId, channelId, userId, prompt })`
  instead of `composeReplyWithEnrichment(...)`. `guildId` is now required
  for tuple-key construction.
- **T5.7** After T5.5 lands and is staging-tested, delete
  `compose/reply.ts::composeReplyWithEnrichment` (the thin shim path).
- **T5.8** Staging dev-guild canary: run chat-mode test prompts in
  staging guild, capture operator visual sign-off, then merge to main.

These were deferred per kaironic context budget — the production chat-reply
path is high-traffic and warrants its own focused review session.

## S6 deferred items (voice-memory production wiring)

The voice-memory primitive is NOT yet wired into production. S6 ships:

- TypeBox schema for `VoiceMemoryEntry`
- `live/voice-memory.live.ts` per-key mutex + path-traversal allowlist
  (AC-RT-001 closure)
- All 7 orchestrators wire voice-memory read (via `formatPriorWeekHint`
  from S1) + write
- Schema-enforced `(guildId, channelId, userId)` for chat-reply
  (AC-RT-007 schema closure)
- 90-day TTL + `/admin forget-user` slash command (FLATLINE-SKP-004)
- Multi-process detection (FLATLINE-SKP-001/HIGH)
- Legacy `.run/ruggy-voice-history.jsonl` migration shim (OQ-3 default)

This is the heaviest sprint (10 tasks · ~+700 LoC). It requires its own
focused session given the Red Team + Flatline blocker amendments.

## Deferred staging canaries (S8 operator-attested)

- Production canary for digest (post-cycle-005 substrate cutover validation)
- Chat-reply staging canary (T5.8 above)
- Pulse cadence canary (T7.4 above)

## Ledger flip

After all sprints close + staging canaries pass, the cycle-006 ledger
entry should flip from `status: active` to `status: archived` per
cycle-005's lifecycle pattern.

```bash
# grimoires/loa/ledger.json
jq '.cycles |= map(if .id == "cycle-006-substrate-presentation"
  then .status = "archived" | .archived_at = "<ISO date>"
  else . end)' grimoires/loa/ledger.json
```

## Summary

The cycle-006 implementation work (S0-S7 of 9 sprints) is structurally
complete. What remains is:

1. **S6 voice-memory production wiring** — the heaviest remaining sprint
2. **S8 OTEL + canary + cycle close** — operator-attested verification
3. **Operator-attested live commits** — items in this doc

The deferred S5 items (T5.5/T5.7/T5.8) can be absorbed into S6 or S8
depending on operator preference.
