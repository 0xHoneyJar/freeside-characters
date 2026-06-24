# trace CLI · agent-first trace surface

The cycle-007 `bun run trace:*` commands give agents (and operators) first-class CLI access to trace data without the HTTP dashboard. Use for debugging from chat-paste workflows · log triage · cross-layer audit.

```
trace:latest [--zone X] [--layer L] [--limit N] [--format human|json]
trace:get --run-id Y [--format human|json]
trace:layer --layer L [--zone X] [--limit N] [--format human|json]
trace:voice --zone X [--limit N] [--format human|json]
trace:explain [--file PATH --line N|--run-id Y|--latest] [--format human|json]
```

## Quick reference

```bash
# Most-recent 10 trace rows across all freeside-characters trace files
bun run trace:latest --format human

# Filter to voice layer · last 5
bun run trace:layer --layer voice --limit 5 --format human

# Find a specific run by ID
bun run trace:get --run-id abc-123

# Voice trace for one zone (prompt + response + tokens)
bun run trace:voice --zone el-dorado --limit 3 --format human

# Paste-to-Loa workflow (THE killer feature):
pbpaste | bun run trace:explain --format human

# Explain a row from an actual trace file
bun run trace:explain --file apps/bot/.run/llm-trace.jsonl --latest
bun run trace:explain --file apps/bot/.run/llm-trace.jsonl --line 42
```

## The paste-to-Loa workflow (cycle-007 force function)

1. Operator sees a buggy post in Discord OR a weird row in the dashboard at `localhost:3001`
2. Operator copies the JSON row (right-click → copy in dashboard · or grep the JSONL file)
3. Operator pastes to Loa via chat: `pbpaste | bun run trace:explain --format json`
4. Loa receives structured output naming the producing LAYER + likely FILE:LINE
5. Loa edits the right file in one inference step · no grep-around · no guessing

For pre-cycle-007 legacy rows (no envelope), the CLI uses shape-inference heuristics. Output includes a `warnings` field naming `row-predates-envelope · layer inferred from shape` so operators know the confidence level.

## Output format

JSON output (the default) conforms to v1 schema FROZEN at `.claude/overrides/trace-explain-output.schema.json` (INV-13 · Flatline IMP-003). Downstream consumers (Loa chat · E2E tests · future tooling) lock against this contract.

```json
{
  "schema_version": "1",
  "identified_layer": "voice",
  "identified_op": "bedrock-converse",
  "likely_source": {
    "file": "packages/persona-engine/src/observability/llm-trace.ts",
    "line_range": [60, 100]
  },
  "raw": { "...original row..." },
  "warnings": []
}
```

Human output uses inline glyphs · NO ANSI color unless TTY-detected and `NO_COLOR` env unset (safe to `pbcopy` into chat without color-code mangling). Glyphs: `▣ substrate · ◈ voice · ◆ presentation · ▶ medium-render · ♦ orchestrator · ? unknown`.

## Security model

`trace:explain --file PATH` enforces:
- **realpath canonicalization** + repo-root containment (BB HIGH-1)
- **strict allowlist**: paths must match `(apps/bot/)?\.run/.*\.jsonl` OR `*.json` fixture with `LOA_TRACE_TEST_MODE=1` (Red Team ATK-007 quick-fix)
- **explicit row selector** required for `.jsonl` files: `--line N | --run-id Y | --latest` (Flatline SDD SKP-001/HIGH)

STDIN input enforces:
- **1MB byte-count cap** (streaming reader · Flatline IMP-001 · prevents memory exhaustion)
- **malformed JSON exits 5** with structured error

Positional arg is REJECTED with usage error (Flatline SKP-002 · shell-quoting risk).

Human output passes payload strings through `sanitizeForTerminal` (strips C0/C1 control bytes + rewrites OSC 8 hyperlinks as plain `[url]` suffixes) · defends against CVE-2003-0063 terminal-escape injection class (Red Team AC-RT-003 · INV-18).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Unexpected error (logged to stderr) |
| 2 | Bad CLI usage (unknown subcommand · missing required arg) |
| 3 | File error (not found · escapes repo root · not in allowlist · no row matches selector) |
| 4 | STDIN exceeded 1MB cap (DoS prevention) |
| 5 | Malformed JSON input |

## Trace file coverage

The CLI reads from these freeside-characters-owned trace files (Flatline PRD SKP-001/CRITICAL allowlist):

| File | Layer | Producer |
|---|---|---|
| `apps/bot/.run/llm-trace.jsonl` | voice | `compose/agent-gateway.ts → observability/llm-trace.ts` |
| `apps/bot/.run/voice-memory/<stream>/*.jsonl` | voice | `live/voice-memory.live.ts::appendEntry` |
| `apps/bot/.run/voice-memory-deletions.jsonl` | voice | `live/voice-memory.live.ts::forgetUser` |
| `apps/bot/.run/score-snapshot-rejections.jsonl` | substrate | `live/score-snapshot-rejections.ts::recordRejection` |
| `apps/bot/.run/sanitize-violations.jsonl` | presentation | `deliver/sanitize.ts::stripVoiceDisciplineDrift` (cycle-007 S6) |

Loa-framework-owned `.run/audit.jsonl` is EXCLUDED from this allowlist.

## Operational notes

- **Reader latency** scales with total trace file size. After ~3 months of digest cron + slash command interactions, `voice-memory/**/*.jsonl` may reach 100s of MB; first invocation latency ~200-500ms (cold cache). V2 follow-up: incremental `.run/trace-index.jsonl` for O(1) lookups.
- **Forward-only envelope**: cycle-006 traces remain raw. Readers tolerate this and return `layer: 'unknown'` with a `warnings` entry. cycle-007 onwards all rows carry the envelope per INV-14 (type-enforced via `appendTraceEntry`).
- **Mutex serialization**: `appendTraceEntry` uses an in-memory promise chain · concurrent async writes within process serialize · NOT a file lock · multi-process writes UNSUPPORTED.
