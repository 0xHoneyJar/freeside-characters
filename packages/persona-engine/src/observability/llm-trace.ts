// cycle-006 follow-up · substrate-native LLM trace log.
//
// Every Bedrock converse call appends a JSONL row to .run/llm-trace.jsonl
// so the local dashboard (scripts/dashboard.ts) can render the conversation
// stream without depending on Raindrop Workshop or any SaaS.
//
// Append-only file · single-line JSON per entry · safe under concurrent
// writes via O_APPEND atomicity (each line fits in PIPE_BUF for typical
// digest payloads ≤ 4KB; large payloads truncated to LLM_TRACE_MAX_BYTES).

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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
    await mkdir(dirname(path), { recursive: true });
    const clean: LlmTraceEntry = {
      ...entry,
      system_prompt: truncate(entry.system_prompt, 8192),
      user_message: truncate(entry.user_message, 4096),
      output: truncate(entry.output, 4096),
    };
    const line = JSON.stringify(clean);
    // Hard cap per-line to keep dashboard parser happy under PIPE_BUF.
    const capped = line.length > LLM_TRACE_MAX_BYTES
      ? `${line.slice(0, LLM_TRACE_MAX_BYTES - 32)}"...truncated"}`
      : line;
    await appendFile(path, capped + '\n');
  } catch {
    // swallow — observability never blocks delivery
  }
}
