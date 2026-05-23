// cycle-008 S9 (g30) · the standalone RLHF iteration surface — hexagonal (ports & adapters).
//
//   core/     — the medium-agnostic feedback loop (generate → record → breed)
//   ports/    — the MediumAdapter boundary
//   adapters/ — the edges: discord (primary) · terminal (dev aid)
//
// Discord is the surface (operator directive 2026-05-23): viewing + interaction both happen
// in the real client (a browser mock can't be pixel-perfect — gg sans + Blink/Yoga · the dig).
// New mediums = a new adapter; the core never changes.

// VoiceAugment is part of the surface (beat-1 voice for cases + the loop).
export type { VoiceAugment } from '../domain/voice-augment.ts';

// ── core: generation ──────────────────────────────────────────────────────────
export type { BillboardVariant } from './core/billboard-variants.ts';
export {
  BILLBOARD_VARIANTS,
  variantById,
  resolveVariants,
  allVariants,
  resolveAllVariants,
} from './core/billboard-variants.ts';

export type { BillboardSurface } from './core/billboard-surface.ts';
export { BILLBOARD_SURFACES, toCodeBlock, toAnsiBlock } from './core/billboard-surface.ts';

export type {
  BillboardTemplate,
  TemplateRow,
  DeltaStyle,
  HeaderStyle,
  RowWhen,
} from './core/billboard-templates.ts';
export {
  renderTemplate,
  templateToVariant,
  loadTemplates,
  appendTemplate,
  EXAMPLE_TEMPLATES,
} from './core/billboard-templates.ts';

export type { SnapshotCaseInput, CanonicalCase } from './core/canonical-cases.ts';
export { buildSnapshot, CANONICAL_CASES, caseById } from './core/canonical-cases.ts';

export type { Candidate, RenderBatch } from './core/render-candidate.ts';
export { renderCandidate, renderBatch } from './core/render-candidate.ts';

export type { CandidateDiff } from './core/candidate-diff.ts';
export { diffAgainstBaseline, diffBatch } from './core/candidate-diff.ts';

// ── core: preference persistence + the loop ─────────────────────────────────────
export type {
  PreferenceRecord,
  PreferenceRating,
  BuildPreferenceInput,
  BuildRatedInput,
  PromoteInput,
} from './core/preference-log.ts';
export {
  PREFERENCE_LOG_PATH,
  EVALS_SNAPSHOTS_DIR,
  buildPreferenceRecord,
  buildRatedRecord,
  appendPreferenceRecord,
  promoteToEvals,
} from './core/preference-log.ts';

export type { GenerateInput } from './core/loop.ts';
export { generate, present, captureAndRecord, runSyncStep } from './core/loop.ts';

// ── ports ───────────────────────────────────────────────────────────────────────
export type {
  MediumAdapter,
  PresentedBatch,
  PresentedCandidate,
  CapturedFeedback,
} from './ports/medium-adapter.ts';

// ── adapters (edges) ──────────────────────────────────────────────────────────
export type { DiscordAdapterConfig, DiscordPresentConfig, DiscordCaptureConfig, GalleryItem } from './adapters/discord/index.ts';
export {
  createDiscordAdapter,
  presentToDiscord,
  captureFromDiscord,
  RUGGY_AVATAR_URL,
  RATING_EMOJI,
  buildBillboardComponentsV2,
  buildEnrichedDigestComponentsV2,
  IS_COMPONENTS_V2,
  POST_TYPE_GALLERY,
} from './adapters/discord/index.ts';
export type { EnrichedDigestOpts } from './adapters/discord/index.ts';

export type { TerminalAdapterConfig } from './adapters/terminal/index.ts';
export { createTerminalAdapter } from './adapters/terminal/index.ts';
