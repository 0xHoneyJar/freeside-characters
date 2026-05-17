#!/usr/bin/env bun
/**
 * Trace CLI · cycle-007 S4/T4.2 (D4 closure · "killer feature" per operator kickoff).
 *
 * Agent-first surface for trace debugging. 5 subcommands:
 *   trace:latest [--zone X] [--layer L] [--limit N] [--format human|json]
 *   trace:get --run-id Y [--format human|json]
 *   trace:layer --layer L [--zone X] [--limit N] [--format human|json]
 *   trace:voice --zone X [--limit N] [--format human|json]
 *   trace:explain [--file PATH] [--line N] [--run-id Y] [--latest] [--format human|json]
 *
 * Quality-gate provenance:
 * - Flatline PRD IMP-001 (Phase 2 · 895): STDIN streaming + 1MB byte-count limit + malformed-JSON exit
 * - Flatline PRD IMP-003 (Phase 2 · 870 · INV-13): stable v1 JSON schema for trace:explain output
 * - Flatline PRD SKP-002/HIGH (Phase 2 · 780): STDIN-first · positional arg rejected (shell-escape risk)
 * - BB design HIGH-1 (Phase 3.5): --file realpath + repo-root containment + extension allowlist
 * - Flatline SDD IMP-012 (Phase 4 · 690): explicit findRepoRoot algorithm (in trace-readers.ts)
 * - Flatline SDD SKP-001/HIGH (Phase 4 · 760): .jsonl files multi-row · require --line/--run-id/--latest
 * - Red Team ATK-007 (Phase 4.5 · 580 quick-fix): strict FREESIDE_CHARACTERS_TRACE_FILES allowlist +
 *   LOA_TRACE_TEST_MODE=1 gate for fixture .json files
 * - Red Team AC-RT-003 (Phase 4.5 · 740 · INV-18): sanitizeForTerminal strips C0/C1 + OSC 8 from payload strings
 */

import { resolve, relative } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import {
  readLatest,
  readByRunId,
  readByLayer,
  readVoice,
  explainRow,
  findRepoRoot,
  allTraceFilePaths,
  type TraceRow,
  type ExplainedRow,
} from './lib/trace-readers.ts';
import { sanitizeForTerminal } from './lib/safe-render.ts';
import type { TraceLayer } from '../packages/persona-engine/src/observability/trace-envelope.ts';

const MAX_STDIN_BYTES = 1024 * 1024; // Flatline IMP-001 · 1MB DoS prevention
const LAYER_GLYPH: Record<TraceLayer | 'unknown', string> = {
  substrate: '▣',
  voice: '◈',
  presentation: '◆',
  'medium-render': '▶',
  orchestrator: '♦',
  unknown: '?',
};

// ──────────────────────────────────────────────────────────────────────
// Arg parsing
// ──────────────────────────────────────────────────────────────────────

interface ParsedArgs {
  readonly _: string[];
  readonly zone?: string;
  readonly layer?: TraceLayer;
  readonly limit?: number;
  readonly file?: string;
  readonly line?: number;
  readonly latest?: boolean;
  readonly 'run-id'?: string;
  readonly format?: 'human' | 'json';
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const opts: Record<string, string | number | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        const num = Number(next);
        opts[key] = Number.isFinite(num) && /^\d+$/.test(next) ? num : next;
        i++;
      } else {
        opts[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { _: positional, ...(opts as Partial<ParsedArgs>) } as ParsedArgs;
}

// ──────────────────────────────────────────────────────────────────────
// Human format (TTY-aware ANSI color · OFF when piped or NO_COLOR set)
// ──────────────────────────────────────────────────────────────────────

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const LAYER_COLOR: Record<TraceLayer | 'unknown', string> = {
  substrate: USE_COLOR ? '\x1b[38;2;100;160;220m' : '',
  voice: USE_COLOR ? '\x1b[38;2;220;180;100m' : '',
  presentation: USE_COLOR ? '\x1b[38;2;120;200;160m' : '',
  'medium-render': USE_COLOR ? '\x1b[38;2;200;160;220m' : '',
  orchestrator: USE_COLOR ? '\x1b[38;2;180;160;220m' : '',
  unknown: USE_COLOR ? '\x1b[38;2;160;160;160m' : '',
};
const RESET = USE_COLOR ? '\x1b[0m' : '';

function humanLine(row: TraceRow): string {
  const glyph = LAYER_GLYPH[row.layer];
  const color = LAYER_COLOR[row.layer];
  const at = row.emitted_at ?? '?';
  // sanitizeForTerminal on payload-derived strings (AC-RT-003 INV-18)
  const zone = sanitizeForTerminal(String(row.raw.zone ?? row.raw.stream ?? '?'));
  const op = sanitizeForTerminal(row.layer_op ?? '?');
  const summary = sanitizeForTerminal(
    String(row.raw.reason ?? row.raw.user_message ?? row.raw.output ?? row.raw.violations ?? '').slice(0, 80),
  );
  return `${color}${glyph} ${row.layer.padEnd(13)}${RESET} ${op.padEnd(22)} ${at}  zone=${zone}\n  ${summary}`;
}

function humanRows(rows: TraceRow[]): string {
  return rows.map(humanLine).join('\n\n');
}

function humanExplain(e: ExplainedRow): string {
  const glyph = LAYER_GLYPH[e.identified_layer];
  const color = LAYER_COLOR[e.identified_layer];
  const lines: string[] = [];
  lines.push(`${color}${glyph} ${e.identified_layer}${RESET}  op=${sanitizeForTerminal(e.identified_op ?? '?')}`);
  if (e.likely_source) {
    lines.push(`  source: ${e.likely_source.file}:${e.likely_source.line_range[0]}-${e.likely_source.line_range[1]}`);
  }
  if (e.warnings.length > 0) {
    for (const w of e.warnings) lines.push(`  ⚠ ${sanitizeForTerminal(w)}`);
  }
  lines.push(`  raw: ${sanitizeForTerminal(JSON.stringify(e.raw).slice(0, 200))}`);
  return lines.join('\n');
}

function emit(payload: unknown, format: 'human' | 'json', humanFormatter: () => string): void {
  if (format === 'json') console.log(JSON.stringify(payload, null, 2));
  else console.log(humanFormatter());
}

// ──────────────────────────────────────────────────────────────────────
// trace:explain · STDIN-first · path-contained · row-selector for .jsonl
// ──────────────────────────────────────────────────────────────────────

async function readStdinBounded(): Promise<string> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of Bun.stdin.stream()) {
    total += chunk.byteLength;
    if (total > MAX_STDIN_BYTES) {
      console.error(`Error: stdin exceeded ${MAX_STDIN_BYTES} bytes — refusing to parse (Flatline IMP-001 DoS prevention)`);
      process.exit(4);
    }
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function loadFromFile(filePath: string, args: ParsedArgs): Promise<string> {
  // BB HIGH-1: realpath-canonicalize + repo-root containment
  const repoRoot = findRepoRoot();
  let canonical: string;
  try {
    canonical = realpathSync(resolve(filePath));
  } catch {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(3);
  }
  if (!canonical.startsWith(repoRoot + '/')) {
    console.error(`Error: --file path escapes repo root: ${canonical}`);
    process.exit(3);
  }

  // Red Team ATK-007 (580): strict allowlist · .run/**/*.jsonl OR test-mode fixture .json
  const relToRoot = relative(repoRoot, canonical);
  const isAllowedTraceFile = relToRoot.match(/^(apps\/bot\/)?\.run\/.*\.jsonl$/);
  const isFixture = relToRoot.endsWith('.json') && process.env.LOA_TRACE_TEST_MODE === '1';
  if (!isAllowedTraceFile && !isFixture) {
    console.error(`Error: --file must be a .run/**/*.jsonl trace file OR a .json fixture with LOA_TRACE_TEST_MODE=1`);
    console.error(`  got: ${relToRoot}`);
    process.exit(3);
  }

  const fileText = await Bun.file(canonical).text();
  if (isAllowedTraceFile) {
    // Flatline SDD SKP-001/HIGH: multi-row .jsonl requires explicit selector
    if (!args.line && !args['run-id'] && !args.latest) {
      console.error(`Error: --file on .jsonl requires row selector: --line N | --run-id Y | --latest`);
      console.error(`  example: bun run trace:explain --file .run/llm-trace.jsonl --latest`);
      process.exit(3);
    }
    const lines = fileText.split('\n').filter((l) => l.trim());
    if (args.latest) return lines[lines.length - 1]!;
    if (args.line) {
      const idx = args.line - 1; // 1-indexed
      if (idx < 0 || idx >= lines.length) {
        console.error(`Error: --line ${args.line} out of range (file has ${lines.length} lines)`);
        process.exit(3);
      }
      return lines[idx]!;
    }
    // --run-id
    const target = args['run-id']!;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { run_id?: string; id?: string };
        if ((parsed.run_id ?? parsed.id) === target) return line;
      } catch { /* skip malformed */ }
    }
    console.error(`Error: no row matching --run-id ${target} in ${relToRoot}`);
    process.exit(3);
  }
  // Fixture .json · single object
  return fileText;
}

// ──────────────────────────────────────────────────────────────────────
// Main · dispatch
// ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subcommand = args._[0];
  const format = (args.format ?? 'json') as 'human' | 'json';

  switch (subcommand) {
    case 'latest': {
      const rows = readLatest({
        zone: args.zone,
        layer: args.layer,
        limit: args.limit ?? 10,
      });
      return emit(rows, format, () => humanRows(rows));
    }
    case 'get': {
      if (!args['run-id']) {
        console.error('Error: trace:get requires --run-id Y');
        process.exit(2);
      }
      const row = readByRunId(args['run-id']);
      if (!row) {
        console.error(`Error: no row matching run-id ${args['run-id']}`);
        process.exit(3);
      }
      return emit(row, format, () => humanLine(row));
    }
    case 'layer': {
      if (!args.layer) {
        console.error('Error: trace:layer requires --layer L (substrate|voice|presentation|medium-render|orchestrator)');
        process.exit(2);
      }
      const rows = readByLayer(args.layer, { zone: args.zone, limit: args.limit ?? 10 });
      return emit(rows, format, () => humanRows(rows));
    }
    case 'voice': {
      if (!args.zone) {
        console.error('Error: trace:voice requires --zone X');
        process.exit(2);
      }
      const rows = readVoice(args.zone, { limit: args.limit ?? 10 });
      return emit(rows, format, () => humanRows(rows));
    }
    case 'explain': {
      // Flatline SKP-002: positional argument REJECTED · STDIN-first OR --file
      if (args._.length > 1) {
        console.error('Error: trace:explain reads from stdin or --file <path>. Positional arg unsupported (shell-escape risk).');
        console.error('Usage:');
        console.error('  pbpaste | bun run trace:explain');
        console.error('  bun run trace:explain --file .run/llm-trace.jsonl --latest');
        console.error('  echo "{...}" | bun run trace:explain');
        process.exit(2);
      }
      const rawJson = args.file ? await loadFromFile(args.file, args) : await readStdinBounded();
      // Flatline IMP-001: structured exit on malformed JSON
      try {
        JSON.parse(rawJson);
      } catch (e) {
        console.error(`Error: malformed JSON input: ${(e as Error).message}`);
        process.exit(5);
      }
      const explained = explainRow(rawJson);
      return emit(explained, format, () => humanExplain(explained));
    }
    case 'files': {
      // utility: list resolved trace-file paths (debugging surface)
      const paths = allTraceFilePaths();
      return emit(paths, format, () => paths.join('\n'));
    }
    default: {
      const valid = ['latest', 'get', 'layer', 'voice', 'explain', 'files'];
      console.error(`Unknown subcommand: ${subcommand ?? '(none)'}`);
      console.error(`Valid: ${valid.join(' · ')}`);
      console.error(`Example: bun run trace:latest --layer voice --limit 5 --format human`);
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error(`trace CLI failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
