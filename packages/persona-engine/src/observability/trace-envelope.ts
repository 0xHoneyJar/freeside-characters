/**
 * Trace envelope · cycle-007 S2/T2.1.
 *
 * Type-enforced wrapper for every JSONL trace write in packages/persona-engine/src/.
 * Forward-only · cycle-006 traces remain raw · readers tolerate absent fields.
 *
 * Quality-gate provenance:
 * - BB HIGH-4 (Phase 3.5): INV-14 type-enforced sole-writer · appendTraceEntry signature
 *   requires `T & TraceEnvelope` · only values produced by wrapTraceEntry compile against it.
 * - Red Team AC-RT-005 + INV-15 (Phase 4.5 · 420 quick-fix): sanitizeNestedReservedKeys
 *   recursively renames attacker-controlled nested `layer` / `layer_op` / `emitted_at` keys
 *   to `payload_*` prefix · prevents JSON-path-walking readers from being spoofed.
 * - Flatline SDD IMP-003 (Phase 4 · 795): documented semantics · best-effort · no fsync ·
 *   no file locking · single-process invariant (matches cycle-006 voice-memory mutex pattern).
 * - Flatline sprint SKP-003 (Phase 6 · 720): in-memory promise-chain mutex serializes
 *   concurrent async writes within process · guarantees atomic line appends · NOT a file lock.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const TRACE_LAYERS = [
  'substrate',
  'voice',
  'presentation',
  'medium-render',
  'orchestrator',
] as const;

export type TraceLayer = (typeof TRACE_LAYERS)[number];

export interface TraceEnvelope {
  readonly layer: TraceLayer;
  readonly layer_op: string; // e.g. 'bedrock-converse' · 'memory-write' · 'snapshot-rejection'
  readonly emitted_at: string; // ISO 8601
}

const RESERVED_KEYS = new Set<string>(['layer', 'layer_op', 'emitted_at']);
const MAX_SANITIZE_DEPTH = 32; // bound recursion (defense against JSON-bomb-style nesting · ATK-008 V2 deferred)

/**
 * INV-15 · recursively rename nested reserved keys (`layer` / `layer_op` / `emitted_at`)
 * to `payload_*` prefix · skips top-level (envelope authority owns top-level).
 *
 * Defends against payloads containing nested objects like `{metadata: {layer: 'orchestrator'}}`
 * from biasing downstream JSON-path-walking readers / analytics.
 */
function sanitizeNestedReservedKeys<T>(value: T, depth = 0): T {
  if (depth >= MAX_SANITIZE_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeNestedReservedKeys(v, depth + 1)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const safeKey = depth > 0 && RESERVED_KEYS.has(k) ? `payload_${k}` : k;
      out[safeKey] = sanitizeNestedReservedKeys(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/**
 * Wrap a payload in the trace envelope. Spread order: payload FIRST, envelope LAST · so
 * envelope fields ALWAYS override attacker-controlled top-level keys of the same name.
 *
 * Nested reserved keys are sanitized recursively (INV-15 · AC-RT-005).
 */
export function wrapTraceEntry<T>(
  layer: TraceLayer,
  layer_op: string,
  payload: T,
): T & TraceEnvelope {
  const sanitized = sanitizeNestedReservedKeys(payload);
  return {
    ...sanitized,
    layer,
    layer_op,
    emitted_at: new Date().toISOString(),
  };
}

/** Type guard for envelope presence (readers tolerate absent fields on legacy rows · IMP-012). */
export function isTraceEnvelope(value: unknown): value is TraceEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'layer' in value &&
    TRACE_LAYERS.includes((value as TraceEnvelope).layer) &&
    'layer_op' in value &&
    typeof (value as TraceEnvelope).layer_op === 'string' &&
    'emitted_at' in value &&
    typeof (value as TraceEnvelope).emitted_at === 'string'
  );
}

// ──────────────────────────────────────────────────────────────────────
// INV-14 · type-enforced sole-writer (BB HIGH-4)
// ──────────────────────────────────────────────────────────────────────

/**
 * Process-local promise chain · serializes async writes (Flatline sprint SKP-003 · 720).
 * NOT a file lock · multi-process writes still UNSUPPORTED · single-process invariant.
 *
 * Guarantees atomic line appends within process · even when multiple in-flight digests
 * trigger concurrent trace writes (each waits for prior to complete).
 */
let writeChain: Promise<void> = Promise.resolve();

/**
 * INV-14 · SOLE permitted JSONL append helper in packages/persona-engine/src/.
 *
 * Type signature requires `T & TraceEnvelope` · only values produced by wrapTraceEntry
 * compile against this surface (BB HIGH-4 · compile-time enforcement of INV-4).
 *
 * Semantics (Flatline IMP-003):
 *  - Best-effort write · no fsync · OS buffer is the durability boundary
 *  - In-memory mutex serializes within-process writes (Flatline SKP-003)
 *  - Multi-process writes UNSUPPORTED · would interleave bytes mid-line
 *  - On write failure: caller MAY retry · helper does not auto-retry · errors propagate
 *  - On disk-full / permission: caller logs · does NOT crash parent process
 */
export async function appendTraceEntry<T extends TraceEnvelope>(
  filePath: string,
  entry: T,
): Promise<void> {
  const line = JSON.stringify(entry) + '\n';
  // Chain onto the global write-chain · serializes concurrent appends.
  const next = writeChain.then(async () => {
    await mkdir(dirname(filePath), { recursive: true }).catch(() => {});
    await appendFile(filePath, line);
  });
  // Swallow errors in the chain itself so subsequent writes don't cascade-fail.
  writeChain = next.catch(() => {});
  return next;
}
