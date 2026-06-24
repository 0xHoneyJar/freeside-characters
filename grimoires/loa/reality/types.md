# Types — freeside-characters

> Core type/interface definitions. From `packages/persona-engine/src/types.ts` and `score/types.ts`.

## Substrate boundary

```ts
// types.ts:48-197
interface CharacterConfig {
  id: string;
  personaPath: string;
  exemplarsDir?: string;
  emojiAffinity?: { primary?: EmojiAffinityKind; fallback?: EmojiAffinityKind };
  displayName?: string;
  webhookAvatarUrl?: string;
  webhookUsername?: string;
  anchoredArchetypes?: CabalArchetype[];
  slash_commands?: SlashCommandSpec[];
  mcps?: string[];
  tool_invocation_style?: string;
  readonly mediumOverrides?: MediumCapabilityOverridesType;
  readonly tokenBinding?: TokenBindingType;
}

type EmojiAffinityKind = 'mibera' | 'ruggy';

interface SlashCommandSpec {
  name: string;
  description: string;
  handler: 'chat' | 'imagegen';
  options?: SlashCommandOption[];
}

interface SlashCommandOption {
  name: string;
  description: string;
  type: 3 | 4 | 5 | 10;   // STRING | INTEGER | BOOLEAN | NUMBER
  required?: boolean;
}

type CabalArchetype =
  | 'Optimizer' | 'Newcomer' | 'Storyteller' | 'Rules-Lawyer'
  | 'Chaos-Agent' | 'GM' | 'Anxious-Player' | 'Veteran' | 'Explorer';
```

## Zones / dimensions

```ts
// score/types.ts:35-58
type ZoneId = 'stonehenge' | 'bear-cave' | 'el-dorado' | 'owsley-lab';
type DimensionId = 'og' | 'nft' | 'onchain';
type ZoneDimension = DimensionId | 'overall';

const ZONE_TO_DIMENSION: Record<ZoneId, ZoneDimension> = {
  stonehenge: 'overall',
  'bear-cave': 'og',
  'el-dorado': 'nft',
  'owsley-lab': 'onchain',
};

const ZONE_FLAVOR: Record<ZoneId, { emoji: string; name: string; dimension: ZoneDimension }> = {
  stonehenge: { emoji: '🗿', name: 'Stonehenge', dimension: 'overall' },
  'bear-cave': { emoji: '🐻', name: 'Bear Cave', dimension: 'og' },
  'el-dorado': { emoji: '⛏️', name: 'El Dorado', dimension: 'nft' },
  'owsley-lab': { emoji: '🧪', name: 'Owsley Lab', dimension: 'onchain' },
};

const DIMENSION_NAME = {
  og: 'OG', nft: 'NFT', onchain: 'Onchain', overall: 'Overall',
};
```

Future zones reserved: `tl` (Poppy Field / Timeline / HÖR), `irl` — NOT LIVE in score yet.

## Score MCP contract (dual-shape v1/v2)

```ts
// score/types.ts:80-167
interface TopMover {
  wallet: string; rank_delta: number; dimension: DimensionId;
  prior_rank: number | null; current_rank: number | null; ens?: string;
}

interface Spotlight { wallet: string; reason: 'rank_climb' | 'new_badge'; details: Record<string, unknown>; }
interface FactorTrend { factor_id: string; current_count: number; baseline_avg: number; multiplier: number; }
interface RecentEvent { event_id: string; wallet: string; factor_id: string; raw_value: number; timestamp: string; }
interface RankChanges { climbed: TopMover[]; dropped: TopMover[]; entered_top_tier: TopMover[]; exited_top_tier: TopMover[]; }

interface RawStats {
  schema_version: '1.0.0' | '2.0.0';
  window_event_count?: number;    // v2
  window_wallet_count?: number;   // v2
  top_event_count?: number;       // v2 (sample-derived)
  top_wallet_count?: number;      // v2 (sample-derived)
  total_events?: number;          // v1 alias
  active_wallets?: number;        // v1 alias
  top_movers: TopMover[];
  top_events: RecentEvent[];
  spotlight: Spotlight | null;
  rank_changes: RankChanges;
  factor_trends: FactorTrend[];
}

interface ZoneDigest {
  zone: ZoneId; window: 'weekly';
  computed_at: string; window_start: string; window_end: string;
  stale: boolean; schema_version: string;
  narrative: NarrativeShape | null;
  narrative_error?: string | null; narrative_error_hint?: string | null;
  raw_stats: RawStats;
}

interface NarrativeShape { headline: string; sections: NarrativeSection[]; }
interface NarrativeSection { kind: 'movers' | 'spotlight' | 'trend'; body: string; }
```

Helpers: `getWindowEventCount`, `getWindowWalletCount`, `getTopEventCount`, `getTopWalletCount` — read either shape.

## Post types

```ts
// compose/post-types.ts
type PostType = 'digest' | 'micro' | 'weaver' | 'lore_drop' | 'question' | 'callout';
```

## Conversation ledger

```ts
// conversation/ledger.ts:21-41
interface LedgerEntry {
  role: 'user' | 'character';
  content: string;
  characterId?: string;
  authorId: string;
  authorUsername: string;
  timestamp: string;
}
```

## Cron contract

```ts
// cron/scheduler.ts:34-51
interface FireRequest { zone: ZoneId; postType: PostType; }
interface SchedulerHandles {
  digestExpression?: string;
  popInExpression?: string;
  weaverExpression?: string;
  tasks: cron.ScheduledTask[];
  stop: () => void;
}
interface ScheduleArgs {
  config: Config;
  zones: ZoneId[];
  onFire: (req: FireRequest) => Promise<void>;
}
```

## Config (Zod-validated env)

`type Config = z.infer<typeof ConfigSchema>` — 70+ fields. See `entry-points.md` for selected highlights.

## Compose / Reply

```ts
// compose/reply.ts:62-? (partial)
interface ReplyComposeArgs {
  config: Config;
  character: CharacterConfig;
  prompt: string;
  channelId: string;
  zone?: ZoneId;
  // ... otherCharacters, recentMessages, etc
}
interface ReplyComposeResult { /* see source */ }
interface EnrichedReplyResult { /* see source */ }
type ChatProvider = 'orchestrator' | 'naive';
```

## Auth-bridge

```ts
// auth-bridge.ts (partial)
interface InteractionContext {
  interaction_id: string;
  guild_id: string | null;
  discord_id: string;
  auth?: AuthContext;
}
interface AuthContext { /* see auth-bridge.ts */ }
class AuthBridgeError extends Error { code: string; reason: string; }
```
