/**
 * Persona loader — character-aware (V0.6-A).
 *
 * Loads a character's persona.md, extracts the system-prompt template,
 * picks the post-type fragment, and substitutes runtime placeholders.
 *
 * Per-post-type design (V0.4): the persona doc has six fragments marked
 * with `<!-- @FRAGMENT: <name> --> ... <!-- @/FRAGMENT -->`. The loader
 * picks ONLY the matching fragment for the active post type — no
 * leakage from other types into the system prompt.
 *
 * V0.6-A: PERSONA_PATH is no longer hardcoded to ruggy.md. The substrate
 * accepts a CharacterConfig and reads the character's persona file. Cache
 * is keyed per-character so multi-character runtimes don't collide.
 *
 * Persona doc convention (substrate-canonical — every character follows):
 *   - `## System prompt template` section with a fenced-block template
 *   - `═══ INPUT PAYLOAD ═══` marker splits system half / user half
 *   - `<!-- @FRAGMENT: <post-type> -->` blocks for each of the 6 post types
 *   - Placeholders: {{CODEX_PRELUDE}} {{ZONE_ID}} {{POST_TYPE}}
 *     {{POST_TYPE_GUIDANCE}} {{POST_TYPE_OUTPUT_INSTRUCTION}} {{EXEMPLARS}}
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Effect } from 'effect';
import type { ZoneId } from '../score/types.ts';
import { DIMENSION_NAME } from '../score/types.ts';
// cycle-007 S1/T1.3 · ZONE_FLAVOR migration to canonical zone-registry per FR-1 (Bug A source-side).
// Voice-prompt path MUST use the safe resolver per SKP-003 — UnknownZoneError caught + raw zone fallback + warn (no crash).
import { safeResolveZoneDisplayName, ZONE_REGISTRY } from '../domain/zone-registry.ts';
import { loadCodexPrelude } from '../score/codex-context.ts';
import type { PostType } from '../compose/post-types.ts';
import type { CharacterConfig } from '../types.ts';
import { buildExemplarBlock } from './exemplar-loader.ts';
// cycle-008 S2 imports (T2.1+T2.3+T2.3a+T2.4 foundation helpers)
import { BuildPromptError } from './build-prompt-error.ts';
export { BuildPromptError } from './build-prompt-error.ts';
import { renderActiveFactors, type ActiveFactorRender } from './render-active-factors.ts';
import { validateNoAggregateStatLeakage } from './validate-no-aggregate-stat-leakage.ts';
import {
  validateFragmentSourcesInvariants,
  type FragmentSource,
} from './validate-fragment-sources-invariants.ts';
import { UNTRUSTED_CONTENT_LLM_INSTRUCTION } from '../orchestrator/format-prior-week-hint.ts';

// cycle-008 T2.5: substrate-LLM contract for cron voice output JSON schema.
// Engineering-owned · appended as cron-only suffix · NOT a persona.md placeholder.
const CRON_JSON_OUTPUT_SCHEMA = `output: a SINGLE JSON object on ONE line, two fields:
  {"header": "<your one-line sentence>", "outro": ""}
emit an outro only when a second beat meaningfully extends the header (a soft pivot, a forward-look); leave it empty (\`""\`) when one line says it.

no markdown fences. no preamble. just the JSON.`;

const SECTION_HEADER = '## System prompt template';

const docCache = new Map<string, string>();
const templateCache = new Map<string, string>();
const voiceAnchorsCache = new Map<string, string>();
const codexAnchorsCache = new Map<string, string>();

/**
 * Load a sibling-of-persona markdown file by convention. Used by both
 * voice-anchors and codex-anchors loaders — the same auto-discover pattern.
 * Returns empty string when absent (graceful · most characters won't have all).
 *
 * Cache lifetime: process-lifetime (no TTL · no invalidation). Edits to
 * voice-anchors.md / codex-anchors.md require a bot restart to take effect.
 * V0.6 ships with this constraint; hot-reload is V0.7+ daemon-stage work.
 */
function loadSiblingMarkdown(
  personaPath: string,
  filename: string,
  cache: Map<string, string>,
): string {
  const cached = cache.get(personaPath);
  if (cached !== undefined) return cached;

  const filePath = resolve(dirname(personaPath), filename);
  if (!existsSync(filePath)) {
    cache.set(personaPath, '');
    return '';
  }
  const content = readFileSync(filePath, 'utf8');
  cache.set(personaPath, content);
  return content;
}

/**
 * voice-anchors.md — operator-curated cross-post-type VOICE TEXTURE grounding.
 * Past character utterances that calibrate "is this character?" — distinct from
 * per-post-type ICE exemplars (which calibrate "is this a digest?").
 */
function loadVoiceAnchors(personaPath: string): string {
  return loadSiblingMarkdown(personaPath, 'voice-anchors.md', voiceAnchorsCache);
}

/**
 * codex-anchors.md — per-character mibera-codex SOIL grounding. The codex
 * prelude ({{CODEX_PRELUDE}}) loads a substrate-wide schema index. This file
 * is character-specific lore tilts: which archetypes resonate, which ancestor
 * lineage they live in, which factor → lore mappings their voice should pull.
 *
 * V0.6 character-stage: text-as-anchor (codex IS character memory).
 * V0.7+ daemon-stage: this file becomes voice template DNA the dNFT points at.
 *
 * Mirrors voice-anchors auto-discover. Empty string if absent.
 */
function loadCodexAnchors(personaPath: string): string {
  return loadSiblingMarkdown(personaPath, 'codex-anchors.md', codexAnchorsCache);
}

function loadDoc(personaPath: string): string {
  const cached = docCache.get(personaPath);
  if (cached !== undefined) return cached;
  const doc = readFileSync(personaPath, 'utf8');
  docCache.set(personaPath, doc);
  return doc;
}

function loadTemplate(personaPath: string): string {
  const cached = templateCache.get(personaPath);
  if (cached !== undefined) return cached;

  const raw = loadDoc(personaPath);
  const sectionStart = raw.indexOf(SECTION_HEADER);
  if (sectionStart === -1) {
    // cycle-008 T2.6 · throws BuildPromptError (still sync · caught by Effect.try in buildPrompt)
    throw new BuildPromptError({ kind: 'template-section-missing', personaPath });
  }

  const sectionBody = raw.slice(sectionStart);
  const fenceMatch = sectionBody.match(/^````([^\n]*)\n([\s\S]+?)\n````/m);
  if (!fenceMatch) {
    throw new BuildPromptError({
      kind: 'template-section-missing',
      personaPath,
      detail: 'could not extract fenced code block from system prompt section',
    });
  }

  const template = fenceMatch[2]!.trim();
  templateCache.set(personaPath, template);
  return template;
}

/** Extract a per-post-type fragment from the persona doc. */
function loadFragment(personaPath: string, postType: PostType): string {
  const doc = loadDoc(personaPath);
  const startMarker = `<!-- @FRAGMENT: ${postType} -->`;
  const endMarker = `<!-- @/FRAGMENT -->`;

  const start = doc.indexOf(startMarker);
  if (start === -1) {
    // cycle-008 T2.6 · throws BuildPromptError
    throw new BuildPromptError({ kind: 'fragment-not-found', personaPath, postType });
  }
  const after = doc.slice(start + startMarker.length);
  const endIdx = after.indexOf(endMarker);
  if (endIdx === -1) {
    throw new BuildPromptError({ kind: 'fragment-end-marker-missing', personaPath, postType });
  }

  return after.slice(0, endIdx).trim();
}

/** Brief output-instruction string per post type. */
function outputInstruction(postType: PostType): string {
  switch (postType) {
    case 'digest':
      return 'Write the weekly digest now. Stay groovy.';
    case 'micro':
      return 'Surface the one observation now. Casual, no greeting, no closing — just the thing you noticed.';
    case 'weaver':
      return 'Write the weaver observation now — name the cross-zone connection (or honestly say no pattern jumped out).';
    case 'lore_drop':
      return 'Write the lore-anchored observation now. Light, head-nod-to-regulars register.';
    case 'question':
      return 'Ask the question now. One question, anchored in the data, low-pressure.';
    case 'callout':
      return 'Write the callout now. Lead with 🚨 + the zone. Calm voice over alarm-shaped data.';
    case 'reply':
      // V0.7-A.2: chat-mode reply instruction. Mirrors the
      // CONVERSATION_OUTPUT_INSTRUCTION used by buildReplyPromptPair —
      // unification keeps the single canonical phrasing.
      return 'Respond now in voice. Concise. No greeting, no closing rituals — just the reply.';
  }
}

/**
 * Load a character's system-prompt template (used by apps/bot's banner
 * to log persona-load size). Pass any character to inspect its template.
 */
export function loadSystemPrompt(character: CharacterConfig): string {
  return loadTemplate(character.personaPath);
}

// ──────────────────────────────────────────────────────────────────────
// V0.7-A.2 — unified buildPrompt
// ──────────────────────────────────────────────────────────────────────
//
// The shape discriminator handles cron paths (digest/micro/weaver/lore_drop/
// question/callout) and the on-demand chat path ('reply') through a single
// substitution chain. Per-character persona.md owns all 7 fragments
// (post Phase A); the dispatch into the right fragment + the right
// user-half builder branches on `shape.kind` here.

/**
 * Discriminated shape union — what kind of utterance this prompt represents.
 * Determines fragment selection, output instruction, movement guidance,
 * zone substitutions, and user-half rendering.
 */
export type BuildPromptShape =
  | {
      kind: 'cron';
      zoneId: ZoneId;
      /** Cron PostType — digest/micro/weaver/lore_drop/question/callout. */
      postType: Exclude<PostType, 'reply'>;
    }
  | {
      kind: 'reply';
      /** Recent conversation context (already snapshotted from ledger by caller). */
      transcript: ReplyTranscriptEntry[];
      /** Discord username of the invoker (for the "you're chatting with X" frame). */
      authorUsername: string;
      /** The user's message text (the slash-command `prompt:` option). */
      userPrompt: string;
    };

export interface BuildPromptArgsUnified {
  character: CharacterConfig;
  shape: BuildPromptShape;
  /**
   * Environment-context block (`## Environment` heading + 4-6 lines · zone
   * identity, room read, tool guidance, recent context). Substituted into
   * `{{ENVIRONMENT}}` placeholder. Empty/omitted is a no-op for templates
   * that don't reference the placeholder.
   */
  environmentContext?: string;
  /**
   * Voice grimoire block (rendered VoiceCard · per-fire stance: entry,
   * shape, splash, exit, density, bullet_palette, witness). 2026-05-12 ·
   * decouples behavior parameters from persona prose · operator tunes
   * weights via .loa.config.yaml, sampler draws a card per fire, persona
   * reads via `{{VOICE_GRIMOIRE}}` placeholder. Empty/omitted = no-op for
   * templates that don't reference it. See packages/persona-engine/src/voice/.
   */
  voiceGrimoire?: string;
  /**
   * cycle-008 T2.5 · active factors from substrate (post-RF-002 reframe ·
   * sourced from `ZoneDigest.factor_trends[]` NOT cycle-005-gated
   * `permittedFactors[]`). Substituted via `renderActiveFactors` into
   * `{{ACTIVE_FACTORS}}` placeholder with marker wrap + normalization.
   * Required for `shape.kind === 'cron'` · undefined for chat-mode.
   */
  activeFactors?: ReadonlyArray<ActiveFactorRender>;
  /**
   * cycle-008 T2.5 · prior-week-hint pre-wrapped by `formatPriorWeekHint`
   * (HTML-entity-escaped + `<untrusted-content>` markers). Substituted
   * verbatim into `{{PRIOR_WEEK_HINT}}` placeholder. Required for
   * `shape.kind === 'cron'` (may be empty string) · undefined for chat-mode.
   */
  priorWeekHint?: string;
}

export interface BuildPromptResult {
  readonly systemPrompt: string;
  readonly userMessage: string;
  /**
   * cycle-008 fragment-sources tracking · populated when `shape.kind === 'cron'`
   * via offset-tracking substitution (per Flatline-Sprint SKP-004 HIGH 720 ·
   * single-pass with cursor-tracking · NOT brittle string-matching after mutation).
   * Empty array for chat-mode (no template substitution to track).
   */
  readonly fragmentSources: ReadonlyArray<FragmentSource>;
}

/**
 * Build a system+user prompt pair from a character's persona template.
 * Single canonical builder; `buildPromptPair` (cron) and `buildReplyPromptPair`
 * (chat) are thin delegators that construct the appropriate `BuildPromptShape`.
 *
 * Substitution order matters: BLOCK INJECTIONS first (fragment + anchors +
 * codex + exemplars + environment), then per-zone substitutions. This way any
 * `{{ZONE_NAME}}` / `{{DIMENSION}}` placeholders embedded in the injected
 * blocks also get substituted in the final prompt — no leak of literal
 * placeholder syntax to the LLM.
 */
export function buildPrompt(
  args: BuildPromptArgsUnified,
): Effect.Effect<BuildPromptResult, BuildPromptError, never> {
  return Effect.gen(function* () {
    const { character, shape } = args;

    // cycle-008 T2.5 Step 1 · validate cron args present (fail-loud per Q5)
    if (shape.kind === 'cron') {
      if (args.activeFactors === undefined) {
        yield* Effect.fail(
          new BuildPromptError({ kind: 'missing-cron-arg', argName: 'activeFactors' }),
        );
      }
      if (args.priorWeekHint === undefined) {
        yield* Effect.fail(
          new BuildPromptError({ kind: 'missing-cron-arg', argName: 'priorWeekHint' }),
        );
      }
    }

    // cycle-008 T2.5 Step 2 · validate no aggregate-stat-leakage (NFR-9)
    if (args.activeFactors) {
      yield* validateNoAggregateStatLeakage(args.activeFactors, args.priorWeekHint);
    }

    // cycle-008 T2.5 Step 3 · load template + siblings (sync · loadTemplate throws BuildPromptError)
    const template = yield* Effect.try({
      try: () => loadTemplate(character.personaPath),
      catch: (err) =>
        err instanceof BuildPromptError
          ? err
          : new BuildPromptError({
              kind: 'template-section-missing',
              personaPath: character.personaPath,
              detail: String(err),
            }),
    });
    const codex = loadCodexPrelude();
    const voiceAnchors = loadVoiceAnchors(character.personaPath);
    const codexAnchors = loadCodexAnchors(character.personaPath);
    const environment = args.environmentContext ?? '';
    const voiceGrimoire = args.voiceGrimoire ?? '';

    // Per-shape: fragment, output instruction, exemplars, movement guidance,
    // zone substitution values.
    const postType: PostType = shape.kind === 'cron' ? shape.postType : 'reply';
    const fragment = yield* Effect.try({
      try: () => loadFragment(character.personaPath, postType),
      catch: (err) =>
        err instanceof BuildPromptError
          ? err
          : new BuildPromptError({
              kind: 'fragment-not-found',
              personaPath: character.personaPath,
              postType,
              detail: String(err),
            }),
    });
    const instruction = outputInstruction(postType);
    const exemplars =
      shape.kind === 'cron'
        ? buildExemplarBlock(character, shape.postType)
        : '';

    const movementGuidance =
      shape.kind === 'cron'
        ? buildMovementGuidance()
        : '(not applicable in conversation mode)';

    const zoneId = shape.kind === 'cron' ? shape.zoneId : 'conversation';
    const zoneName =
      shape.kind === 'cron'
        ? safeResolveZoneDisplayName(shape.zoneId, 'persona-loader')
        : 'this conversation';
    const dimensionName =
      shape.kind === 'cron'
        ? DIMENSION_NAME[ZONE_REGISTRY[shape.zoneId].dimension]
        : 'Conversation';

    // cycle-008 T2.5 · render new substrate-state placeholders
    const activeFactorsBlock = renderActiveFactors(args.activeFactors);
    const priorWeekHintBlock = args.priorWeekHint ?? '';

    const inputPayloadMarker = '═══ INPUT PAYLOAD ═══';
    const idx = template.indexOf(inputPayloadMarker);
    if (idx === -1) {
      // cycle-008 T2.6 · Effect.fail instead of native throw
      yield* Effect.fail(
        new BuildPromptError({
          kind: 'input-payload-marker-missing',
          personaPath: character.personaPath,
        }),
      );
    }

    // cycle-008 T2.5 · single-pass substitution with offset tracking
    // (per Flatline-Sprint SKP-004 HIGH 720 · no brittle string-matching after mutation)
    const templateHead = template.slice(0, idx);
    const substitutions = buildSubstitutionList({
      fragment,
      movementGuidance,
      voiceAnchors,
      codexAnchors,
      codex,
      environment,
      voiceGrimoire,
      exemplars,
      activeFactorsBlock,
      priorWeekHintBlock,
      zoneId,
      zoneName,
      dimensionName,
      postType,
      personaPath: character.personaPath,
    });
    const substituted = substituteWithTracking(templateHead, substitutions);
    const systemHalfRaw = substituted.result.trimEnd();
    const templateRegion: readonly [number, number] = [0, systemHalfRaw.length];

    // cycle-008 T2.5 · cron-only code-appended suffixes (JSON schema + LOCK)
    const systemHalf =
      shape.kind === 'cron'
        ? `${systemHalfRaw}\n\n${CRON_JSON_OUTPUT_SCHEMA}\n\n${UNTRUSTED_CONTENT_LLM_INSTRUCTION}`
        : systemHalfRaw;

    // cycle-008 T2.5 · validate FR-15a invariants (per T2.3a · template_region bounded)
    if (shape.kind === 'cron') {
      yield* validateFragmentSourcesInvariants({
        fragmentSources: substituted.fragmentSources,
        templateRegion,
      });
    }

    // User-half: cron uses the template's INPUT PAYLOAD section (with
    // substitutions). Reply builds a fresh transcript+prompt frame — the
    // template's INPUT PAYLOAD doesn't apply (no zone/post-type/raw-stats).
    let userHalf: string;
    if (shape.kind === 'cron') {
      userHalf = template
        .slice(idx)
        .replace(/\{\{POST_TYPE_OUTPUT_INSTRUCTION\}\}/g, instruction)
        .replace(/\{\{MOVEMENT_GUIDANCE\}\}/g, movementGuidance)
        .replace(/\{\{VOICE_ANCHORS\}\}/g, voiceAnchors)
        .replace(/\{\{CODEX_ANCHORS\}\}/g, codexAnchors)
        .replace(/\{\{CODEX_PRELUDE\}\}/g, codex)
        .replace(/\{\{ENVIRONMENT\}\}/g, environment)
        .replace(/\{\{EXEMPLARS\}\}/g, exemplars)
        .replace(/\{\{ZONE_ID\}\}/g, zoneId)
        .replace(/\{\{ZONE_NAME\}\}/g, zoneName)
        .replace(/\{\{DIMENSION\}\}/g, dimensionName)
        .replace(/\{\{POST_TYPE\}\}/g, postType)
        .trim();
    } else {
      const transcript = renderTranscript(
        shape.transcript,
        character.displayName ?? character.id,
      );
      const parts: string[] = [];
      parts.push(`You're chatting with ${shape.authorUsername} in Discord.`);
      if (transcript) {
        parts.push(``);
        parts.push(`Recent conversation in this channel (oldest first):`);
        parts.push(transcript);
      }
      parts.push(``);
      parts.push(`${shape.authorUsername} just said:`);
      parts.push(shape.userPrompt.trim());
      parts.push(``);
      parts.push(instruction);
      userHalf = parts.join('\n');
    }

    return {
      systemPrompt: systemHalf,
      userMessage: userHalf,
      fragmentSources: substituted.fragmentSources,
    } satisfies BuildPromptResult;
  });
}

// ──────────────────────────────────────────────────────────────────────
// cycle-008 T2.5 · single-pass substitution with offset tracking
// ──────────────────────────────────────────────────────────────────────
//
// Replaces chained .replace().replace() approach with one that records
// each fragment's offset in the FINAL prompt (not the original template).
// Multiple occurrences of the same placeholder each get their own
// fragment_source entry. No string-matching after mutation (per
// Flatline-Sprint SKP-004 HIGH 720 · defends against brittle false-attribution).

interface SubstitutionEntry {
  readonly placeholder: string;
  readonly fragment: string;
  readonly meta: Omit<FragmentSource, 'prompt_offset'>;
}

interface SubstituteWithTrackingResult {
  readonly result: string;
  readonly fragmentSources: FragmentSource[];
}

function substituteWithTracking(
  template: string,
  substitutions: ReadonlyArray<SubstitutionEntry>,
): SubstituteWithTrackingResult {
  // 1. Find every occurrence of every placeholder · sort by template offset
  type Occurrence = {
    offset: number;
    length: number;
    fragment: string;
    meta: SubstitutionEntry['meta'];
  };
  const occurrences: Occurrence[] = [];
  for (const sub of substitutions) {
    let searchFrom = 0;
    while (true) {
      const idx = template.indexOf(sub.placeholder, searchFrom);
      if (idx === -1) break;
      occurrences.push({
        offset: idx,
        length: sub.placeholder.length,
        fragment: sub.fragment,
        meta: sub.meta,
      });
      searchFrom = idx + sub.placeholder.length;
    }
  }
  occurrences.sort((a, b) => a.offset - b.offset);

  // 2. Walk template + record fragment final-prompt offsets
  let result = '';
  let cursor = 0;
  const fragmentSources: FragmentSource[] = [];
  for (const occ of occurrences) {
    result += template.slice(cursor, occ.offset);
    const fragmentStart = result.length;
    result += occ.fragment;
    const fragmentEnd = result.length;
    // Skip recording fragment_source for empty substitutions
    // (e.g., undefined environmentContext / voiceGrimoire / exemplars
    // substitute as '' · zero-length attribution would violate FR-15a).
    if (fragmentEnd > fragmentStart) {
      fragmentSources.push({
        ...occ.meta,
        prompt_offset: [fragmentStart, fragmentEnd] as const,
      });
    }
    cursor = occ.offset + occ.length;
  }
  result += template.slice(cursor);
  return { result, fragmentSources };
}

interface BuildSubstitutionListArgs {
  fragment: string;
  movementGuidance: string;
  voiceAnchors: string;
  codexAnchors: string;
  codex: string;
  environment: string;
  voiceGrimoire: string;
  exemplars: string;
  activeFactorsBlock: string;
  priorWeekHintBlock: string;
  zoneId: string;
  zoneName: string;
  dimensionName: string;
  postType: PostType;
  personaPath: string;
}

function buildSubstitutionList(args: BuildSubstitutionListArgs): SubstitutionEntry[] {
  const p = args.personaPath;
  // Note: source_lines is approximate · cycle-008 uses [0, 0] sentinel for
  // runtime-substituted data · refined source_line tracking is cycle-009 work.
  return [
    {
      placeholder: '{{POST_TYPE_GUIDANCE}}',
      fragment: args.fragment,
      meta: { layer: 'persona', source_file: p, source_lines: [0, 0], fragment_kind: 'post-type-guidance' },
    },
    {
      placeholder: '{{MOVEMENT_GUIDANCE}}',
      fragment: args.movementGuidance,
      meta: { layer: 'persona', source_file: 'loader.ts::buildMovementGuidance', source_lines: [0, 0], fragment_kind: 'movement-guidance' },
    },
    {
      placeholder: '{{VOICE_ANCHORS}}',
      fragment: args.voiceAnchors,
      meta: { layer: 'voice', source_file: p.replace('persona.md', 'voice-anchors.md'), source_lines: [0, 0], fragment_kind: 'voice-anchors' },
    },
    {
      placeholder: '{{CODEX_ANCHORS}}',
      fragment: args.codexAnchors,
      meta: { layer: 'voice', source_file: p.replace('persona.md', 'codex-anchors.md'), source_lines: [0, 0], fragment_kind: 'codex-anchors' },
    },
    {
      placeholder: '{{CODEX_PRELUDE}}',
      fragment: args.codex,
      meta: { layer: 'voice', source_file: 'score/codex-context.ts', source_lines: [0, 0], fragment_kind: 'codex-prelude' },
    },
    {
      placeholder: '{{ENVIRONMENT}}',
      fragment: args.environment,
      meta: { layer: 'environment', source_file: 'compose/environment.ts', source_lines: [0, 0], fragment_kind: 'environment' },
    },
    {
      placeholder: '{{VOICE_GRIMOIRE}}',
      fragment: args.voiceGrimoire,
      meta: { layer: 'voice', source_file: 'voice/sampler.ts', source_lines: [0, 0], fragment_kind: 'voice-grimoire' },
    },
    {
      placeholder: '{{EXEMPLARS}}',
      fragment: args.exemplars,
      meta: { layer: 'persona', source_file: 'persona/exemplar-loader.ts', source_lines: [0, 0], fragment_kind: 'exemplars' },
    },
    // cycle-008 NEW
    {
      placeholder: '{{ACTIVE_FACTORS}}',
      fragment: args.activeFactorsBlock,
      meta: { layer: 'environment', source_file: 'score-mcp::factor_trends', source_lines: [0, 0], fragment_kind: 'active-factors' },
    },
    {
      placeholder: '{{PRIOR_WEEK_HINT}}',
      fragment: args.priorWeekHintBlock,
      meta: { layer: 'voice', source_file: 'orchestrator/format-prior-week-hint.ts', source_lines: [0, 0], fragment_kind: 'prior-week-hint' },
    },
    // Per-zone substitutions
    {
      placeholder: '{{ZONE_ID}}',
      fragment: args.zoneId,
      meta: { layer: 'environment', source_file: 'domain/zone-registry.ts', source_lines: [0, 0], fragment_kind: 'zone-id' },
    },
    {
      placeholder: '{{ZONE_NAME}}',
      fragment: args.zoneName,
      meta: { layer: 'environment', source_file: 'domain/zone-registry.ts', source_lines: [0, 0], fragment_kind: 'zone-name' },
    },
    {
      placeholder: '{{DIMENSION}}',
      fragment: args.dimensionName,
      meta: { layer: 'environment', source_file: 'score/types.ts', source_lines: [0, 0], fragment_kind: 'dimension' },
    },
    {
      placeholder: '{{POST_TYPE}}',
      fragment: args.postType,
      meta: { layer: 'persona', source_file: 'compose/post-types.ts', source_lines: [0, 0], fragment_kind: 'post-type' },
    },
  ];
}

/**
 * Movement framing per ANNOUNCE_NEGATIVE_MOVEMENT env flag (V0.6-D
 * operator pick 2026-04-30: default false — internal observation phase
 * wants positive-only movement; toggleable to true once tone calibrated).
 *
 * KEEPER + WEAVER reframe (2026-04-30 post-gumi-feedback): when
 * negative movement IS surfaced, frame it as DIMENSION SHIFT not
 * PERSONAL DROP. Dimensions are raves; movement between them is
 * ecosystem motion. NEVER use punitive emoji (🔴) or verbs (slid /
 * fell / tumbled) — the system has retired those.
 */
function buildMovementGuidance(): string {
  const announceNegative = process.env.ANNOUNCE_NEGATIVE_MOVEMENT === 'true';
  return announceNegative
    ? `MOVEMENT POLICY: announce both positive AND shift movement, with
KEEPER+WEAVER framing — dimensions are different raves, movement
BETWEEN them is ecosystem motion, NOT personal failure. Frame
positive movement as ARRIVAL / CLIMBING DEEPER (🟢, "arrived at NFT
top 100", "climbed deep into Onchain"). Frame relative drops or
exits as DIMENSION SHIFT (🌊, "drifted from NFT — last #68", "rave
moved?"). NEVER use 🔴 / "slid" / "fell" / "tumbled" — punitive
coding has been retired per KEEPER+WEAVER doctrine 2026-04-30.
The rank-change is data, not a verdict.`
    : `MOVEMENT POLICY: announce POSITIVE movement only this phase —
arrivals (🟢 entered_top_tier), climbs (🟢 deeper into a dimension),
factor advances. DO NOT surface drops, exits, or shifts in prose.
Negative-movement data is in raw_stats.rank_changes.dropped /
exited_top_tier — read it for context, NEVER mention it in output.
Internal-observation phase per operator 2026-04-30; toggleable via
ANNOUNCE_NEGATIVE_MOVEMENT env flag. When toggled on, the shift
framing kicks in (dimensions-as-raves, not punitive). Until then,
silence on relative drops is the conservative + KEEPER-aligned
default.`;
}

// ──────────────────────────────────────────────────────────────────────
// Backward-compat shims
// ──────────────────────────────────────────────────────────────────────
//
// `buildPromptPair` and `buildReplyPromptPair` preserve their pre-V0.7-A.2
// signatures and delegate to `buildPrompt` with the appropriate shape.
// All existing callers (composer.ts, agent-gateway.ts, reply.ts) work
// unchanged. Removable in V0.7-A.3+ once direct `buildPrompt` migration
// is complete.

export interface BuildPromptArgs {
  character: CharacterConfig;
  zoneId: ZoneId;
  postType: PostType;
  /**
   * V0.7-A.1 — optional environment-context block (`## Environment` heading
   * + 4-6 lines · zone identity, room read, tool guidance, recent context).
   * Substituted into `{{ENVIRONMENT}}` placeholder. When omitted, the
   * substitution is a no-op (empty replacement) — backward-compatible with
   * persona templates that don't carry the placeholder.
   */
  environmentContext?: string;
}

export function buildPromptPair(args: BuildPromptArgs): {
  systemPrompt: string;
  userMessage: string;
} {
  // V0.7-A.2: `buildPromptPair` is the cron-shaped shim.
  // cycle-008 T2.7: sync shim around Effect.runSync(buildPrompt(...)).
  // Throws BuildPromptError synchronously if Effect fails (Effect.runSync semantics).
  // Smoke scripts continue to use this sync shim unchanged.
  if (args.postType === 'reply') {
    throw new BuildPromptError({
      kind: 'missing-cron-arg',
      argName: "postType='reply' is invalid for the cron shim. Use buildReplyPromptPair for chat-mode.",
    });
  }
  const result = Effect.runSync(
    buildPrompt({
      character: args.character,
      shape: { kind: 'cron', zoneId: args.zoneId, postType: args.postType },
      environmentContext: args.environmentContext,
      // cycle-008 T2.7: shim provides empty defaults · cron callers should migrate
      // to direct buildPrompt() invocation to pass real activeFactors + priorWeekHint.
      // claude-sdk.live.ts migration happens in S3 T3.3.
      activeFactors: [],
      priorWeekHint: '',
    }),
  );
  return { systemPrompt: result.systemPrompt, userMessage: result.userMessage };
}

// ──────────────────────────────────────────────────────────────────────
// V0.7-A.0 — chat-mode prompt builder (V0.7-A.2 unified)
// ──────────────────────────────────────────────────────────────────────
//
// V0.7-A.2: the chat-mode prompt content lives in per-character persona.md
// `<!-- @FRAGMENT: reply -->` blocks (lifted from the historical
// CONVERSATION_MODE_OVERRIDE constant for byte-identical content). The
// chat output instruction lives in `outputInstruction('reply')`. The
// shim below preserves the V0.7-A.0 signature; all dispatch flows
// through `buildPrompt` with `kind: 'reply'`.

export interface BuildReplyPromptArgs {
  character: CharacterConfig;
  /** The user's message text (the slash-command `prompt:` option). */
  prompt: string;
  /** Discord username of the invoker (for situation hint + transcript). */
  authorUsername: string;
  /** Recent ledger entries (already snapshotted by caller). */
  history: ReplyTranscriptEntry[];
  /**
   * V0.7-A.1 — optional environment-context block (built by
   * `compose/environment.ts`). Substituted into `{{ENVIRONMENT}}`
   * placeholder. Backward-compatible no-op when absent.
   */
  environmentContext?: string;
  /**
   * 2026-05-12 — optional voice grimoire block (built by
   * `voice/sampler.renderVoiceCard()`). Substituted into
   * `{{VOICE_GRIMOIRE}}` placeholder. When omitted, persona falls back
   * to the DATA-SHAPED default. Backward-compatible.
   */
  voiceGrimoire?: string;
}

export interface ReplyTranscriptEntry {
  role: 'user' | 'character';
  authorUsername: string;
  content: string;
}

/**
 * Build a chat-mode prompt pair (V0.7-A.0 surface · V0.7-A.2 implementation).
 *
 * Backward-compat shim: delegates to `buildPrompt` with `kind: 'reply'`.
 * The unified builder loads the 'reply' fragment from persona.md (lifted
 * from the now-historical CONVERSATION_MODE_OVERRIDE constant) and applies
 * the same substitution chain the cron path uses.
 *
 * Civic-layer note: the substrate supplies the conversation framing.
 * Characters supply voice. They never compose Discord plumbing themselves.
 */
export function buildReplyPromptPair(args: BuildReplyPromptArgs): {
  systemPrompt: string;
  userMessage: string;
} {
  // cycle-008 T2.7: sync shim around Effect.runSync(buildPrompt(...)).
  // Chat-mode passes undefined cycle-008 args · buildPrompt's regression fence
  // produces byte-identical output to pre-S2 for chat-mode (per T2.0 baseline +
  // T2.9 scenario 5 acceptance gate, modulo new substrate-state substitutions
  // for now-defined placeholders in persona.md).
  const result = Effect.runSync(
    buildPrompt({
      character: args.character,
      shape: {
        kind: 'reply',
        transcript: args.history,
        authorUsername: args.authorUsername,
        userPrompt: args.prompt,
      },
      environmentContext: args.environmentContext,
      voiceGrimoire: args.voiceGrimoire,
      // cycle-008: chat-mode passes undefined · skips cron-arg-required validation
    }),
  );
  return { systemPrompt: result.systemPrompt, userMessage: result.userMessage };
}

function renderTranscript(history: ReplyTranscriptEntry[], characterDisplayName: string): string {
  if (history.length === 0) return '';
  return history
    .map((h) => {
      const speaker = h.role === 'character' ? characterDisplayName : h.authorUsername;
      return `${speaker}: ${h.content}`;
    })
    .join('\n');
}
