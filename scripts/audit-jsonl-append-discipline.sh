#!/usr/bin/env bash
# INV-14 · JSONL append-discipline audit (cycle-007 S2/T2.4 · BB HIGH-4 closure).
#
# Per BB design review HIGH-4 (Phase 3.5): the trace envelope must be enforced as the
# SOLE writer for JSONL files in packages/persona-engine/src/ to close the "enforced by
# vigilance" gap. Type-system enforces at compile (T & TraceEnvelope signature) · this
# script is defense-in-depth at the lexical layer.
#
# Per Phase 6 Flatline SKP-001/HIGH (720): grep alone cannot catch every bypass class
# (aliasing · dynamic-path construction · runtime imports). Audit catches simple bypasses ·
# code-review + the type system are the primary defenses.
#
# Patterns detected (in packages/persona-engine/src/ excluding observability/trace-envelope.ts):
#   1. appendFile(...) / appendFileSync(...) on a .jsonl literal path
#   2. writeFile(...) / writeFileSync(...) on a .jsonl literal path
#   3. createWriteStream(...) on a .jsonl literal path
#   4. Bun.write(...) on a .jsonl literal path with { append: true }
#
# Known limitations (operator-accepted per Phase 6 SKP-001 discussion):
#   - Dynamic path construction NOT caught
#   - Aliased imports NOT caught
#   Caught by code review + the type system's T & TraceEnvelope contract.

set -euo pipefail

ROOT="packages/persona-engine/src"
ALLOWED_FILE="packages/persona-engine/src/observability/trace-envelope.ts"

violations=0

PATTERN_ASYNC='appendFile\([^)]*\.jsonl|writeFile\([^)]*\.jsonl|createWriteStream\([^)]*\.jsonl|Bun\.write\([^)]*\.jsonl.*append'
PATTERN_SYNC='appendFileSync\([^)]*\.jsonl|writeFileSync\([^)]*\.jsonl'

while IFS= read -r line; do
  file="${line%%:*}"
  [[ "$file" == "$ALLOWED_FILE" ]] && continue
  [[ "$file" == *.test.ts || "$file" == *.spec.ts ]] && continue
  echo "[INV-14] violation: $line"
  violations=$((violations + 1))
done < <(grep -RnE "$PATTERN_ASYNC|$PATTERN_SYNC" "$ROOT" 2>/dev/null || true)

if [[ $violations -eq 0 ]]; then
  echo "[INV-14] OK packages/persona-engine/src/ uses appendTraceEntry as sole JSONL writer"
  exit 0
fi

echo "[INV-14] FAIL $violations violation(s) · use appendTraceEntry + wrapTraceEntry from observability/trace-envelope.ts"
exit 1
