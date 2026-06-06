import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneDigest, ZoneId, RawStats } from '../score/index.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceMemoryPort } from '../ports/voice-memory.port.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { createVoiceMemoryLive } from '../live/voice-memory.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { getTracer } from '../observability/otel-layer.ts';
import { buildDimensionPulsePayload } from '../deliver/dimension-pulse-payload.ts';
import { fetchZoneDigest, fetchRecentBadges } from '../score/client.ts';
import { buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2, prettyFactorName, deriveSpotlights } from '../deliver/enriched-render.ts';
import { ZONE_REGISTRY } from '../domain/zone-registry.ts';
import { resolveWallet, type ResolvedWallet } from './freeside_auth/server.ts';
import { resolveNftPfp, type NftPfpResolver } from './inventory/resolve-nft-pfp.ts';
import { fetchProfilePictureHttp } from './inventory/inventory-http-client.ts';
import type { MintEventSubscriberLogger } from '../events/mint-event-subscriber.ts';

export interface DigestPostResult {
  readonly zone: ZoneId;
  readonly postType: 'digest';
  readonly digest: ZoneDigest;
  readonly voice: string;
  readonly payload: DigestPayload;
}

export interface DigestOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
  readonly voiceMemory?: VoiceMemoryPort;
  /** cycle-008 S9 · enriched-v2 path · full ZoneDigest fetch (defaults to the score client). */
  readonly fetchZoneDigest?: (config: Config, zone: ZoneId) => Promise<ZoneDigest>;
  /**
   * cycle-008 capability-wiring slice 1 · enriched-v2 spotlight identity (handle + pfp).
   * Defaults to the in-process freeside_auth resolver (`resolveWallet`). `handle` is a display
   * string already through the NFR-29 ladder — never a raw or truncated wallet.
   */
  readonly resolveSpotlightIdentity?: (wallet: string) => Promise<SpotlightIdentity>;
  /**
   * cycle-008 · option (b) recent-badges feed for the multi-user spotlight board. Defaults to
   * the score client's `fetchRecentBadges` (get_recent_badges). Only called when the digest has
   * synthesized climbers to enrich. Injectable for tests.
   */
  readonly fetchRecentBadges?: typeof fetchRecentBadges;
  /** Test/ops override for the badge-fetch timeout in ms (default BADGE_FETCH_TIMEOUT_MS). */
  readonly badgeFetchTimeoutMs?: number;
  /**
   * #87 GAP-2 · spotlight pfp via inventory-api over HTTP. The PRIMARY spotlight pfp
   * (the freeside_auth DB `pfp_url` carried in `identities` is the FALLBACK). Injectable
   * for hermetic tests: a `(wallet) => Promise<string | null>` that NEVER throws. Default
   * is fetchProfilePictureHttp bound to `inventoryApiBaseUrl` + global fetch. When unset AND
   * no baseUrl is configured, the pre-resolve is skipped entirely (no fetch) — dormant.
   */
  readonly fetchInventoryPfp?: (wallet: string) => Promise<string | null>;
  /**
   * inventory-api base URL. Defaults to `config.INVENTORY_API_URL` (the SAME env the mint
   * path reads). Unset → the spotlight pfp pre-resolve is skipped (DB-only, identical to today).
   */
  readonly inventoryApiBaseUrl?: string;
  /** Injectable fetch for the default inventory-pfp resolver (hermetic tests). Defaults to global fetch. */
  readonly inventoryDoFetch?: typeof fetch;
  /** Test/ops override for the inventory-pfp fetch timeout in ms (default INVENTORY_PFP_TIMEOUT_MS). */
  readonly inventoryPfpTimeoutMs?: number;
}

// Default pulse window · cycle-007 S8 r4 (operator pivot 2026-05-17):
// digests fire weekly · score-dashboard's WoW window. score-dashboard's
// FETCH_MIN_DAYS=14 floor (commit 80d715f) ensures 7d has a prior period
// to compare against.
const PULSE_WINDOW_DAYS = 7;

/**
 * composeDigestPost — voiceless dashboard-mirror digest (cycle-007 S8 r4).
 *
 * Operator pivot 2026-05-17: digests are NOT a voice moment. They surface the
 * score-dashboard per-dimension card layout faithfully · no LLM call · no
 * ruggy narrative · ruggy's character lives in micro/weaver/lore_drop/question/
 * callout posts (the conversational moments).
 *
 * Behavior:
 *   - Fetches raw PulseDimensionBreakdown from score-mcp (window=7d)
 *   - For per-dim zones: one embed with that dimension's card
 *   - For stonehenge (overall): 3 embeds in canonical [og, nft, onchain] order
 *   - No voice gen, no voice-memory read/write, no derived shape (the dashboard
 *     mirror doesn't need the cycle-006 derived shape · it consumes raw breakdowns
 *     and applies score-dashboard formatting rules directly)
 *
 * The `voice`/`augment`/`derived` ports remain in DigestOrchestratorDeps for
 * test injection compatibility but are not invoked. DigestPostResult.voice is
 * always empty string.
 */
export async function composeDigestPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: DigestOrchestratorDeps = {},
): Promise<DigestPostResult> {
  // cycle-008 S9 · enriched-v2 surface (DIGEST_SURFACE flag, default 'pulse').
  // The RLHF-validated Components V2 billboard, fed by the full ZoneDigest (real
  // raw_stats: spotlight, wallets, factor movers). Gated → canary → flip.
  if (config.DIGEST_SURFACE === 'enriched-v2') {
    return composeEnrichedDigestPost(config, zone, deps);
  }

  const score = deps.score ?? createScoreMcpLive(config);
  // Resolve other deps even if unused · ensures shape parity with prior callers
  // that may inject mocks. voice/presentation/voiceMemory are constructed but
  // intentionally unused in the pulse path.
  void (deps.voice ?? createClaudeSdkLive(config, character));
  void (deps.presentation ?? presentation);
  void (deps.voiceMemory ?? createVoiceMemoryLive());

  const tracer = getTracer();
  const { generatedAt, breakdowns } = await score.fetchDimensionBreakdowns({
    zone,
    windowDays: PULSE_WINDOW_DAYS,
  });

  tracer.startActiveSpan('dimension_pulse.fetch', (span) => {
    try {
      span.setAttribute('zone', zone);
      span.setAttribute('window_days', PULSE_WINDOW_DAYS);
      span.setAttribute('breakdown_count', breakdowns.length);
    } finally {
      span.end();
    }
  });

  const payload = buildDimensionPulsePayload(breakdowns, {
    zone,
    windowDays: PULSE_WINDOW_DAYS,
    generatedAt,
  });

  // Synthesize a DigestSnapshot from the first breakdown (or aggregated for
  // overall) · keeps DigestPostResult.digest stable for downstream consumers
  // that inspect raw_stats / score / etc. (No domain change · just adapter.)
  const snapshot: DigestSnapshot = synthesizeSnapshot(zone, generatedAt, breakdowns);

  return {
    zone,
    postType: 'digest',
    digest: snapshotToZoneDigest(snapshot),
    voice: '',
    payload,
  };
}

/**
 * composeEnrichedDigestPost — the cycle-008 S9 RLHF-validated enriched digest (Components V2).
 *
 * Fed by the FULL ZoneDigest (`get_zone_digest` → real raw_stats: spotlight, window_wallet_count,
 * factor movers) rather than the dimension-pulse breakdown. Two real-data hookups the operator
 * asked to wire before flipping:
 *   - factor display names — `raw_stats.factor_trends` carries only factor_id, so a name catalog
 *     is built from `get_dimension_breakdown` (its top/cold factors carry display_name).
 *   - spotlight identity — the wallet is resolved IN-PROCESS via freeside_auth's resolve_wallet
 *     (NFR-29: NEVER a raw 0x… in prose; ladder display_name → discord → mibera_id → ANON_MEMBER).
 *     The NFT pfp (when an https image is on file) renders as the spotlight Section's Thumbnail.
 *
 * Voiceless, like the pulse digest — the container IS the billboard, no two-beat.
 */
async function composeEnrichedDigestPost(
  config: Config,
  zone: ZoneId,
  deps: DigestOrchestratorDeps,
): Promise<DigestPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  const fetchZd = deps.fetchZoneDigest ?? fetchZoneDigest;
  const resolveIdentityFn = deps.resolveSpotlightIdentity ?? resolveSpotlightIdentity;

  const zd = await fetchZd(config, zone);

  // factor display-name catalog (factor_trends → factor_id only; names live on the breakdown).
  const nameMap = new Map<string, string>();
  try {
    const { breakdowns } = await score.fetchDimensionBreakdowns({ zone, windowDays: PULSE_WINDOW_DAYS });
    for (const b of breakdowns) {
      for (const f of [...b.top_factors, ...b.cold_factors]) nameMap.set(f.factor_id, f.display_name);
    }
  } catch {
    // names fall back to prettify — never fail the digest on the name-catalog hop.
  }

  // Multi-user spotlight board (cycle-008 · RLHF V3). Resolve identity for EACH derived
  // spotlight wallet — the curated hero + the climbers (capped) — fail-soft per wallet
  // (resolveSpotlightIdentity never throws → ANON_MEMBER on miss, NFR-29). The board is
  // derived once here (to know which wallets to resolve) and again in the renderer (for
  // layout); deriveSpotlights is a cheap pure fn, so "which wallets" stays single-sourced.
  const { entries } = deriveSpotlights(zd);
  const identities = new Map<string, SpotlightIdentity>();
  // allSettled (not all) makes the per-entry fail-soft STRUCTURAL: a rejected resolve drops
  // that one wallet from the map → resolveHandle falls back to ANON_MEMBER, the other entries
  // still render. (The default resolver never throws; this guards an injected one that might.)
  const resolved = await Promise.allSettled(
    entries.map(async (e) => ({ wallet: e.spotlight.wallet, identity: await resolveIdentityFn(e.spotlight.wallet) })),
  );
  for (const r of resolved) {
    if (r.status === 'fulfilled') identities.set(r.value.wallet, r.value.identity);
  }

  // #87 GAP-2 · spotlight pfp from inventory-api (getProfilePicture over HTTP). The PRIMARY
  // spotlight pfp; the freeside_auth DB `pfp_url` (already in `identities`) is the FALLBACK.
  // Pre-resolved here (in parallel, once) for the SAME spotlight wallets, so the synchronous
  // resolvePfp can read a Map. DORMANT-UNTIL-DEPLOYED: when no baseUrl is configured AND no
  // resolver is injected, the pre-resolve is skipped entirely (no fetch) → DB-only, identical
  // to today. FAIL-SOFT is the load-bearing invariant: a down / undeployed / slow / malformed
  // inventory-api becomes null per wallet (allSettled + the client's own self-catch), NEVER a
  // thrown error that breaks the digest render.
  const inventoryPfp = await resolveInventoryPfps(config, deps, entries.map((e) => e.spotlight.wallet));

  // option (b) badge-join — only when there are synthesized climbers to enrich, so the common
  // single-spotlight digest adds ZERO new MCP calls. Fail-soft (ADR-008 §D-4): no MCP_KEY / a
  // stalled feed → empty map → climbers fall back to rank-lines (option a).
  const badgeMap = entries.some((e) => e.synthesized)
    ? await fetchBadgeMap(config, deps, zd.window_start, zd.window_end)
    : new Map<string, string>();

  const components = buildEnrichedDigestComponentsV2(zd, {
    resolveFactorName: (id) => nameMap.get(id) ?? prettyFactorName(id),
    resolveHandle: (w) => identities.get(w)?.handle ?? ANON_MEMBER,
    // #87 GAP-2 · inventory-api pfp PRIMARY, freeside_auth DB pfp_url FALLBACK, null when neither.
    resolvePfp: (w) => inventoryPfp.get(w) ?? identities.get(w)?.pfp_url ?? null,
    resolveBadge: (w) => badgeMap.get(w.toLowerCase()) ?? null,
  });

  const flavor = ZONE_REGISTRY[zone];
  const payload: DigestPayload = {
    // content is the Discord-as-Material fallback label; Discord renders `components` under the flag.
    content: `${flavor.emoji} ${flavor.displayName}`,
    embeds: [],
    flags: IS_COMPONENTS_V2,
    components,
  };

  return { zone, postType: 'digest', digest: zd, voice: '', payload };
}

// The THJ community's member noun (operator: "each community has a name for their members and we
// call them Miberas"). The spotlight fallback when no identity resolves — never "an anonymous keeper".
// Repo-scoped to the mibera world; lift to CharacterConfig if a non-mibera community digest lands here.
const ANON_MEMBER = 'an anonymous mibera';

/** Resolved spotlight identity — display string (ladder-applied) + optional NFT/pfp thumbnail url. */
export interface SpotlightIdentity {
  /** Display string already through the NFR-29 ladder — NEVER a raw or truncated wallet. */
  readonly handle: string;
  /** https NFT/pfp image url for the Section Thumbnail accessory, or null when none. */
  readonly pfp_url: string | null;
}

/** Only https image urls reach the Discord thumbnail (drops null / non-https / malformed). */
export function httpsImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * NFR-29 spotlight fallback ladder: display_name → discord_username → mibera_id → ANON_MEMBER.
 * The truncated 0x `.fallback` is NEVER surfaced — a shortened wallet is still a leaked wallet.
 */
export function pickSpotlightDisplay(r: ResolvedWallet): SpotlightIdentity {
  return {
    handle: r.handle ?? r.discord_username ?? r.mibera_id ?? ANON_MEMBER,
    pfp_url: httpsImageUrl(r.pfp_url),
  };
}

/**
 * Enrich a spotlight identity with the inventory-api building's NFT artwork when
 * freeside_auth has no https pfp on file (Issue #87 · consume-pattern two-organ
 * brief). The DB pfp WINS (operator-curated); inventory supplies real NFT
 * artwork for holders resolvable today (fixtures; auto-upgrades to live-for-all
 * when the sonar owner-token index lands — inventory-api/docs/sonar-ownership-gap.md).
 * Fail-soft: a null/slow building leaves the identity unchanged — the handle is
 * still resolved, so the spotlight is never "an anonymous mibera" from a stall.
 * `nftResolver` is injectable for tests.
 */
export async function enrichSpotlightPfp(
  identity: SpotlightIdentity,
  wallet: string,
  nftResolver: NftPfpResolver = resolveNftPfp,
): Promise<SpotlightIdentity> {
  if (identity.pfp_url) return identity; // DB pfp wins
  // The default resolveNftPfp is already bounded (3s) + returns null on error, but an injected or
  // future resolver that THROWS must not bubble up — that would drop the already-resolved handle
  // to ANON in resolveSpotlightIdentity's catch, breaking this function's fail-soft contract
  // (FAGAN review 2026-05-24). Catch → return the identity with its handle intact.
  try {
    const nft = httpsImageUrl(await nftResolver(wallet));
    return nft ? { ...identity, pfp_url: nft } : identity;
  } catch {
    return identity;
  }
}

/**
 * Default spotlight resolver — IN-PROCESS (cycle-008 capability-wiring slice 1). Calls
 * freeside_auth's `resolve_wallet` directly: no HTTP hop. The in-bot auth is an SDK MCP (not an
 * endpoint), and the federated `auth` tenant is a V2 arc (decision #2) — the prior HTTP default
 * read `display_handle`/`discord_handle`, fields freeside_auth never emits, so it leaked nothing
 * but always fell back. resolve_wallet itself never throws (internal fallback); the try/catch is
 * belt-and-suspenders for NFR-29. One call per weekly digest, so freeside_auth's 5-min cache covers it.
 */
// resolveWallet hits Postgres on a cache-miss: pool.connect (already bounded — the pool sets
// connectionTimeoutMillis:5000 · server.ts:84) + midi_profiles queries (UNBOUNDED — no
// statement_timeout). It runs inside the digest cron's per-zone lock, so a stalled QUERY would wedge
// that zone's whole posting pipeline (the scheduler skips a zone while zoneLocks.has(zone)). This race
// bounds the TOTAL at 5s — its real job is the unbounded query phase (connect is already capped).
// Honest caveat (FAGAN composer+gpt): Promise.race ABANDONS, it does not cancel — a timed-out
// resolveWallet keeps running, then releases its client in its own finally (server.ts:238). No
// accumulation, because connect is pool-bounded, so an abandoned op resolves/rejects within ~5s, not
// forever. (opus-skeptic raised the bound · composer+gpt caught the abandons-not-cancels overclaim ·
// the pool's connectionTimeoutMillis closes the residual.) 2026-05-23.
const SPOTLIGHT_RESOLVE_TIMEOUT_MS = 5_000;

// Bound the once-per-digest recent-badges fetch (the MCP client is unbounded). Generous enough
// for a healthy MCP round-trip (init + tool call), tight enough that a stalled feed never wedges
// the digest — badges are fail-soft enrichment, so a timeout just drops to rank-lines.
const BADGE_FETCH_TIMEOUT_MS = 3_000;

// Bound the per-wallet inventory-api pfp fetch (#87 GAP-2). Matches resolveNftPfp's 3s posture —
// a slow building must not wedge a digest zone. The HTTP client's AbortController honors this; on
// timeout the wallet's pfp fail-softs to null → the DB pfp fallback (or no image) applies.
const INVENTORY_PFP_TIMEOUT_MS = 3_000;

// Minimal logger for the inventory-api HTTP client in the (logger-less) digest path. Lowercase
// per voice rules; warn is the only level the client emits. Stderr so it never pollutes a payload.
const digestPfpLogger: MintEventSubscriberLogger = {
  info: () => {},
  warn: (obj, msg) => console.warn(msg ?? '[spotlight-pfp]', obj),
  error: (obj, msg) => console.error(msg ?? '[spotlight-pfp]', obj),
};

async function resolveSpotlightIdentity(wallet: string): Promise<SpotlightIdentity> {
  const anon: SpotlightIdentity = { handle: ANON_MEMBER, pfp_url: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resolved = await Promise.race([
      resolveWallet(wallet),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('resolve_wallet timeout')),
          SPOTLIGHT_RESOLVE_TIMEOUT_MS,
        );
      }),
    ]);
    return enrichSpotlightPfp(pickSpotlightDisplay(resolved), wallet);
  } catch {
    return anon; // NFR-29: never a raw 0x… reaches prose, even on timeout
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Build a wallet → recently-earned-badge-name map for the multi-user spotlight board
 * (cycle-008 · option b). get_recent_badges is a GLOBAL earnings list (no window/zone param,
 * per the score type), so we BOUND it to the digest window: a badge earned weeks ago — or in
 * another zone — must not be attributed to a "this week" climb (coincidence-as-causation). We
 * sort recent-first and keep each wallet's most-recent in-window badge.
 * FAIL-SOFT (ADR-008 §D-4): no MCP_KEY / a stalled or erroring feed → an empty map, so the
 * climbers render their rank-line (option a) and the digest is never blocked on badges.
 *
 * Caveat: limit=50 is best-effort — under heavy global earning the join may miss a wallet; it
 * fails soft to the rank line. Zone-scoping is not possible until the feed exposes a filter.
 */
async function fetchBadgeMap(
  config: Config,
  deps: DigestOrchestratorDeps,
  windowStart: string,
  windowEnd: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  // Fail-open ONLY if the digest's own bounds are malformed (the digest would be broken anyway).
  const inWindow = (earnedAt: string): boolean => {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
    const t = Date.parse(earnedAt);
    return Number.isFinite(t) ? t >= start && t <= end : false;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fetchBadges = deps.fetchRecentBadges ?? fetchRecentBadges;
    // The score MCP client does NOT bound its fetch (score/client.ts has no AbortSignal), so a
    // hung feed would block the digest — the try/catch only catches throws, not a stall (FAGAN
    // review 2026-05-24). Race the fetch to a timeout: on stall we keep the empty map and climbers
    // render rank-lines (fail-soft, ADR-008 §D-4). Promise.race ABANDONS (doesn't cancel) — fine,
    // badges are once-per-digest enrichment.
    const result = await Promise.race([
      fetchBadges(config, { limit: 50 }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), deps.badgeFetchTimeoutMs ?? BADGE_FETCH_TIMEOUT_MS);
      }),
    ]);
    if (!result) return map; // timed out → no badge enrichment this cycle
    const recentFirst = [...result.earnings].sort((a, b) => (a.earned_at < b.earned_at ? 1 : -1));
    for (const e of recentFirst) {
      if (!inWindow(e.earned_at)) continue;
      const key = e.wallet.toLowerCase();
      const name = typeof e.badge_name === 'string' ? e.badge_name.trim() : '';
      if (name && !map.has(key)) map.set(key, name); // first (most-recent in-window) badge wins
    }
  } catch {
    // fail-soft — badges are an enrichment, never a digest blocker
  } finally {
    if (timer) clearTimeout(timer);
  }
  return map;
}

/**
 * Pre-resolve each spotlight wallet's inventory-api pfp into a Map (#87 GAP-2). The synchronous
 * `resolvePfp` reads this map, so the fetch (async) happens ONCE here, in parallel, before the
 * components build.
 *
 * Resolver precedence: an injected `deps.fetchInventoryPfp` wins (test seam); otherwise the
 * default binds fetchProfilePictureHttp to the baseUrl (`deps.inventoryApiBaseUrl` →
 * `config.INVENTORY_API_URL`) + fetch.
 *
 * DORMANT-UNTIL-DEPLOYED: when NO resolver is injected AND no baseUrl is configured, this returns
 * an EMPTY map WITHOUT issuing any fetch — behavior is identical to the DB-only path of today.
 *
 * FAIL-SOFT (the load-bearing invariant): allSettled means a rejected/timed-out fetch drops that
 * one wallet (→ DB pfp fallback, or no image), never propagates. The default resolver (the HTTP
 * client) already self-catches to null; allSettled additionally guards an injected resolver that
 * might throw. A down / undeployed / slow / malformed inventory-api can NEVER break the digest.
 */
async function resolveInventoryPfps(
  config: Config,
  deps: DigestOrchestratorDeps,
  wallets: readonly string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (wallets.length === 0) return map;

  const baseUrl = deps.inventoryApiBaseUrl ?? config.INVENTORY_API_URL;
  const resolver =
    deps.fetchInventoryPfp ??
    (baseUrl
      ? (wallet: string) =>
          fetchProfilePictureHttp({
            baseUrl,
            wallet,
            timeoutMs: deps.inventoryPfpTimeoutMs ?? INVENTORY_PFP_TIMEOUT_MS,
            doFetch: deps.inventoryDoFetch ?? fetch,
            logger: digestPfpLogger,
          })
      : undefined);

  // Dormant: no injected resolver and no baseUrl → no fetch, DB-only (identical to today).
  if (!resolver) return map;

  const settled = await Promise.allSettled(
    wallets.map(async (wallet) => ({ wallet, pfp: await resolver(wallet) })),
  );
  for (const r of settled) {
    // A rejected resolve (injected resolver threw) drops that wallet → DB fallback applies.
    if (r.status === 'fulfilled' && r.value.pfp) map.set(r.value.wallet, r.value.pfp);
  }
  return map;
}

function synthesizeSnapshot(
  zone: ZoneId,
  generatedAt: string,
  breakdowns: ReadonlyArray<import('../score/types.ts').PulseDimensionBreakdown>,
): DigestSnapshot {
  const totalEvents = breakdowns.reduce((s, b) => s + b.total_events, 0);
  const previousPeriodEvents = breakdowns.reduce((s, b) => s + b.previous_period_events, 0);
  const dimension = breakdowns.length === 1 ? breakdowns[0]!.id : 'overall';
  const displayName = breakdowns.length === 1 ? breakdowns[0]!.display_name : 'Overall';
  return {
    zone,
    dimension,
    displayName,
    windowDays: PULSE_WINDOW_DAYS,
    generatedAt,
    totalEvents,
    previousPeriodEvents,
    deltaPct:
      previousPeriodEvents === 0
        ? null
        : ((totalEvents - previousPeriodEvents) / previousPeriodEvents) * 100,
    deltaCount: totalEvents - previousPeriodEvents,
    activeWallets: 0, // not exposed in raw breakdown · derive-shape is not used in pulse path
    coldFactorCount: breakdowns.reduce((s, b) => s + b.inactive_factor_count, 0),
    totalFactorCount: breakdowns.reduce((s, b) => s + b.total_factor_count, 0),
    topFactors: breakdowns.flatMap((b) =>
      b.top_factors.map((f) => ({
        factorId: f.factor_id,
        displayName: f.display_name,
        primaryAction: f.primary_action,
        total: f.total,
        previous: f.previous,
        deltaPct: f.delta_pct,
        deltaCount: f.delta_count,
        ...(f.factor_stats ? { factorStats: f.factor_stats } : {}),
      })),
    ),
    coldFactors: breakdowns.flatMap((b) =>
      b.cold_factors.map((f) => ({
        factorId: f.factor_id,
        displayName: f.display_name,
        primaryAction: f.primary_action,
        total: f.total,
        previous: f.previous,
        deltaPct: f.delta_pct,
        deltaCount: f.delta_count,
        ...(f.factor_stats ? { factorStats: f.factor_stats } : {}),
      })),
    ),
  };
}

function snapshotToZoneDigest(snapshot: DigestSnapshot): ZoneDigest {
  const now = snapshot.generatedAt;
  return {
    zone: snapshot.zone,
    window: 'weekly',
    computed_at: now,
    window_start: now,
    window_end: now,
    stale: false,
    schema_version: 'digest-snapshot/1.0.0',
    narrative: null,
    narrative_error: null,
    raw_stats: snapshotToRawStats(snapshot),
  };
}

function snapshotToRawStats(snapshot: DigestSnapshot): RawStats {
  return {
    schema_version: '2.0.0',
    window_event_count: snapshot.totalEvents,
    window_wallet_count: snapshot.activeWallets ?? 0,
    top_event_count: snapshot.topFactors.reduce((sum, factor) => sum + factor.total, 0),
    top_wallet_count: snapshot.activeWallets ?? 0,
    top_movers: [],
    top_events: [],
    spotlight: null,
    rank_changes: {
      climbed: [],
      dropped: [],
      entered_top_tier: [],
      exited_top_tier: [],
    },
    factor_trends: snapshot.topFactors.map((factor) => ({
      factor_id: factor.factorId,
      current_count: factor.total,
      baseline_avg: factor.previous,
      multiplier: factor.previous > 0 ? factor.total / factor.previous : factor.total,
    })),
  };
}
