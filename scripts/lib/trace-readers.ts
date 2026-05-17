/**
 * Trace readers · cycle-007 S4/T4.1 (D4 closure).
 *
 * Shared library used by both `scripts/dashboard.ts` (HTTP API) and
 * `scripts/trace.ts` (agent CLI). Single source of truth for trace-row parsing.
 *
 * Honors cycle-007 trace envelope (layer · layer_op · emitted_at) AND tolerates
 * pre-cycle-007 legacy rows that lack the envelope (forward-only migration per
 * OP-Q2 · readers return `layer: 'unknown'` for legacy rows).
 *
 * Quality-gate provenance:
 * - Flatline PRD SKP-001/CRITICAL (Phase 2 · 870): explicit freeside-characters-owned
 *   trace file allowlist · excludes Loa-owned `.run/audit.jsonl`.
 * - Flatline PRD IMP-012 (Phase 2 · 820 DISPUTED): reader-tolerance contract pinned.
 * - Flatline SDD IMP-012 (Phase 4 · 690 DISPUTED): explicit findRepoRoot algorithm
 *   (walk up to `.git/HEAD` OR `package.json` with `workspaces`).
 */

import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { isTraceEnvelope, type TraceLayer } from '../../packages/persona-engine/src/observability/trace-envelope.ts';

// ──────────────────────────────────────────────────────────────────────
// Allowlist · Flatline SKP-001/CRITICAL · ATK-007 quick-fix
// ──────────────────────────────────────────────────────────────────────

/**
 * freeside-characters-owned trace files. EXCLUDES Loa-framework-owned `.run/audit.jsonl`
 * which has its own ownership (per Flatline SKP-001/CRITICAL Phase 2 narrowing).
 *
 * Glob patterns expanded against the resolved .run/ dir (apps/bot/.run/ OR .run/).
 */
export const FREESIDE_CHARACTERS_TRACE_FILES = [
  'llm-trace.jsonl',
  'score-snapshot-rejections.jsonl',
  'sanitize-violations.jsonl',
  'voice-memory-deletions.jsonl',
  // voice-memory/<stream>/*.jsonl handled as a directory walk
] as const;

export const FREESIDE_CHARACTERS_TRACE_DIRS = ['voice-memory'] as const;

// ──────────────────────────────────────────────────────────────────────
// Path resolution · Flatline IMP-012 explicit repo-root algorithm
// ──────────────────────────────────────────────────────────────────────

/**
 * Walk up from the script directory looking for a repo-root marker.
 * Marker = `.git/HEAD` OR `package.json` with `workspaces` field.
 * Throws if not found within 10 levels.
 *
 * Per Flatline SDD IMP-012 (Phase 4): explicit algorithm so consumers can verify
 * the path-containment behavior without grepping the implementation.
 */
export function findRepoRoot(startDir: string = import.meta.dir): string {
  let dir = realpathSync(startDir);
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, '.git/HEAD'))) return dir;
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
      if (pkg.workspaces) return dir;
    } catch {
      /* not a workspaces package.json · keep walking */
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `findRepoRoot: no .git or workspaces package.json within 10 levels from ${startDir}`,
  );
}

const CANDIDATE_RUN_DIRS = () => {
  const root = findRepoRoot();
  if (process.env.TRACE_RUN_DIR) return [resolve(process.env.TRACE_RUN_DIR)];
  return [resolve(root, 'apps/bot/.run'), resolve(root, '.run')];
};

function resolveExistingPath(...segments: string[]): string {
  for (const base of CANDIDATE_RUN_DIRS()) {
    const p = resolve(base, ...segments);
    if (existsSync(p)) return p;
  }
  return resolve(CANDIDATE_RUN_DIRS()[0]!, ...segments);
}

// ──────────────────────────────────────────────────────────────────────
// Row shape · trace envelope + reader-tolerance for legacy
// ──────────────────────────────────────────────────────────────────────

export interface TraceRow {
  readonly layer: TraceLayer | 'unknown';
  readonly layer_op: string | null;
  readonly emitted_at: string | null;
  readonly raw: Record<string, unknown>;
  readonly source_file: string;
  readonly line_number: number;
}

export interface ReadOpts {
  readonly zone?: string;
  readonly layer?: TraceLayer;
  readonly limit?: number;
  readonly since?: string; // ISO 8601 — emitted_at >= since (post-cutoff only)
}

function rowFromLine(raw: Record<string, unknown>, source_file: string, line_number: number): TraceRow {
  if (isTraceEnvelope(raw)) {
    return {
      layer: raw.layer,
      layer_op: raw.layer_op,
      emitted_at: raw.emitted_at,
      raw,
      source_file,
      line_number,
    };
  }
  // Legacy row · forward-only migration per OP-Q2 · IMP-012 reader-tolerance contract.
  return {
    layer: 'unknown',
    layer_op: null,
    emitted_at: typeof raw.at === 'string' ? raw.at : null,
    raw,
    source_file,
    line_number,
  };
}

function readJsonlRows(absPath: string): TraceRow[] {
  if (!existsSync(absPath)) return [];
  const rows: TraceRow[] = [];
  const text = readFileSync(absPath, 'utf-8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      rows.push(rowFromLine(raw, absPath, i + 1));
    } catch {
      // malformed line · skip · do not crash (IMP-012 tolerance)
    }
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────
// Public readers
// ──────────────────────────────────────────────────────────────────────

/** Resolve all freeside-characters-owned trace file paths (allowlist + voice-memory glob). */
export function allTraceFilePaths(): string[] {
  const out: string[] = [];
  for (const file of FREESIDE_CHARACTERS_TRACE_FILES) {
    const p = resolveExistingPath(file);
    if (existsSync(p)) out.push(p);
  }
  for (const subdir of FREESIDE_CHARACTERS_TRACE_DIRS) {
    const dir = resolveExistingPath(subdir);
    if (!existsSync(dir)) continue;
    try {
      for (const stream of readdirSync(dir)) {
        const streamDir = resolve(dir, stream);
        if (!statSync(streamDir).isDirectory()) continue;
        for (const f of readdirSync(streamDir)) {
          if (f.endsWith('.jsonl')) out.push(resolve(streamDir, f));
        }
      }
    } catch { /* dir read failed · skip */ }
  }
  return out;
}

function applyFilters(rows: TraceRow[], opts: ReadOpts): TraceRow[] {
  let out = rows;
  if (opts.layer) out = out.filter((r) => r.layer === opts.layer);
  if (opts.zone) {
    out = out.filter((r) => {
      const z = r.raw.zone ?? (r.raw as { stream?: string }).stream;
      return typeof z === 'string' && z === opts.zone;
    });
  }
  if (opts.since) out = out.filter((r) => (r.emitted_at ?? '') >= opts.since!);
  if (opts.limit && out.length > opts.limit) out = out.slice(-opts.limit);
  return out;
}

/** Read N most-recent rows (default 10) across all allowlisted trace files. */
export function readLatest(opts: ReadOpts = {}): TraceRow[] {
  const all: TraceRow[] = [];
  for (const path of allTraceFilePaths()) all.push(...readJsonlRows(path));
  // Sort by emitted_at desc · stable on legacy null
  all.sort((a, b) => (b.emitted_at ?? '').localeCompare(a.emitted_at ?? ''));
  return applyFilters(all, { ...opts, limit: opts.limit ?? 10 });
}

/** Find first row matching a run_id / trace UUID across all allowlisted files. */
export function readByRunId(runId: string): TraceRow | null {
  for (const path of allTraceFilePaths()) {
    for (const row of readJsonlRows(path)) {
      const rid = row.raw.run_id ?? row.raw.id;
      if (typeof rid === 'string' && rid === runId) return row;
    }
  }
  return null;
}

/** Filter by layer · optional zone. */
export function readByLayer(layer: TraceLayer, opts: ReadOpts = {}): TraceRow[] {
  return readLatest({ ...opts, layer });
}

/** Voice-specific reader (prompt + response + tokens from llm-trace.jsonl). */
export function readVoice(zone: string, opts: ReadOpts = {}): TraceRow[] {
  const llm = resolveExistingPath('llm-trace.jsonl');
  const rows = readJsonlRows(llm);
  return applyFilters(rows.reverse(), { ...opts, zone });
}

// ──────────────────────────────────────────────────────────────────────
// explainRow · v1-schema-conforming output (INV-13 · per BB HIGH-5)
// ──────────────────────────────────────────────────────────────────────

export interface ExplainedRow {
  readonly schema_version: '1';
  readonly identified_layer: TraceLayer | 'unknown';
  readonly identified_op: string | null;
  readonly likely_source: { readonly file: string; readonly line_range: [number, number] } | null;
  readonly raw: Record<string, unknown>;
  readonly warnings: string[];
}

/**
 * Source-mapping heuristics for pre-envelope rows (IMP-012 reader-tolerance · best-effort).
 * Maps observed payload shapes → likely producer file:line.
 *
 * Used by trace:explain to give operators a starting point when pasted rows lack the envelope.
 */
const SOURCE_HINTS: ReadonlyArray<{
  readonly match: (raw: Record<string, unknown>) => boolean;
  readonly source: { readonly file: string; readonly line_range: [number, number] };
  readonly inferred_layer: TraceLayer;
  readonly inferred_op: string;
}> = [
  {
    match: (r) => 'system_prompt' in r && 'output' in r && 'duration_ms' in r,
    source: { file: 'packages/persona-engine/src/observability/llm-trace.ts', line_range: [60, 100] },
    inferred_layer: 'voice',
    inferred_op: 'bedrock-converse',
  },
  {
    match: (r) => 'rejected_at' in r && 'reason' in r,
    source: { file: 'packages/persona-engine/src/live/score-snapshot-rejections.ts', line_range: [28, 50] },
    inferred_layer: 'substrate',
    inferred_op: 'snapshot-rejection',
  },
  {
    match: (r) => 'violations' in r && 'sample' in r,
    source: { file: 'packages/persona-engine/src/deliver/sanitize.ts', line_range: [285, 305] },
    inferred_layer: 'presentation',
    inferred_op: 'sanitize-violation',
  },
  {
    match: (r) => 'stream' in r && 'key' in r && 'user_id' in r,
    source: { file: 'packages/persona-engine/src/live/voice-memory.live.ts', line_range: [134, 180] },
    inferred_layer: 'voice',
    inferred_op: 'memory-write',
  },
];

/**
 * Parse a single trace row (JSON string) and identify the producing layer + likely source.
 * Conforms to INV-13 v1 schema at `.claude/data/trace-explain-output.schema.json`.
 */
export function explainRow(rawJson: string): ExplainedRow {
  const warnings: string[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(rawJson) as Record<string, unknown>;
  } catch (e) {
    return {
      schema_version: '1',
      identified_layer: 'unknown',
      identified_op: null,
      likely_source: null,
      raw: {},
      warnings: [`malformed-json: ${(e as Error).message}`],
    };
  }

  if (isTraceEnvelope(raw)) {
    return {
      schema_version: '1',
      identified_layer: raw.layer,
      identified_op: raw.layer_op,
      likely_source: null, // envelope-tagged rows don't need source-hint inference
      raw,
      warnings,
    };
  }

  warnings.push('row-predates-envelope · layer inferred from shape · pre-cycle-007 trace');
  for (const hint of SOURCE_HINTS) {
    if (hint.match(raw)) {
      return {
        schema_version: '1',
        identified_layer: hint.inferred_layer,
        identified_op: hint.inferred_op,
        likely_source: hint.source,
        raw,
        warnings,
      };
    }
  }

  return {
    schema_version: '1',
    identified_layer: 'unknown',
    identified_op: null,
    likely_source: null,
    raw,
    warnings: [...warnings, 'no-shape-hint-matched · operator-grep recommended'],
  };
}
