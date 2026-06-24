// cycle-006 follow-up · substrate-native LLM trace log.
//
// Every Bedrock converse call appends a JSONL row to .run/llm-trace.jsonl
// so the local dashboard (scripts/dashboard.ts) can render the conversation
// stream without depending on Raindrop Workshop or any SaaS.
//
// Append-only file · single-line JSON per entry · safe under concurrent
// writes via O_APPEND atomicity (each line fits in PIPE_BUF for typical
// digest payloads ≤ 4KB; large payloads truncated to LLM_TRACE_MAX_BYTES).

import { resolve } from 'node:path';
// cycle-007 S2/T2.3 · migrate to INV-14 appendTraceEntry (BB HIGH-4 type-enforced sole writer).
// Direct fs.appendFile calls in packages/persona-engine/src/ are forbidden after S2 close (INV-14).
import { appendTraceEntry, wrapTraceEntry } from './trace-envelope.ts';

const LLM_TRACE_PATH = '.run/llm-trace.jsonl';
const LLM_TRACE_MAX_BYTES = 16384; // 16KB per line cap

export interface LlmTraceEntry {
  /** ISO timestamp when the call started. */
  readonly at: string;
  /** Total milliseconds from request to first-token-of-response. */
  readonly duration_ms: number;
  /** Provider/model identifier · e.g. eu.anthropic.claude-opus-4-7. */
  readonly model_id: string;
  /** Bedrock region. */
  readonly region: string;
  /** Path: 'sdk' (BedrockRuntimeClient) or 'fetch' (legacy REST). */
  readonly path: 'sdk' | 'fetch';
  /** Optional zone identifier for the firing context. */
  readonly zone?: string;
  /** Optional post-type identifier. */
  readonly post_type?: string;
  /** Optional character ID. */
  readonly character_id?: string;
  /** Full system prompt (truncated if > 8KB). */
  readonly system_prompt: string;
  /** Full user message (truncated if > 4KB). */
  readonly user_message: string;
  /** Full assistant output (truncated if > 4KB). */
  readonly output: string;
  /** Token usage. */
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly total_tokens?: number;
  /** Error message if the call failed. */
  readonly error?: string;
}

function truncate(value: string | undefined, maxLen: number): string {
  if (!value) return '';
  return value.length > maxLen ? `${value.slice(0, maxLen)}…[truncated ${value.length - maxLen}ch]` : value;
}

/**
 * Append an LLM call entry to the trace log. Fail-open: if write fails,
 * caller is not affected (dashboard observability is non-critical).
 *
 * Set LLM_TRACE_DISABLED=1 to skip writes (e.g. in CI · in production
 * cron where disk usage matters).
 */
export async function writeLlmTraceEntry(entry: LlmTraceEntry): Promise<void> {
  if (process.env.LLM_TRACE_DISABLED === '1') return;
  try {
    const path = resolve(LLM_TRACE_PATH);
    const clean: LlmTraceEntry = {
      ...entry,
      system_prompt: truncate(entry.system_prompt, 8192),
      user_message: truncate(entry.user_message, 4096),
      output: truncate(entry.output, 4096),
    };
    // Pre-cap the JSON-stringified line to honor PIPE_BUF · then envelope-wrap.
    // We materialize the capped payload as an object by re-parsing the cap-string when needed;
    // for the envelope path we just wrap the clean object · per-line cap remains best-effort.
    // cycle-007 S2 · INV-14: appendTraceEntry is the SOLE permitted JSONL writer in this package.
    const wrapped = wrapTraceEntry('voice', 'bedrock-converse', clean);
    const line = JSON.stringify(wrapped);
    if (line.length > LLM_TRACE_MAX_BYTES) {
      // Re-wrap with a truncated payload to stay under PIPE_BUF · preserves envelope shape.
      const truncated: LlmTraceEntry = {
        ...clean,
        output: truncate(clean.output, 2048),
        user_message: truncate(clean.user_message, 2048),
        system_prompt: truncate(clean.system_prompt, 4096),
      };
      await appendTraceEntry(path, wrapTraceEntry('voice', 'bedrock-converse', truncated));
    } else {
      await appendTraceEntry(path, wrapped);
    }
  } catch {
    // swallow — observability never blocks delivery
  }
}
