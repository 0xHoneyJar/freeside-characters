# Sprint Plan: V0.7-A.4 — Prefetch Grail Bytes (close cold-latency)

**Version:** 1.0
**Date:** 2026-05-02
**Author:** sprint-planner (V0.7-A.4 kickoff session)
**Spec Reference:** `~/bonfire/grimoires/bonfire/specs/freeside-characters-prefetch-grail-bytes-v07a4-kickoff.md` (combined PRD+SDD per `external_work_plan: true`)
**Cycle:** cycle-003 (V0.7-A.4 cold-latency cache substrate)
**Parent Doctrine:**
- `~/vault/wiki/concepts/metadata-as-integration-contract.md` (FIELD stable · URL operator-mutable · prefetch is operator-side cache strategy)
- `~/vault/wiki/concepts/environment-aware-composition.md` (V0.7-A.3 doctrine validated · cache extends bytes-on-the-wire ownership across cold paths)

> **Artifact shape**: kickoff brief is combined PRD+SDD per `external_work_plan: true` frontmatter — full architecture, invariants, blast radius, design rules, and verify gates already in spec §1-§9. This sprint plan decomposes spec §4 implementation steps into beads-tracked tasks. Single sprint (one phase A · cache substrate) per spec §4.

---

## Executive Summary

V0.7-A.4 closes the cold-latency gap operator-named in V0.7-A.3 dogfood (~21:08 PT 2026-05-02 · "feels a bit slow"):

**Cold first call ~28s → target <15s** by warming the canonical-grail PNG bytes at bot boot. Three cold contributions stack (Bedrock model cold + codex MCP qmd index load + CDN edge cold); we own #3 from V0.7-A.3 substrate. Boot prefetch with bounded concurrency populates a process Map; `composeWithImage` checks cache before falling through to live fetch.

**Substrate wins** from V0.7-A.3:
- ✓ env-aware bytes-on-the-wire composer (PR #21)
- ✓ search_codex envelope fix + URL strip (PR #22)
- ✓ composer polish + attachedUrls invariant (PR #23)

**Substrate adds** in V0.7-A.4:
- `grail-cache.ts` module (Map + TTL + boot prefetch + kill-switch)
- `embed-with-image.ts` cache-first fast path (existing fetch path becomes cache miss fallback + organic re-warm)
- `apps/bot/src/index.ts` boot init (after Discord client connect, before interactions handler)
- `dispatch.ts` cold-budget telemetry (`[cold-budget]` log line with `cache_hits` + `compose_ms` for STAMETS DIG)
- Env flag `GRAIL_CACHE_ENABLED=false` reverts to V0.7-A.3 behavior without redeploy

**STAMETS DIG (spec §4.0)**: telemetry ships in same PR so operators measure post-deploy. If CDN isn't a meaningful contributor (<10% of cold time), the kill-switch reverts and we investigate Bedrock provisioning OR qmd warm-keeper as separate cycles. Operator's qualitative "feels slow" treated as sufficient signal at V1; quantitative confirmation post-merge.

**Total:** 1 sprint · 1 phase (cache substrate) · 7 tasks · ~90 min estimated

**Inheritance baseline (verified at V0.7-A.3 merge · main `35e3465`):**
- ✓ `composeWithImage` ships bytes-on-the-wire to Discord webhook
- ✓ `composeReplyWithEnrichment` captures grail tool envelopes from SDK loop
- ✓ `attachedUrls` invariant lets composer strip inline URL pastes
- ✓ persona §11 anti-hallucination instructions land for ruggy + satoshi
- ✓ 162 persona-engine tests + 46 apps/bot tests baseline (208 total)
- ⚠️ Cold first-call ~28s vs spec §2.5 budget 15s — V0.7-A.4 closes

---

## Sprint Overview

| Sprint | Phase | Theme | Scope | Est. Hours |
|--------|-------|-------|-------|------------|
| 1 | A | Cache substrate + boot wiring + telemetry | MEDIUM (7 tasks) | ~1.5h |

> **Why one phase**: per kickoff §4.1 "option A for V1" — boot prefetch all canonical grails as a single bounded operation. No separate persona, no separate distribution surface; this is pure substrate plumbing.

---

## Goals (auto-assigned from spec §6)

| Goal ID | Goal | Source | Validation Method |
|---------|------|--------|-------------------|
| G-1 | Boot prefetch warms the canonical-grail PNG bytes before interactions handler accepts traffic | spec §3, §4.4 | bot boot log `grail-cache: init N/M cached in Xms` line · X<10s for V1 7-grail set |
| G-2 | composeWithImage cache-first fast path returns cached bytes WITHOUT invoking fetch on hit | spec §3, §4.3 | unit test mocks fetch as throwing; cache hit returns bytes; mock fetch never called · `cache_hits=N` surfaces in EnrichedPayload |
| G-3 | Cache miss falls through to live fetch AND populates cache for next call (organic re-warm) | spec §4.3 | unit test: first call live fetches + stores; second call same URL hits cache (mock fetch count stays at 1) |
| G-4 | TTL eviction drops stale entries · 24h refresh per spec §2 invariant 4 | spec §2 invariant 4 | unit test: pre-populate cache; mock Date.now past TTL; getGrailBytes returns null + entry evicted |
| G-5 | GRAIL_CACHE_ENABLED=false kill-switch disables BOTH cache lookup AND cache write | spec §7 (V1.5 deferred · kill-switch) | unit test: env=false, pre-populate cache, mock fetch returns different bytes; result returns LIVE bytes (cache skipped) AND no cache write fires |
| G-6 | Cold-budget telemetry log surfaces compose_ms · cache_hits · attached for STAMETS DIG measurement | spec §4.0 | dispatch.ts `[cold-budget] character=X compose_ms=N tool_uses=N tool_results=N attached=N cache_hits=N` log line emitted on every chat reply |
| G-7 | KEEPER pass post-deploy: cold first-call compose_ms <15s (was ~28s) | spec §6 success criteria · operator-bounded | post-merge dev-guild `/satoshi prompt:"the dark grail"` cold pair · `compose_ms` from `[cold-budget]` log <15s |

---

## Sprint 1: V0.7-A.4 — Prefetch Grail Bytes

**Duration:** ~90 min compute
**Date:** 2026-05-02
**Scope:** MEDIUM (7 tasks · single phase)

### Sprint Goal

Ship the `grail-cache.ts` substrate + boot wiring + cache-first fast path + cold-budget telemetry as a single PR. Kill-switch lets operators disable post-deploy if STAMETS DIG shows CDN isn't the bottleneck. KEEPER pass G-7 is operator-bounded post-merge.

### Phase A — Cache Substrate + Boot Wiring (§4.2-§4.5)

#### Task T1.1: `grail-cache.ts` module [G-1, G-2, G-3, G-4]

Create `packages/persona-engine/src/deliver/grail-cache.ts`:
- Export `interface InitOptions { concurrency?: number; timeoutMs?: number; urls?: ReadonlyArray<string>; }`
- Export `interface InitResult { fetched: number; failed: number; durationMs: number; }`
- Export `async function initGrailCache(opts?: InitOptions): Promise<InitResult>` — bounded-concurrency Promise.all chunking
- Export `function getGrailBytes(url: string): Buffer | null` — TTL check + auto-evict on expiry
- Export `function setGrailBytes(url: string, data: Buffer): void` — for runtime cache fill
- Export `function isCacheEnabled(): boolean` — reads `GRAIL_CACHE_ENABLED` env (defaults true)
- Hardcoded `CANONICAL_GRAIL_URLS` for V1 (7 grails verified in V0.7-A.3 dogfood · symmetric to grail-ref-guard's 7-id set)
- Concurrent-init dedup via `initInFlight` Promise (prevents double-fetch on test reentrance / dev-mode HMR)
- Per-URL failures non-blocking (logged, counted in `InitResult.failed`)
- Test-only helpers `_resetGrailCacheForTests` + `_grailCacheSizeForTests` + `_canonicalGrailUrlsForTests`

**AC**: file exports per spec §4.2 reference impl · ~250 LOC · uses global fetch + AbortSignal.timeout (no new dep) · symmetric URL allowlist with `embed-with-image.ts` SSRF guard

#### Task T1.2: cache-first fast path in `embed-with-image.ts` [G-2, G-3]

Modify `fetchAttachment` in `packages/persona-engine/src/deliver/embed-with-image.ts`:
- After SSRF allowlist check, before live fetch: `if (isCacheEnabled() && (cached = getGrailBytes(url))) return { file: {...}, sourceUrl: url, cacheHit: true }`
- After successful live fetch: `if (isCacheEnabled()) setGrailBytes(url, data)` — organic re-warm
- Extend `FetchedAttachment` interface with `cacheHit: boolean` field
- Compute `cacheHits` count in `composeWithImage` and surface on `EnrichedPayload` (new optional field)

**AC**: cache-first lookup + organic re-warm wired · `EnrichedPayload.cacheHits` reflects actual cache effectiveness · existing 162 tests still pass · signature unchanged (additive only)

#### Task T1.3: boot wiring in apps/bot main entry [G-1]

Modify `apps/bot/src/index.ts`:
- Import `initGrailCache` + `isGrailCacheEnabled` from persona-engine
- After Discord client connect, before interactions handler registration: `if (isGrailCacheEnabled()) { const r = await initGrailCache(); console.log('grail-cache: init N/M cached in Xms') }`
- Wrap in try/catch — programming-error throws shouldn't crash the bot (per spec §2 invariant 7)
- DISABLED log line when env flag set false

**AC**: boot log shows `grail-cache: init N/M cached in Xms` line · placement after `discord:` log · before `interactions:` log

#### Task T1.4: env-gated kill-switch in config + readouts [G-5]

Build into the cache module itself (read at call time, not config-validated):
- `isCacheEnabled()` reads `process.env.GRAIL_CACHE_ENABLED` directly
- Defaults true; `false` or `0` disables; any other value defaults to enabled
- Re-exported from persona-engine as `isGrailCacheEnabled` (avoids name clash if config grows)

> **Why not in `config.ts`**: kill-switch needs to be readable by the cache module without a config object reference (composeWithImage's fetchAttachment is character-agnostic substrate). Direct env-read keeps the cache self-contained; cost is one process.env lookup per fetchAttachment call (negligible).

**AC**: `isCacheEnabled()` returns false when `GRAIL_CACHE_ENABLED=false` · cache lookup AND cache write both skipped when disabled · kill-switch testable in isolation via env mutation

#### Task T1.5: cold-budget telemetry log [G-6]

Modify `apps/bot/src/discord-interactions/dispatch.ts` after the existing post-compose `interactions:` delivered log:
- Emit `[cold-budget] character=X compose_ms=N total_ms=N tool_uses=N tool_results=N attached=N cache_hits=N text_len=N` log line
- Sourced from existing values + `result.payload.cacheHits` (new field from T1.2)
- Single line, line-oriented (no JSON envelope cost on hot path)
- Aligns with operator's [cold-budget] grep convention

**AC**: log line emits on every chat dispatch · STAMETS DIG can measure CDN contribution from cache_hits×fetch_ms (operator post-deploy)

#### Task T1.6: unit tests for grail-cache [G-1, G-2, G-3, G-4, G-5]

Create `packages/persona-engine/src/deliver/grail-cache.test.ts`:
- happy path: initGrailCache populates cache + InitResult counts + canonical URL list shape
- failures: per-URL fetch fail/throw/empty body counted as `failed` non-blocking
- concurrent dedup: parallel initGrailCache calls share single Promise, single fetch per URL
- TTL: cache hit immediate · null after TTL + auto-evict · just-under-TTL still hits
- isCacheEnabled env flag: defaults true, false/0 disable, other treated as enabled
- setGrailBytes: live-fetch organic re-warm pattern + overwrite refreshes cachedAt

**AC**: 16+ tests pass via `bun test packages/persona-engine/src/deliver/grail-cache.test.ts`

Extend `packages/persona-engine/src/deliver/embed-with-image.test.ts`:
- cache-hit fast path: pre-populate cache; mock fetch as throwing; verify NO fetch invocation + cached bytes returned + `cacheHits=1`
- cache-miss organic re-warm: first call live-fetches + stores; second call same URL stays at fetch count 1 + `cacheHits=1`
- mixed cache+live: counts hits separately
- defensive sanity (cacheHits ≤ files.length)
- text-only graceful degrade: cacheHits absent when files absent
- kill-switch: GRAIL_CACHE_ENABLED=false skips cache lookup AND cache write

**AC**: 8+ new tests pass; existing 23 V0.7-A.3 tests still pass; reset cache in beforeEach to prevent cross-test pollution

#### Task T1.7: WITNESS QA cycle file [G-1, G-7]

Create `grimoires/loa/qa/qa-cycle-V07A4-2026-05-02.md`:
- Capability landscape preamble (cold-latency closure substrate + kill-switch revert path + STAMETS DIG telemetry)
- 5 verification surfaces (S0-S4):
  - S0: typecheck + tests green (auto-verifiable in CI)
  - S1: bot boot log shows `grail-cache: init N/M cached in <10s`
  - S2: `/satoshi prompt:"the dark grail"` cold first call · `[cold-budget] compose_ms <15s` (was ~28s)
  - S3: immediate second call · `cache_hits=1` in cold-budget log + `compose_ms <8s`
  - S4: kill-switch revert · `GRAIL_CACHE_ENABLED=false` · boot log says DISABLED · cold-budget shows cache_hits=0

**AC**: file at canonical path · ≤7 surfaces per checklist · capture paths specified · triage paths concrete (felt-outcomes per `feedback_witness_qa_richness`)

### Acceptance Criteria (sprint-level)

- [ ] AC-1: `initGrailCache()` populates Map for canonical URLs + returns telemetry InitResult (T1.1)
- [ ] AC-2: cache-first fast path skips fetch on hit + populates on miss (T1.2)
- [ ] AC-3: boot wiring fires before interactions handler accepts traffic (T1.3)
- [ ] AC-4: GRAIL_CACHE_ENABLED=false reverts cache lookup + write (T1.4)
- [ ] AC-5: `[cold-budget]` log line emits on every chat dispatch (T1.5)
- [ ] AC-6: 16+ cache tests + 8+ embed-with-image extension tests pass (T1.6)
- [ ] AC-7: `bun run typecheck` clean across workspace
- [ ] AC-8: 162 prior persona-engine tests + 46 apps/bot tests still pass (zero regressions)
- [ ] AC-9: WITNESS regression covers S0-S4 (T1.7)
- [ ] AC-10: PR opened against `freeside-characters:main`

### Operator-Bounded (post-merge KEEPER pass)

- [ ] G-7 (post-deploy): `/satoshi prompt:"the dark grail"` cold pair in operator dev guild · `compose_ms` from `[cold-budget]` log <15s · subsequent same-prompt warm call <8s
- [ ] STAMETS DIG (post-deploy): operator confirms CDN was meaningful (`cache_hits=1` correlates with substantial compose_ms reduction) · if not, set `GRAIL_CACHE_ENABLED=false` and investigate Bedrock provisioning OR qmd warm-keeper as separate cycles

### Dependencies

- V0.7-A.3 cycle-002 SHIPPED (PR #21 + #22 + #23 merged · main `35e3465`)
- composeWithImage substrate PR #21 — cache extends this surface
- canonical-grail URL allowlist already in `embed-with-image.ts` (`assets.0xhoneyjar.xyz`) — symmetric in cache

### V1.5 Deferred (per spec §7)

- LRU eviction (when image set grows >100MB)
- Disk-backed cache (across bot restarts)
- Signal-based invalidation (codex MCP push notification on grail update)
- Mibera image cache (10K resident OR LRU-bounded)
- Archetype + zone image cache
- Pre-warm Bedrock + qmd as well (separate cycles · spec §0 cold-start contributors #1 #2)
- Dynamic URL discovery via `mcp__codex__list_archetypes` (replaces hardcoded V1 list)
