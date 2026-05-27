#!/usr/bin/env bash
# fixup-events-bun.sh — Bun-specific companion to rebuild-events-dist.sh.
#
# WHY THIS EXISTS:
#   The verbatim rebuild-events-dist.sh template (from
#   loa-freeside/packages/events/scripts/) was designed for pnpm's
#   hoisted-flat layout where `node_modules/@0xhoneyjar/events` resolves
#   to the events SUBDIR of the loa-freeside monorepo. Under bun, git-URL
#   deps pointing at a monorepo (e.g. github:0xHoneyJar/loa-freeside#SHA)
#   resolve to the monorepo ROOT — whose package.json has
#   `name: "loa-freeside"`, NOT `name: "@0xhoneyjar/events"`. The import
#   `@0xhoneyjar/events` therefore fails to resolve.
#
# WHAT THIS SCRIPT DOES:
#   1. Find every bun-installed copy of the loa-freeside monorepo
#      (workspace-pkg node_modules under packages/*/node_modules/@0xhoneyjar/).
#   2. For each, replace the wrong symlink that points at the monorepo root
#      with a NEW symlink that points at the `packages/events/` SUBDIR
#      (which has the correct `name: "@0xhoneyjar/events"` + exports map).
#   3. The verbatim rebuild-events-dist.sh handles building the dist
#      separately — this script ONLY handles the bun symlink fixup.
#
# WHY NOT MODIFY THE VERBATIM TEMPLATE:
#   The template is the cluster-canonical artifact. The bun quirk is
#   consumer-specific (freeside-characters is bun-only). Keeping the
#   template verbatim lets future cells (vitest/pnpm/yarn) consume it
#   unchanged. The fixup is the local concession.
#
# IDEMPOTENT: re-running is a no-op when the symlink already points at
# the right subdir.

set -euo pipefail

ROOT_DIR=$(pwd -P)
TAG="[fixup-events-bun]"

# Find every bun-installed events symlink under the workspace
mapfile -t SYMLINKS < <(find "$ROOT_DIR" -type l -path "*/node_modules/@0xhoneyjar/events" 2>/dev/null || true)

if [[ ${#SYMLINKS[@]} -eq 0 ]]; then
  echo "$TAG No @0xhoneyjar/events symlinks found under $ROOT_DIR/**/node_modules — nothing to fix up"
  exit 0
fi

fixup_count=0
for link in ${SYMLINKS[@]+"${SYMLINKS[@]}"}; do
  # Resolve the current symlink target (where bun put it)
  current_target=$(readlink "$link")
  abs_target=$(cd "$(dirname "$link")" && cd "$current_target" 2>/dev/null && pwd -P || echo "")
  if [[ -z "$abs_target" ]]; then
    echo "$TAG WARNING: $link points at a missing target — skipping"
    continue
  fi

  # Check if this is already pointing at the subdir (idempotent path)
  if [[ -f "$abs_target/package.json" ]]; then
    name=$(node -e "try { console.log(require('$abs_target/package.json').name || '') } catch { console.log('') }" 2>/dev/null || echo "")
    if [[ "$name" == "@0xhoneyjar/events" ]]; then
      # Already pointing at the right place
      continue
    fi
  fi

  # Verify the subdir exists in the resolved monorepo root
  subdir="$abs_target/packages/events"
  if [[ ! -f "$subdir/package.json" ]]; then
    echo "$TAG WARNING: $abs_target/packages/events/package.json not found — cannot fix up $link"
    continue
  fi

  # Re-link to the subdir. Compute a relative path so the link survives
  # filesystem moves.
  link_dir=$(dirname "$link")
  rel_subdir=$(node -e "console.log(require('path').relative('$link_dir', '$subdir'))" 2>/dev/null || echo "")
  if [[ -z "$rel_subdir" ]]; then
    echo "$TAG WARNING: failed to compute relative path for $link → $subdir"
    continue
  fi

  rm -f "$link"
  ln -s "$rel_subdir" "$link"
  echo "$TAG Fixed up $link → $rel_subdir"
  fixup_count=$((fixup_count + 1))
done

if [[ $fixup_count -gt 0 ]]; then
  echo "$TAG Fixed up $fixup_count @0xhoneyjar/events symlink(s) to point at packages/events/ subdir"
fi
