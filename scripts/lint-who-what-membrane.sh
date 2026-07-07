#!/usr/bin/env bash
# WHO×WHAT membrane guard — the immune cell for the boundary the operator named
# 2026-07-06: "characters isn't applied to the CM data focused surface."
#
# The voiceless CM-data / ops surface (the WHAT axis) must NEVER import the
# character VOICE layer (the WHO axis). This is a MEMBRANE, not a MOAT: it
# enforces the seam IN PLACE — no repo split, no microservice, no distributed
# tax. The clean membrane is a free option on a future extraction; this guard
# keeps it clean so that option stays free.
#
# Sibling of `lint:seam` (audit-substrate-presentation-seam.sh) — same idiom,
# different boundary. NOT yet CI-wired by design. Run it directly:
#     bash scripts/lint-who-what-membrane.sh
# To give it teeth, add `lint:membrane` to package.json + ci.yml. See
# docs/LAYERING.md for the why.

set -euo pipefail

# The voiceless CM-data / ops surface (WHAT axis).
OPS_DIRS=(
  "apps/bot/src/shadow"
  "apps/bot/src/verify"
  "packages/persona-engine/src/onboarding"
)

# The character VOICE layer (WHO axis) — ops must NOT import these.
#   ALLOWED (shared, not voice):
#     · orchestrator/freeside_auth  — infra (pg pool + wallet resolve)
#     · deliver/                    — presentation / render (sanitize, embed)
#     · score/                      — data (community-client; the isolation debt)
#     · domain/ ports/ types.ts observability/ — contracts + tracing
VOICE_RE="persona-engine[^\"']*/(voice|persona|compose|expression|ambient|preview)/"
ORCH_RE="persona-engine[^\"']*/orchestrator/"
ORCH_ALLOW="orchestrator/freeside_auth"

EXIT=0
violations=""

for dir in "${OPS_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue

  # Voice-generating modules — flat forbid.
  while IFS= read -r line; do
    [[ -n "$line" ]] && violations+="$line"$'\n'
  done < <(grep -rnE "from ['\"][^'\"]*${VOICE_RE}" "$dir" 2>/dev/null || true)

  # Orchestrator — forbidden EXCEPT the freeside_auth infra pool.
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    echo "$line" | grep -q "$ORCH_ALLOW" && continue
    violations+="$line"$'\n'
  done < <(grep -rnE "from ['\"][^'\"]*${ORCH_RE}" "$dir" 2>/dev/null || true)
done

if [[ -n "$violations" ]]; then
  echo "FAIL: CM-data/ops surface imports the character VOICE layer (WHO×WHAT membrane breach):" >&2
  printf '%s' "$violations" >&2
  echo "Fix: ops surfaces are voiceless. Voice belongs to the character daemon, never inside ops." >&2
  echo "See docs/LAYERING.md." >&2
  EXIT=1
else
  echo "OK: WHO×WHAT membrane clean — the ops surface imports no voice modules."
fi

exit $EXIT
