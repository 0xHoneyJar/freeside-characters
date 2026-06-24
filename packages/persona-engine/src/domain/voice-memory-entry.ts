// cycle-006 S6 T6.1 · VoiceMemoryEntry schema.
//
// Spec deviation from SDD §3.6: Zod substituted for TypeBox per codebase
// stack (CLAUDE.md "Validation: Zod"). Same shape, same semantic guards;
// Zod is already in deps via package.json. Operator-attested deviation
// recorded in NOTES.md Decision Log.
//
// Forward-compat (BB design-review F-008): schema_version accepts any
// `1.x.x` pattern. Additive optional fields within v1 stay readable.

import { z } from 'zod';

export const STREAM_NAMES = [
  'digest',
  'chat-reply',
  'pop-in',
  'weaver',
  'micro',
  'lore_drop',
  'question',
  'callout',
] as const;

export const StreamNameSchema = z.enum(STREAM_NAMES);
export type StreamName = z.infer<typeof StreamNameSchema>;

export const UseLabelSchema = z.enum([
  'usable',
  'background_only',
  'mark_as_contested',
  'do_not_use_for_action',
]);
export type UseLabel = z.infer<typeof UseLabelSchema>;

export const VoiceMemoryEntrySchema = z.object({
  schema_version: z.string().regex(/^1\.[0-9]+\.[0-9]+$/),
  at: z.string().datetime(),
  iso_week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  stream: StreamNameSchema,
  zone: z.string().optional(),
  key: z.string().min(1).max(64),

  /**
   * Voice surface. maxLength 280 keeps the JSONL line under PIPE_BUF on
   * macOS (512 bytes) when paired with other fields. BB F-004 closure:
   * ensures appendFile atomicity for concurrent writes.
   */
  header: z.string().max(280),
  outro: z.string().max(280),

  key_numbers: z.object({
    total_events: z.number(),
    previous_period_events: z.number().optional(),
    permitted_factor_names: z.array(z.string()),
  }),

  /**
   * Straylight-aligned governance fields. INERT in V1 (written + read but
   * not acted on). BB F-011 evolution hook for cycle-007+ memory-governance
   * enforcement.
   */
  use_label: UseLabelSchema,
  expiry: z.string().datetime(),
  signed_by: z.string().default('agent:claude'),

  /**
   * cycle-006 S6 T6.10 · FLATLINE-SKP-004/HIGH retention closure.
   * Optional per-user attribution for chat-reply entries. Populated only
   * when stream === 'chat-reply'; enables `/admin forget-user` deletion.
   */
  user_id: z.string().optional(),
});

export type VoiceMemoryEntry = z.infer<typeof VoiceMemoryEntrySchema>;

/**
 * Refinement: chat-reply entries MUST carry user_id (Red Team AC-RT-007
 * schema-level closure). Other streams treat user_id as optional/unused.
 * Use this when the writer is the chat-reply path.
 */
export const ChatReplyVoiceMemoryEntrySchema = VoiceMemoryEntrySchema.refine(
  (e) => e.stream !== 'chat-reply' || typeof e.user_id === 'string',
  {
    message: 'chat-reply voice-memory entries require user_id (AC-RT-007)',
    path: ['user_id'],
  },
);

/** Current schema version emitted on write. */
export const VOICE_MEMORY_SCHEMA_VERSION = '1.0.0';
