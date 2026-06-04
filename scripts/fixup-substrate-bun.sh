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

# The cycle-canonical @0xhoneyjar/events pin (must match
# apps/bot/src/shadow/substrate-conformance.ts::CANONICAL_EVENTS_PIN and the
# bot + persona-engine + substrate package.json events deps). The substrate's
# transitive events copy is linked DETERMINISTICALLY to the build matching this
# pin (F3 remediation) — never to whichever copy `find` happens to surface first,
# because ACVP canonicalization identity (JCS+sha256 + hash-chain) is load-bearing
# and a non-deterministic link is a latent canonicalization fork.
CANONICAL_EVENTS_PIN="68f5a89cb02c6b3ddf5ab14a1d65753bc02bd9fe"
CANONICAL_EVENTS_PIN_SHORT="${CANONICAL_EVENTS_PIN:0:7}"

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

# Resolve the hoisted @0xhoneyjar/events copy to share with the substrate.
#
# DETERMINISTIC SELECTION (F3 remediation): the prior loop `break`ed on the FIRST
# events copy `find` surfaced, which is filesystem-order-dependent and
# non-deterministic when more than one events build is present in the tree. ACVP
# canonicalization identity (JCS+sha256 + the hash-chained audit) lives or dies by
# binding the SAME events build everywhere in-process, so a coin-flip link is a
# latent canonicalization fork. We instead select ONLY the copy whose resolved
# bun-store path matches CANONICAL_EVENTS_PIN, and FAIL LOUD if no matching copy
# exists (a wrong/missing pin is a hard build failure, not a silent first-pick).
#
# (With the workspace unified on CANONICAL_EVENTS_PIN there is one events build;
# this match-the-invariant guard remains as defense-in-depth so any future skew
# fails loudly here rather than silently linking the wrong copy.)
EVENTS_SRC=""
EVENTS_CANDIDATES_SEEN=0
while IFS= read -r cand; do
  [[ -z "$cand" ]] && continue
  target="$(cd "$(dirname "$cand")" && readlink "$(basename "$cand")" 2>/dev/null || true)"
  abs="$(cd "$(dirname "$cand")" 2>/dev/null && cd "$(dirname "$target")" 2>/dev/null && pwd -P)/$(basename "$target")" || true
  [[ -n "${abs:-}" && "$(pkg_name "$abs")" == "@0xhoneyjar/events" ]] || continue
  EVENTS_CANDIDATES_SEEN=$((EVENTS_CANDIDATES_SEEN+1))
  # The bun store path encodes the resolved git SHA, e.g.
  #   …/node_modules/.bun/loa-freeside@github+0xHoneyJar+loa-freeside+68f5a89/…
  # Match the invariant (the canonical pin's abbreviated SHA) — NOT find order.
  if [[ "$abs" == *"loa-freeside+${CANONICAL_EVENTS_PIN_SHORT}"* ]]; then
    EVENTS_SRC="$abs"
    break
  fi
done < <(find "$ROOT_DIR" -type l -path "*/node_modules/@0xhoneyjar/events" 2>/dev/null || true)

if [[ -z "$EVENTS_SRC" && "$EVENTS_CANDIDATES_SEEN" -gt 0 ]]; then
  echo "$TAG ERROR: found ${EVENTS_CANDIDATES_SEEN} @0xhoneyjar/events copy/copies but NONE resolves to the canonical pin ${CANONICAL_EVENTS_PIN_SHORT} (loa-freeside+${CANONICAL_EVENTS_PIN_SHORT}). The substrate's transitive events copy MUST bind the canonical build — refusing to link a non-canonical events copy (ACVP canonicalization identity is load-bearing). Re-pin @0xhoneyjar/events to ${CANONICAL_EVENTS_PIN} across the workspace and re-run bun install." >&2
  exit 1
fi

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
    # Use bun (guaranteed present — it runs this postinstall) for the relpath; the
    # Railway oven/bun build image has NO python3 (postinstall exited 127 → build
    # failed, blocking every deploy since the substrate fixup landed). bun's
    # path.relative is byte-identical to python os.path.relpath here.
    rel="$(SUBDIR="$subdir" LINKDIR="$link_dir" bun -e 'console.log(require("path").relative(process.env.LINKDIR, process.env.SUBDIR))')"
    ln -s "$rel" "$link"
    echo "$TAG linked shadow-substrate -> $rel"
    fixed=$((fixed+1))
  fi

  # Materialize the substrate's transitive @0xhoneyjar/events so its
  # roleMapVersionHash import resolves (bun did not install the subpackage's deps).
  # We bind it to EXACTLY the canonical-pin copy resolved above (F3/F4): the
  # idempotency check compares the substrate's current events target against the
  # canonical EVENTS_SRC — NOT merely "is it some @0xhoneyjar/events". A pre-cycle
  # link at a NON-canonical events build (e.g. a stale 56585fd) is re-pointed to
  # the canonical build, so the substrate's hash-chain/JCS path can never diverge
  # from the bot's.
  if [[ -n "$EVENTS_SRC" ]]; then
    sub_nm="$subdir/node_modules/@0xhoneyjar"
    sub_events="$sub_nm/events"
    sub_events_real="$(cd "$sub_nm" 2>/dev/null && cd "$(readlink events 2>/dev/null)" 2>/dev/null && pwd -P)" || true
    if [[ "${sub_events_real:-/nonexistent}" != "$EVENTS_SRC" ]]; then
      mkdir -p "$sub_nm"
      rm -rf "$sub_events"
      rel_ev="$(SUBDIR="$EVENTS_SRC" LINKDIR="$sub_nm" bun -e 'console.log(require("path").relative(process.env.LINKDIR, process.env.SUBDIR))')"
      ln -s "$rel_ev" "$sub_events"
      echo "$TAG linked substrate @0xhoneyjar/events -> $rel_ev (canonical ${CANONICAL_EVENTS_PIN_SHORT})"
      fixed=$((fixed+1))
    fi
  else
    echo "$TAG WARNING: no hoisted @0xhoneyjar/events found to share with the substrate" >&2
  fi
done

echo "$TAG done (${fixed} symlink fix(es))"
