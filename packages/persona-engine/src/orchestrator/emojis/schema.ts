/**
 * Emojis MCP — Effect.Schema contract for all 6 tools.
 *
 * The CONTRACT lives here. `server.ts` derives its SDK `tool()`
 * registrations from these contracts (name, description, input shape).
 * Handler bodies stay in `server.ts` because they touch runtime state
 * (recent-cache, registry filtering) that has no place in the contract.
 *
 * Effect↔Zod parity:
 *   The SDK requires Zod for input validation at the tool-call boundary.
 *   We declare the Effect schema as canonical and the Zod shape alongside,
 *   then `assertZodParity<T>()(zodShape)` at compile time enforces that
 *   the Zod shape produces the same TypeScript type as the Effect schema.
 *   Drift fails compilation; no AST walking needed.
 *
 * Reference: kickoff seed §4.2 (worked example) + §5 (design rules).
 */

import { Schema } from "effect";
import { z } from "zod";
import type { McpToolContract, McpServerContract } from "../_schema/index.ts";
import { assertZodParity } from "../_schema/index.ts";
import type { EmojiMood } from "./registry.ts";

// ─── Shared enums ────────────────────────────────────────────────────

const KIND_LITERALS = ["mibera", "ruggy"] as const;

/** Const tuple for Schema.Literal — single source of truth for the mood
 * vocabulary across the substrate. Exported (V0.12) so the expression
 * layer's tool-mood-map.ts can build its `Schema.Literal(...EMOJI_MOOD_LITERALS)`
 * against the same tuple instead of redeclaring 27 strings. Parity with
 * `EmojiMood` (registry.ts) is enforced by the type assertion below. */
export const EMOJI_MOOD_LITERALS = [
  "cute",
  "shocked",
  "love",
  "celebrate",
  "snark",
  "cry",
  "confused",
  "angry",
  "cool",
  "dazed",
  "shy",
  "wave",
  "peace",
  "hands-up",
  "flex",
  "mining",
  "dapper",
  "honey",
  "psychedelic",
  "concerned",
  "shrug",
  "pls",
  "nope",
  "eyes",
  "noted",
  "rave",
  "meme",
] as const;

// Compile-time parity: every EmojiMood from registry.ts must appear in
// EMOJI_MOOD_LITERALS, and every EMOJI_MOOD_LITERALS entry must satisfy EmojiMood.
// Either-direction drift fails compilation.
type _MoodParityForward = (typeof EMOJI_MOOD_LITERALS)[number] extends EmojiMood
  ? true
  : never;
type _MoodParityReverse = EmojiMood extends (typeof EMOJI_MOOD_LITERALS)[number]
  ? true
  : never;
const _moodParityForward: _MoodParityForward = true;
const _moodParityReverse: _MoodParityReverse = true;
void _moodParityForward;
void _moodParityReverse;

export const KindSchema = Schema.Literal(...KIND_LITERALS).annotations({
  description: "mibera or ruggy emoji namespace",
});
export const MoodSchema = Schema.Literal(...EMOJI_MOOD_LITERALS).annotations({
  description: "register tag for matching expressive intent",
});

const KindZod = z.enum(KIND_LITERALS);
const MoodZod = z.enum(EMOJI_MOOD_LITERALS);

// ─── Shared output projection (renderEmoji + entry view) ──────────────

const EmojiViewFields = {
  name: Schema.String.annotations({
    description: "Discord guild emoji name (matches server canon exactly)",
  }),
  kind: KindSchema,
  moods: Schema.Array(MoodSchema),
  animated: Schema.Boolean,
  visual: Schema.String.annotations({
    description: "what the emoji looks like (CDN PNG inspection notes)",
  }),
  use_when: Schema.String.annotations({
    description: "context cue for picking — when this emoji lands well",
  }),
  render: Schema.String.annotations({
    description: "discord-syntax string ready to drop into prose",
  }),
};

export const EmojiViewSchema = Schema.Struct(EmojiViewFields);
export type EmojiViewT = Schema.Schema.Type<typeof EmojiViewSchema>;

// ═════════════════════════════════════════════════════════════════════
// tool: list_moods
// ═════════════════════════════════════════════════════════════════════

const ListMoodsInput = Schema.Struct({});
const ListMoodsOutput = Schema.Struct({
  moods: Schema.Array(MoodSchema),
});

export type ListMoodsInputT = Schema.Schema.Type<typeof ListMoodsInput>;
export type ListMoodsOutputT = Schema.Schema.Type<typeof ListMoodsOutput>;

export const listMoodsInputZod = assertZodParity<ListMoodsInputT>()({});

export const listMoodsContract: McpToolContract<
  ListMoodsInputT,
  ListMoodsOutputT
> = {
  name: "list_moods",
  description:
    "Lists all available emoji mood tags. Use this first to see what moods are available, then call pick_by_mood to get the actual emojis.",
  input: ListMoodsInput,
  output: ListMoodsOutput,
};

// ═════════════════════════════════════════════════════════════════════
// tool: pick_by_mood
// ═════════════════════════════════════════════════════════════════════

const PickByMoodInput = Schema.Struct({
  mood: MoodSchema.annotations({
    description: "Mood tag to filter by",
  }),
  kind: Schema.optional(KindSchema).annotations({
    description: "Optionally narrow to mibera or ruggy emojis only",
  }),
  scope: Schema.optional(Schema.String).annotations({
    description:
      "Scope identifier (typically zone name) for recent-used filtering",
  }),
  exclude_names: Schema.optional(Schema.Array(Schema.String)).annotations({
    description: "Names to ALSO exclude beyond the auto-recent filter",
  }),
});

const PickByMoodSuccess = Schema.Struct({
  found: Schema.Literal(true),
  mood: MoodSchema,
  scope: Schema.NullOr(Schema.String),
  recent_excluded: Schema.Array(Schema.String),
  pool_size: Schema.Number,
  ...EmojiViewFields,
});
const PickByMoodEmpty = Schema.Struct({
  found: Schema.Literal(false),
  mood: MoodSchema,
  kind: Schema.Union(KindSchema, Schema.Literal("any")),
  scope: Schema.NullOr(Schema.String),
  recent_excluded: Schema.Array(Schema.String),
  hint: Schema.String,
});
const PickByMoodOutput = Schema.Union(PickByMoodSuccess, PickByMoodEmpty);

export type PickByMoodInputT = Schema.Schema.Type<typeof PickByMoodInput>;
export type PickByMoodOutputT = Schema.Schema.Type<typeof PickByMoodOutput>;

export const pickByMoodInputZod = assertZodParity<PickByMoodInputT>()({
  mood: MoodZod.describe("Mood tag to filter by"),
  kind: KindZod.optional().describe(
    "Optionally narrow to mibera or ruggy emojis only",
  ),
  scope: z
    .string()
    .optional()
    .describe(
      "Scope identifier (typically zone name) for recent-used filtering",
    ),
  exclude_names: z
    .array(z.string())
    .optional()
    .describe("Names to ALSO exclude beyond the auto-recent filter"),
});

export const pickByMoodContract: McpToolContract<
  PickByMoodInputT,
  PickByMoodOutputT
> = {
  name: "pick_by_mood",
  description:
    'Returns ONE random emoji matching a mood. Pass `mood` and optionally narrow by `kind`. Pass `scope` (typically zone name) — server auto-excludes emojis recently used in that scope. Use the returned `render` string verbatim.\n\nIMPORTANT: this returns ONE random pick, not a list. Trust the pick — do not call repeatedly looking for a "better fit". The variance IS the point.\n\nIf you want to browse all candidates instead, call `list_all` with a kind filter.',
  input: PickByMoodInput,
  output: PickByMoodOutput,
};

// ═════════════════════════════════════════════════════════════════════
// tool: random_pick
// ═════════════════════════════════════════════════════════════════════

const RandomPickInput = Schema.Struct({
  kind: Schema.optional(KindSchema),
  moods: Schema.optional(Schema.Array(MoodSchema)).annotations({
    description: "Optional mood filter — pick from these moods only",
  }),
  scope: Schema.optional(Schema.String).annotations({
    description:
      "Scope identifier (typically zone name) for recent-used filtering",
  }),
  exclude_names: Schema.optional(Schema.Array(Schema.String)),
});

const RandomPickSuccess = Schema.Struct({
  found: Schema.Literal(true),
  scope: Schema.NullOr(Schema.String),
  ...EmojiViewFields,
});
const RandomPickEmpty = Schema.Struct({
  found: Schema.Literal(false),
  hint: Schema.String,
  recent_excluded: Schema.Array(Schema.String),
});
const RandomPickOutput = Schema.Union(RandomPickSuccess, RandomPickEmpty);

export type RandomPickInputT = Schema.Schema.Type<typeof RandomPickInput>;
export type RandomPickOutputT = Schema.Schema.Type<typeof RandomPickOutput>;

export const randomPickInputZod = assertZodParity<RandomPickInputT>()({
  kind: KindZod.optional(),
  moods: z
    .array(MoodZod)
    .optional()
    .describe("Optional mood filter — pick from these moods only"),
  scope: z
    .string()
    .optional()
    .describe(
      "Scope identifier (typically zone name) for recent-used filtering",
    ),
  exclude_names: z.array(z.string()).optional(),
});

export const randomPickContract: McpToolContract<
  RandomPickInputT,
  RandomPickOutputT
> = {
  name: "random_pick",
  description:
    "Returns ONE random emoji from the catalog. AUTO-EXCLUDES emojis recently used in `scope` (typically zone name). Use this when you want expression but no specific mood — rotates the catalog naturally.",
  input: RandomPickInput,
  output: RandomPickOutput,
};

// ═════════════════════════════════════════════════════════════════════
// tool: mark_used
// ═════════════════════════════════════════════════════════════════════

const MarkUsedInput = Schema.Struct({
  name: Schema.String.annotations({
    description: "The emoji name you just used",
  }),
  scope: Schema.String.annotations({
    description: "Scope (typically zone name) — should match pick scope",
  }),
});

const MarkUsedRecorded = Schema.Struct({
  recorded: Schema.Literal(true),
  scope: Schema.String,
  name: Schema.String,
});
const MarkUsedSkipped = Schema.Struct({
  recorded: Schema.Literal(false),
  hint: Schema.String,
});
const MarkUsedOutput = Schema.Union(MarkUsedRecorded, MarkUsedSkipped);

export type MarkUsedInputT = Schema.Schema.Type<typeof MarkUsedInput>;
export type MarkUsedOutputT = Schema.Schema.Type<typeof MarkUsedOutput>;

export const markUsedInputZod = assertZodParity<MarkUsedInputT>()({
  name: z.string().describe("The emoji name you just used"),
  scope: z
    .string()
    .describe(
      "Scope (typically zone name) — should match the scope used in pick calls",
    ),
});

export const markUsedContract: McpToolContract<
  MarkUsedInputT,
  MarkUsedOutputT
> = {
  name: "mark_used",
  description:
    "Records that an emoji was just used in a scope (e.g. zone name). Persists to a recent-used cache so future pick_by_mood / random_pick calls skip it. Call this AFTER you decide which emoji to use in your post — once per emoji you actually emit.",
  input: MarkUsedInput,
  output: MarkUsedOutput,
};

// ═════════════════════════════════════════════════════════════════════
// tool: render_by_name
// ═════════════════════════════════════════════════════════════════════

const RenderByNameInput = Schema.Struct({
  name: Schema.String.annotations({
    description: 'Real Discord emoji name (e.g. "ruggy_cheers", "spiraling")',
  }),
});

const RenderByNameFound = Schema.Struct({
  found: Schema.Literal(true),
  ...EmojiViewFields,
});
const RenderByNameMissing = Schema.Struct({
  found: Schema.Literal(false),
  name: Schema.String,
  hint: Schema.String,
});
const RenderByNameOutput = Schema.Union(RenderByNameFound, RenderByNameMissing);

export type RenderByNameInputT = Schema.Schema.Type<typeof RenderByNameInput>;
export type RenderByNameOutputT = Schema.Schema.Type<typeof RenderByNameOutput>;

export const renderByNameInputZod = assertZodParity<RenderByNameInputT>()({
  name: z
    .string()
    .describe('Real Discord emoji name (e.g. "ruggy_cheers", "spiraling")'),
});

export const renderByNameContract: McpToolContract<
  RenderByNameInputT,
  RenderByNameOutputT
> = {
  name: "render_by_name",
  description:
    'Renders a custom emoji to its discord-syntax string for inclusion in prose. Useful when you already know the name from a previous call. Names are the ACTUAL Discord guild emoji names (e.g. "ruggy_dab", "spiraling", "ackshually") — do not invent.',
  input: RenderByNameInput,
  output: RenderByNameOutput,
};

// ═════════════════════════════════════════════════════════════════════
// tool: list_all
// ═════════════════════════════════════════════════════════════════════

const ListAllInput = Schema.Struct({
  kind: Schema.optional(KindSchema),
});

const ListAllOutput = Schema.Struct({
  count: Schema.Number,
  emojis: Schema.Array(EmojiViewSchema),
});

export type ListAllInputT = Schema.Schema.Type<typeof ListAllInput>;
export type ListAllOutputT = Schema.Schema.Type<typeof ListAllOutput>;

export const listAllInputZod = assertZodParity<ListAllInputT>()({
  kind: KindZod.optional(),
});

export const listAllContract: McpToolContract<
  ListAllInputT,
  ListAllOutputT
> = {
  name: "list_all",
  description:
    "Returns the FULL catalog (43 emojis). Heavy — prefer pick_by_mood / random_pick for most cases. Use only when you want to see everything available at once.",
  input: ListAllInput,
  output: ListAllOutput,
};

// ═════════════════════════════════════════════════════════════════════
// Server contract — used by surface-completeness + persona-tool-drift
// tests to enumerate the tools this MCP exposes.
// ═════════════════════════════════════════════════════════════════════

export const emojisServerContract: McpServerContract = {
  name: "emojis",
  version: "0.3.0",
  tools: [
    listMoodsContract,
    pickByMoodContract,
    randomPickContract,
    markUsedContract,
    renderByNameContract,
    listAllContract,
  ],
};
