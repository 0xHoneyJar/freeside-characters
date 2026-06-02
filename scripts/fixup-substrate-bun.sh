#!/usr/bin/env bash
# fixup-substrate-bun.sh — Bun companion for the
# `@freeside-worlds/shadow-substrate` git-source dependency (Sprint 405 / S4).
#
# WHY THIS EXISTS
# ───────────────
# `freeside-characters` consumes `@freeside-worlds/shadow-substrate` GIT-SOURCE,
# away from npm (sovereign-distribution doctrine), via a
# `github:0xHoneyJar/freeside-worlds#<sha>` dep. That URL points at the
# freeside-worlds MONOREPO ROOT, whose package.json is `name: "freeside-worlds"`
# — NOT `@freeside-worlds/shadow-substrate`. Under bun the alias symlink
# (`node_modules/@freeside-worlds/shadow-substrate`) therefore lands on the
# monorepo ROOT, which has no usable `@freeside-worlds/shadow-substrate`
# entrypoint. The real package lives in `packages/shadow-substrate/` (correct
# `name` + `exports` map). This is the SAME monorepo-subpath problem
# `scripts/fixup-events-bun.sh` solves for the `@0xhoneyjar/events` transitive
# dep, and the same one the dashboard's `fixup-substrate-pnpm.mjs` solves for
# pnpm.
#
# WHAT THIS SCRIPT DOES (TWO re-points):
#   1. node_modules/@freeside-worlds/shadow-substrate → the monorepo's
#      `packages/shadow-substrate/` subdir (the real package). bun consumes the
#      substrate's RAW `.ts` exports map directly (NO dist build needed — unlike
#      the dashboard's Turbopack path; bun reads raw TS exactly as it does for
#      `@0xhoneyjar/events`).
#   2. The substrate's OWN transitive `@0xhoneyjar/events` dep. bun installs the
#      monorepo as one opaque package and does NOT process the subpackage's
#      deps, so the substrate's `@0xhoneyjar/events` import would not resolve.
#      We materialize a `node_modules/@0xhoneyjar/` alongside the substrate
#      pointing at the SAME hoisted events copy persona-engine uses (the events
#      JCS+sha256 is byte-deterministic across the pinned SHAs — the
#      conformance:check (assertion 3) proves the substrate's
#      roleMapVersionHash still reproduces CANONICAL_VERSION_HASH).
#
# IDEMPOTENT: re-running is a no-op when the symlinks already point right.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TAG="[fixup-substrate-bun]"

pkg_name() {
  # echo the `name` field of <dir>/package.json (empty on failure)
  local dir="$1"
  [[ -f "$dir/package.json" ]] || { echo ""; return; }
  bun -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name??"")}catch{process.stdout.write("")}' "$dir/package.json" 2>/dev/null || echo ""
}

# Find every bun-installed alias symlink for the substrate (one per workspace
# pkg that declares the dep — here: apps/bot).
mapfile -t SUB_LINKS < <(find "$ROOT_DIR" -type l -path "*/node_modules/@freeside-worlds/shadow-substrate" 2>/dev/null || true)

if [[ ${#SUB_LINKS[@]} -eq 0 ]]; then
  echo "$TAG no @freeside-worlds/shadow-substrate alias under node_modules — nothing to fix up"
  exit 0
fi

# Resolve a hoisted @0xhoneyjar/events copy to share with the substrate. Prefer
# the persona-engine workspace copy (already fixed up by fixup-events-bun.sh).
EVENTS_SRC=""
while IFS= read -r cand; do
  [[ -z "$cand" ]] && continue
  target="$(cd "$(dirname "$cand")" && readlink "$(basename "$cand")" 2>/dev/null || true)"
  abs="$(cd "$(dirname "$cand")" 2>/dev/null && cd "$(dirname "$target")" 2>/dev/null && pwd -P)/$(basename "$target")" || true
  if [[ -n "${abs:-}" && "$(pkg_name "$abs")" == "@0xhoneyjar/events" ]]; then
    EVENTS_SRC="$abs"
    break
  fi
done < <(find "$ROOT_DIR" -type l -path "*/node_modules/@0xhoneyjar/events" 2>/dev/null || true)

fixed=0
for link in "${SUB_LINKS[@]}"; do
  link_dir="$(dirname "$link")"          # …/node_modules/@freeside-worlds
  cur="$(cd "$link_dir" && readlink "$(basename "$link")" 2>/dev/null || true)"
  # Absolute path the alias currently resolves to.
  cur_abs="$(cd "$link_dir" 2>/dev/null && cd "$(dirname "$cur")" 2>/dev/null && pwd -P)/$(basename "$cur")" || true

  # Already correct?
  if [[ -n "${cur_abs:-}" && "$(pkg_name "$cur_abs")" == "@freeside-worlds/shadow-substrate" ]]; then
    subdir="$cur_abs"
  else
    # The alias points at the monorepo root; the real pkg is packages/shadow-substrate.
    subdir="$cur_abs/packages/shadow-substrate"
    if [[ ! -f "$subdir/package.json" ]]; then
      echo "$TAG WARNING: $subdir/package.json not found — skipping $link" >&2
      continue
    fi
    if [[ "$(pkg_name "$subdir")" != "@freeside-worlds/shadow-substrate" ]]; then
      echo "$TAG WARNING: $subdir is not @freeside-worlds/shadow-substrate — skipping $link" >&2
      continue
    fi
    rm -rf "$link"
    # Relative symlink: @freeside-worlds/shadow-substrate → …/packages/shadow-substrate
    rel="$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1], sys.argv[2]))' "$subdir" "$link_dir")"
    ln -s "$rel" "$link"
    echo "$TAG linked shadow-substrate -> $rel"
    fixed=$((fixed+1))
  fi

  # Materialize the substrate's transitive @0xhoneyjar/events so its
  # roleMapVersionHash import resolves (bun did not install the subpackage's deps).
  if [[ -n "$EVENTS_SRC" ]]; then
    sub_nm="$subdir/node_modules/@0xhoneyjar"
    sub_events="$sub_nm/events"
    sub_events_real="$(cd "$sub_nm" 2>/dev/null && cd "$(readlink events 2>/dev/null)" 2>/dev/null && pwd -P)" || true
    if [[ "$(pkg_name "${sub_events_real:-/nonexistent}")" != "@0xhoneyjar/events" ]]; then
      mkdir -p "$sub_nm"
      rm -rf "$sub_events"
      rel_ev="$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1], sys.argv[2]))' "$EVENTS_SRC" "$sub_nm")"
      ln -s "$rel_ev" "$sub_events"
      echo "$TAG linked substrate @0xhoneyjar/events -> $rel_ev"
      fixed=$((fixed+1))
    fi
  else
    echo "$TAG WARNING: no hoisted @0xhoneyjar/events found to share with the substrate" >&2
  fi
done

echo "$TAG done (${fixed} symlink fix(es))"
