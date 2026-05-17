# Sprint 0 — COMPLETED


## S0/T0.1 — Zone-registry call-site audit

Generated: 2026-05-17T04:11:37.042Z

Scans `packages/`, `apps/`, `scripts/` for ZONE_FLAVOR + ZONE_LABEL usage.


Total call sites: **39**

- Inside `packages/persona-engine/src/`: 31
- **Outside (D1 scope-expansion candidates)**: 8


| file:line | variable | context | scope |
|---|---|---|---|
| `apps/bot/src/cli/digest-once.ts:24` | `ZONE_FLAVOR` | `ZONE_FLAVOR,` | 🚨 **scope expansion** |
| `apps/bot/src/cli/digest-once.ts:73` | `ZONE_FLAVOR` | `console.log(`zones: ${zones.map((z) => `${ZONE_FLAVOR[z].emoji} ${z}`).join(' · ')}`);` | 🚨 **scope expansion** |
| `apps/bot/src/index.ts:30` | `ZONE_FLAVOR` | `ZONE_FLAVOR,` | 🚨 **scope expansion** |
| `apps/bot/src/index.ts:71` | `ZONE_FLAVOR` | `console.log(`zones:          ${selectedZones(config).map((z) => `${ZONE_FLAVOR[z].emoji} ${z}`).join` | 🚨 **scope expansion** |
| `apps/bot/src/lib/channel-zone-map.ts:18` | `ZONE_FLAVOR` | `ZONE_FLAVOR,` | 🚨 **scope expansion** |
| `apps/bot/src/lib/channel-zone-map.ts:37` | `ZONE_FLAVOR` | `* grounding. Sync read from `ZONE_FLAVOR` in `score/types.ts`.` | 🚨 **scope expansion** |
| `apps/bot/src/lib/channel-zone-map.ts:41` | `ZONE_FLAVOR` | `* through the orchestrator (Phase D / Sprint 3); until then, `ZONE_FLAVOR`` | 🚨 **scope expansion** |
| `apps/bot/src/lib/channel-zone-map.ts:49` | `ZONE_FLAVOR` | `return ZONE_FLAVOR[zone];` | 🚨 **scope expansion** |
| `packages/persona-engine/src/compose/agent-gateway.ts:50` | `ZONE_FLAVOR` | `import { ZONE_FLAVOR } from '../score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:391` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:448` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:461` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:466` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:473` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/agent-gateway.ts:483` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/compose/environment.ts:11` | `ZONE_FLAVOR` | `*   place  — zone identity (emoji + name + dimension) from ZONE_FLAVOR` | ✅ in-scope |
| `packages/persona-engine/src/compose/environment.ts:25` | `ZONE_FLAVOR` | `import { ZONE_FLAVOR } from '../score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/compose/environment.ts:69` | `ZONE_FLAVOR` | `const codexAnchor = args.zone ? ZONE_FLAVOR[args.zone] : null;` | ✅ in-scope |
| `packages/persona-engine/src/compose/headline-lock.ts:26` | `ZONE_FLAVOR` | `* ZONE_FLAVOR — the codex becomes the single source of world-element truth.` | ✅ in-scope |
| `packages/persona-engine/src/compose/headline-lock.ts:29` | `ZONE_FLAVOR` | `import { ZONE_FLAVOR, type ZoneId } from '../score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/compose/headline-lock.ts:73` | `ZONE_FLAVOR` | `const canonical = ZONE_FLAVOR[zone].emoji;` | ✅ in-scope |
| `packages/persona-engine/src/deliver/embed.ts:30` | `ZONE_FLAVOR` | `import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/deliver/embed.ts:117` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/deliver/embed.ts:169` | `ZONE_FLAVOR` | `const flavor = ZONE_FLAVOR[digest.zone];` | ✅ in-scope |
| `packages/persona-engine/src/index.ts:209` | `ZONE_FLAVOR` | `// Score helpers — bot's CLI uses ZONE_FLAVOR for log emoji + counts` | ✅ in-scope |
| `packages/persona-engine/src/index.ts:210` | `ZONE_FLAVOR` | `export { ZONE_FLAVOR, getWindowEventCount, getWindowWalletCount } from './score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/persona/loader.ts:27` | `ZONE_FLAVOR` | `import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';` | ✅ in-scope |
| `packages/persona-engine/src/persona/loader.ts:268` | `ZONE_FLAVOR` | `shape.kind === 'cron' ? ZONE_FLAVOR[shape.zoneId].name : 'this conversation';` | ✅ in-scope |
| `packages/persona-engine/src/persona/loader.ts:271` | `ZONE_FLAVOR` | `? DIMENSION_NAME[ZONE_FLAVOR[shape.zoneId].dimension]` | ✅ in-scope |
| `packages/persona-engine/src/score/types.ts:27` | `ZONE_FLAVOR` | `//   ZoneId, ZONE_IDS, ZONE_TO_DIMENSION, ZONE_FLAVOR` | ✅ in-scope |
| `packages/persona-engine/src/score/types.ts:53` | `ZONE_FLAVOR` | `export const ZONE_FLAVOR = {` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:20` | `ZONE_LABEL` | `const ZONE_LABEL = {` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:146` | `ZONE_LABEL` | `voiceContent: voice ? `${ZONE_LABEL[snapshot.zone]}\n${voice}` : ZONE_LABEL[snapshot.zone],` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:213` | `ZONE_LABEL` | `facts.push(`${ZONE_LABEL[snapshot.zone]} · ${snapshot.totalEvents} events / ${snapshot.windowDays}d`` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:222` | `ZONE_LABEL` | `voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · checking in`,` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:229` | `ZONE_LABEL` | `voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · from the codex`,` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:236` | `ZONE_LABEL` | `voiceContent: voiceLine(augment) || `${ZONE_LABEL[snapshot.zone]} · ?`,` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:247` | `ZONE_LABEL` | `name: ZONE_LABEL[z.zone],` | ✅ in-scope |
| `packages/persona-engine/src/live/discord-render.live.ts:263` | `ZONE_LABEL` | `voiceContent: voiceLine(augment) || `🚨 ${ZONE_LABEL[snapshot.zone]} · callout`,` | ✅ in-scope |

### ⚠️ Scope expansion required

8 call sites exist OUTSIDE `packages/persona-engine/src/`. D1 migration in S1/T1.3 must include these files.

---
Operator: please confirm scope (✅ accept) or expand (🔁 add outside-engine files to S1/T1.3).
## S0/T0.2 — Discord Android typography spike

Generated: 2026-05-17T04:40:00.888Z

**Mode**: mechanical proxy (LOA_OPERATOR_UNAVAILABLE=1 · no Discord POST · local text fixtures only)

### Decision (mechanical default)

```yaml
chosen_padding_char: "\u2007"  # U+2007 FIGURE SPACE
evidence_paths: [".run/cycle-007-s0-t02-typography/*.txt"]
rationale: "mechanical default · operator unavailable for Android attestation · S3 acceptance gate degrades to byte-snapshot only"
fallback_chain: ["\u2008", "\u00A0", "code-block-wrap"]
```

---
S3 reads this decision block · refuses to start if missing/invalid (per Flatline IMP-014 + SDD §2.8).