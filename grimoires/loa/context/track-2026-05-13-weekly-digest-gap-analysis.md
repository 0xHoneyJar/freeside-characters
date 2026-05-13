---
title: weekly digest gap analysis — ruggy vs score-dashboard data surface
status: candidate
mode: pre-planning
created: 2026-05-13
source_session: /goal end-to-end test + dashboard gap analysis (2026-05-13)
expiry: until persona update lands OR operator revokes
use_label: usable
boundaries:
  - score-mibera is the substrate (data accuracy paramount); does not change here
  - characters are voicing layer over substrate; creative expression within typed contracts
  - tool / schema contracts (cycle-021) are well-defined and locked; only persona-level guidance changes
  - persona.md edits require sync-back to bonfire grimoires per CLAUDE.md
related-cycles:
  - score-mibera cycle-021 (pulse tools merged 2026-05-13, 4 tools live)
  - freeside-characters #73 (consumer-side wiring merged 2026-05-13)
---

# track · weekly digest gap analysis (ruggy ↔ score-dashboard)

## frame

Operator (2026-05-13, /goal): *"If you take a look at the score dashboard UI, you'll see exactly what we should show for each dimension. ... Review all dimensions/zones/channels and their weekly updates/announcements and raise gaps against the rich data that we are showing within score-dashboard."*

Score = substrate (data validity paramount). Characters = voicing layer. Tools / schemas / contracts are well-defined; creative freedom in expression.

## what score-dashboard surfaces (canonical reference)

Score-dashboard (`0xHoneyJar/score-dashboard`) renders three dimension pages (OG · NFT · Onchain) + a home/pulse cross-dim page. **No zone-specific UI** — dashboard is dimension-first; zones are a character-side framing.

### Per-dimension page (`/dimension/[id]`)

| Element | Data shape | Source |
|---|---|---|
| KPI hero | `total_events` + `delta_pct` vs prior period + diversity chip "X of Y factors active" | `get_dimension_breakdown` |
| Hot factors table | All factors with `total > 0`, sorted desc by total · sparkline · `delta_pct` per factor | `get_dimension_breakdown.top_factors` |
| "Went Quiet" section | Cold factors (≤10) with `was X` prior + sort by previous DESC | `get_dimension_breakdown.cold_factors` |
| Window selector | 7d / 30d / 90d (scaled PoP deltas) | `window` param |

### Home/pulse page (`/`)

| Element | Data shape | Source |
|---|---|---|
| KPI strip (5 stats) | `active_members` · `active_7d` · `new_in_window` · `recently_churned` · stickiness (`active_7d / active_30d`) | `get_community_counts` |
| Dimension cards (3) | Each: hero + diversity + sparkline + top-5 factors | `get_dimension_breakdown` |
| Recent activity rail | Last 25 events: dim-accent + wallet display + relative ts + description | `get_recent_events` |
| Most active wallets panel | Top 6 by event count + multi-dim badge when `dimension_count > 1` | `get_most_active_wallets` |

### Common across all pages

- **Identity surfacing**: MIDI display-name resolution via `resolve_wallet`/`resolve_wallets`, truncated address fallback (`0x####…####`). ✓ already in ruggy persona.
- **Temporal patterns**: weekly sparklines, relative timestamps ("3m ago", "2h ago"), `in_progress` flag on current incomplete week.
- **Trust signals**: flagged wallets excluded from most-active by default.
- **Factor labels**: `primary_action` (verb-form, e.g., "Received Mibera", "Traded").

## what ruggy currently emits (weekly digest baseline)

Per `apps/character-ruggy/persona.md:462-471` digest-shape doctrine + line 713 tool-call directive:

| Element | Source | Notes |
|---|---|---|
| Opener (greeting line) | LLM-generated | casual register, `yo team`/`henlo midi watchers` |
| Headline stat | `raw_stats.window_event_count` + `window_wallet_count` + factor_trends count | `> N events · M actors · K factors moved` |
| Top-mover prose | `factor_trends` + `top_movers` | 1-3 sentences naming factors that carried the week |
| Notable lines | `rank_changes` (climbed/dropped/entered/exited) with directional emoji | 🟢 🪩 🌊 👀 🚨 prefixes |
| Closing | persona signoff | digest-only retains "stay groovy 🐻" |
| Footer | `digest.computed_at` | now staleness-aware (V0.12.0 fix 2026-05-13) |

**Tools currently called**:
- `mcp__score__get_zone_digest` (primary, REQUIRED · persona.md:713)
- `mcp__rosenzu__get_current_district` + `furnish_kansei` (spatial)
- `mcp__codex__describe_factor` + `lookup_factor` (factor lore)
- `mcp__freeside_auth__resolve_wallet`/`resolve_wallets` (identity chain)
- Optional supplementary: `get_leaderboard_changes`, `get_recent_activity`, `get_wallet_spotlight`, `get_factor_trends`

**Tools NOT currently called in weekly digest** (cycle-021 pulse tools, available since 2026-05-13):
- `get_community_counts` — active_members, stickiness, new, churned with PoP deltas
- `get_dimension_breakdown` — hot/cold factor lists with delta_pct + diversity (active_factor_count / total_factor_count)
- `get_recent_events` — by_factor rollup
- `get_most_active_wallets` — event-count ranking with multi-dim signal

The cycle-021 tools ARE in `character.json::tool_invocation_style` and ARE used in chat-mode (`/ruggy <prompt>`), but the digest fragment in `persona.md` predates cycle-021 and doesn't direct the LLM to call them when composing weekly digests.

## gap matrix

| # | Gap | Dashboard has | Ruggy digest has | Closeable via | Priority |
|---|---|---|---|---|---|
| 1 | **Cold factors / "Went Quiet"** | explicit Went Quiet section | not surfaced | `get_dimension_breakdown.cold_factors` | HIGH |
| 2 | **Most active by event-count** | top-6 wallets panel | rank-change-based top_movers (different signal) | `get_most_active_wallets` | HIGH |
| 3 | **Diversity chip** (X of Y factors active) | per-dim chip | not surfaced | `get_dimension_breakdown.inactive_factor_count` + `total_factor_count` | MED |
| 4 | **Active members + stickiness** | primary KPI on home | "M actors" approximate (wallet count in window) | `get_community_counts.active_members` + `stickiness` | MED |
| 5 | **PoP delta surfacing** | every metric has delta arrow + % | factor_trends.multiplier (current vs baseline, similar but different) | `get_dimension_breakdown.delta_pct` + `get_community_counts.deltas` | MED |
| 6 | **Multi-dim wallet badge** | "X dims" badge when active across 2+ | not surfaced | `get_most_active_wallets.dimension_count > 1` | LOW |
| 7 | **By-factor recent activity** | recent events rail (live) | not surfaced (this is the chat-mode case via `get_recent_events`) | `get_recent_events.by_factor` | LOW for digest |
| 8 | **Sparklines** | weekly sparklines everywhere | no equivalent in Discord text | n/a (visual-only, doesn't translate to chat medium) | n/a — defer / doesn't apply |
| 9 | **Window selector** | 7d/30d/90d | weekly cron-fired only | operator-owned cadence (per cycle-021 doctrine) | n/a — operator cadence, not closeable in digest |

## proposed persona update (draft, not applied)

Extend the `@FRAGMENT: digest` block in `apps/character-ruggy/persona.md:1256+` with a new "WHAT ELSE TO CALL" subsection that directs the LLM to also fire pulse tools for dim-mapped zones:

```markdown
### Pulse-tool enrichment for weekly digests (cycle-021)

After `mcp__score__get_zone_digest`, ALSO call the cycle-021 pulse tool
matching the zone's dimension:

- **bear-cave (OG)** → `mcp__score__get_dimension_breakdown({window: 7, dimension: "og"})`
- **el-dorado (NFT)** → `mcp__score__get_dimension_breakdown({window: 7, dimension: "nft"})`
- **owsley-lab (Onchain)** → `mcp__score__get_dimension_breakdown({window: 7, dimension: "onchain"})`
- **stonehenge (cross-zone hub)** → `mcp__score__get_community_counts({window: 7})` + `mcp__score__get_most_active_wallets({window: 7, limit: 5})` (chain `resolve_wallets` on the wallet array)

Surface in the digest:
- **Hot factors**: use `dimension_breakdown.top_factors` to enrich the top-mover prose with verb-form names (`primary_action`) when the factor isn't named in `factor_trends`. Cite delta_pct.
- **Cold factors ("went quiet")**: add a notable line `🌫 went quiet: <factor>, <factor> · was N+ last window` when `dimension_breakdown.cold_factors.length > 0` AND any cold factor's `previous > 5` (don't surface trivial cold misses).
- **Diversity signal**: when `inactive_factor_count / total_factor_count > 0.5` (more than half a dim's factors are silent), add a one-line concentration note `concentration: only X of Y factors lit this week`.
- **Stonehenge stickiness**: lead with `> N active miberas (NN% stickiness)` instead of raw event count when stickiness signal is meaningful (active_7d > 0).
- **Most active recognition**: for stonehenge, optionally add a "this week's most active" callout list (top 3-5) with multi-dim badge for cross-dim wallets.

Keep the digest hard budget intact (80-140 words, ≤6 lines prose) — pulse-tool data ENRICHES the existing structure, doesn't bloat it. Cite numbers verbatim from tool responses; never invent.
```

## non-goals (out of scope this track)

- ❌ Replacing `get_zone_digest` with cycle-021 tools (legacy zone tool stays per cycle-021 S6 decision)
- ❌ Adding new MCP tools to score-mibera (substrate is locked; this is consumer-side framing)
- ❌ Adding dedicated cron cadences for daily/hourly pulse posts (operator-owned cadence track)
- ❌ Changing the digest visual structure or word budget
- ❌ Sparklines / window-selector parity (medium mismatch; Discord text vs HTML)

## open questions

1. **Sync-back to bonfire grimoires?** Per `CLAUDE.md`, persona.md edits should sync upstream first. Does this track wait for bonfire-side update OR can we apply locally first and sync back?
2. **Apply now or stage in chat first?** Could test the new instructions via `/ruggy` chat invocations before locking into the weekly digest fragment. Lower-risk validation path.
3. **`character.json::tool_invocation_style` vs `persona.md @FRAGMENT: digest`** — both are persona surface. The cycle-021 fix landed in `tool_invocation_style` (chat-mode oriented). This track proposes the digest-fragment edit (cron-fired oriented). Two surfaces for two paths — is that the right separation, or should they unify?
4. **Substrate-side investigation for stale `computed_at`** (B3 from same session) is a separate score-mibera-side ticket — not blocked by this track, but the staleness-aware footer that just landed (V0.12.0) surfaces the issue clearly until the substrate refresh-cadence is verified.

## activation receipts

- `score-dashboard` repo inventory via Explore agent (2026-05-13) — usable, boundaries: data shape only, not visual design choices
- production digest screenshots 2026-05-13 (operator-supplied) — usable, repro of B1/B2/B3 bugs
- operator framing 2026-05-13: "score is substrate / characters are voicing layer / tools+schemas+contracts cleanly defined / creative freedom in expression" — usable across all subsequent work
