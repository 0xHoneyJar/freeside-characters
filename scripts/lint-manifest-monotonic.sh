#!/usr/bin/env bash
# INV-17 · Manifest monotonic-check lint (cycle-007 S1/T1.6 · AC-RT-002 closure).
#
# Per Red Team AC-RT-002 (Phase 4.5 · 760): a contributor could open a PR that removes
# a path from `.claude/data/voice-prompt-paths.json` while introducing raw kebab ZoneId
# literals in the de-listed file. Schema-valid manifest narrowing bypasses INV-12 silently.
#
# Defense (Phase 6 SKP-001/CRITICAL · operator-attested):
#   - GitHub branch protection + CODEOWNERS required-review (operator-action · enforced at PR)
#   - This script (CI-side · enforces paths[] union monotonically non-decreasing across git
#     history on main · OR removal commits carry CODEOWNERS-approved trailer)

set -euo pipefail

MANIFEST_PATH=".claude/overrides/voice-prompt-paths.json"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "[INV-17] WARNING: $MANIFEST_PATH missing — skipping monotonic check (bootstrap state)"
  exit 0
fi

CURRENT_PATHS=$(jq -r '.paths[]' "$MANIFEST_PATH" | sort -u)

if ! git log -1 --format=%H -- "$MANIFEST_PATH" >/dev/null 2>&1; then
  echo "[INV-17] no git history for $MANIFEST_PATH yet — initial commit · skipping"
  exit 0
fi

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE_REF="origin/main"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  BASE_REF="HEAD~1"
else
  echo "[INV-17] no base ref to compare against (first commit on this branch) · skipping"
  exit 0
fi

if ! BASE_MANIFEST=$(git show "$BASE_REF:$MANIFEST_PATH" 2>/dev/null); then
  echo "[INV-17] manifest does not exist at $BASE_REF yet (new file) · skipping"
  exit 0
fi

BASE_PATHS=$(echo "$BASE_MANIFEST" | jq -r '.paths[]' 2>/dev/null | sort -u)

REMOVED=$(comm -23 <(echo "$BASE_PATHS") <(echo "$CURRENT_PATHS"))

if [[ -z "$REMOVED" ]]; then
  PATH_COUNT=$(echo "$CURRENT_PATHS" | wc -l | tr -d ' ')
  echo "[INV-17] OK manifest paths monotonic (no removals · $PATH_COUNT paths)"
  exit 0
fi

violations=0
COMMIT_MSG=$(git log -1 --format=%B HEAD)
while IFS= read -r removed_path; do
  [[ -z "$removed_path" ]] && continue
  if echo "$COMMIT_MSG" | grep -qE "^INV-17-Approved-Removal:\s*${removed_path}\s*$"; then
    echo "[INV-17] approved removal: $removed_path (commit trailer present)"
  else
    echo "[INV-17] FAIL unapproved removal: $removed_path"
    echo "[INV-17]   add commit trailer: INV-17-Approved-Removal: $removed_path"
    echo "[INV-17]   AND ensure GitHub CODEOWNERS approval before merge"
    violations=$((violations + 1))
  fi
done <<< "$REMOVED"

if [[ $violations -eq 0 ]]; then
  echo "[INV-17] OK all manifest changes properly attested"
  exit 0
else
  echo "[INV-17] FAIL $violations unapproved manifest path removal(s) · narrowing-attack risk per Red Team AC-RT-002"
  exit 1
fi
