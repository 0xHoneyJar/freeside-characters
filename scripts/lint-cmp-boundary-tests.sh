#!/usr/bin/env bash
# lint-cmp-boundary-tests.sh — verify per-persona cmp-boundary regression guard
#
# Each apps/character-<id>/ directory MUST ship its own cmp-boundary.test.ts.
# Per cycle-r-cmp-boundary-architecture sprint 1 (R1.8 · architect lock A4 ·
# G-5 acceptance criterion). The test ensures voice-discipline transforms
# fire correctly for that persona's voice, catching future drift in the
# same class as the 6 fixes shipped 2026-05-04.
#
# Exit codes:
#   0 — all character apps have cmp-boundary.test.ts
#   1 — one or more character apps missing the test file
#   2 — script invocation error (no apps/character-* dirs found)
#
# Usage:
#   ./scripts/lint-cmp-boundary-tests.sh
#   bun run lint:cmp-boundary  # if wired into package.json
#
# CI wiring: operator-paced. When freeside-characters adopts GitHub Actions,
# add this script as a step in the typecheck/lint workflow:
#
#   - name: Per-persona cmp-boundary regression guard
#     run: ./scripts/lint-cmp-boundary-tests.sh
#
# Refs:
#   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §5 q3
#   grimoires/loa/sprint.md R1.8 · grimoires/loa/sdd.md A4

set -euo pipefail

# Resolve repo root (script lives at <repo>/scripts/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="${REPO_ROOT}/apps"

# Find all character apps (apps/character-*)
character_apps=()
while IFS= read -r dir; do
  character_apps+=("$dir")
done < <(find "${APPS_DIR}" -maxdepth 1 -type d -name "character-*" 2>/dev/null | sort)

if [[ ${#character_apps[@]} -eq 0 ]]; then
  echo "ERROR: no apps/character-* directories found at ${APPS_DIR}" >&2
  exit 2
fi

echo "Found ${#character_apps[@]} character app(s):"
printf '  %s\n' "${character_apps[@]##*/}"
echo

# Check each for cmp-boundary.test.ts
missing=()
for app in "${character_apps[@]}"; do
  test_file="${app}/cmp-boundary.test.ts"
  app_name="${app##*/}"
  if [[ -f "${test_file}" ]]; then
    echo "  ✓ ${app_name} has cmp-boundary.test.ts"
  else
    echo "  ✗ ${app_name} MISSING cmp-boundary.test.ts" >&2
    missing+=("${app_name}")
  fi
done

echo

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: ${#missing[@]} character app(s) missing cmp-boundary.test.ts:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo >&2
  echo "Each character app MUST ship its own per-persona regression guard" >&2
  echo "covering voice-discipline transforms. See:" >&2
  echo "  apps/character-ruggy/cmp-boundary.test.ts (reference impl)" >&2
  echo "  apps/character-satoshi/cmp-boundary.test.ts (reference impl)" >&2
  exit 1
fi

echo "All character apps have cmp-boundary.test.ts ✓"
exit 0
