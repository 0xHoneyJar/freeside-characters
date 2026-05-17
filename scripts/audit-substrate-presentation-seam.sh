#!/usr/bin/env bash
# cycle-006 NFR-1 · forbidden imports across the substrate-presentation seam.
# Runs in CI on every PR (wired via `bun run lint:seam`). Fails the build on
# any violation. Closes BB design-review F-003 (single-renderer invariant).

set -euo pipefail

# Skip flag args when resolving ROOT positional.
ROOT="packages/persona-engine/src"
for arg in "$@"; do
  [[ "$arg" == --* ]] && continue
  ROOT="$arg"
  break
done
EXIT=0

# Renderer cannot import voice modules.
if [[ -f "${ROOT}/live/discord-render.live.ts" ]]; then
  if grep -lE "from '.*(compose/(agent-gateway|voice-brief|reply)|live/claude-sdk)" \
       "${ROOT}/live/discord-render.live.ts" >/dev/null 2>&1; then
    echo "FAIL: discord-render.live.ts imports voice module" >&2
    EXIT=1
  fi
fi

# buildPulseDimensionPayload must not exist anywhere in src.
if grep -rl "buildPulseDimensionPayload" "${ROOT}" >/dev/null 2>&1; then
  echo "FAIL: buildPulseDimensionPayload still referenced in ${ROOT}" >&2
  grep -rln "buildPulseDimensionPayload" "${ROOT}" >&2 || true
  EXIT=1
fi

# DeterministicEmbed must not gain a `description` field.
if [[ -f "${ROOT}/domain/digest-message.ts" ]]; then
  # Search only inside the `DeterministicEmbed` interface block — comments
  # mentioning "description" are allowed.
  if awk '/^export interface DeterministicEmbed/,/^}/' "${ROOT}/domain/digest-message.ts" \
       | grep -E "^\s+(readonly )?description\s*[:?]" >/dev/null 2>&1; then
    echo "FAIL: DeterministicEmbed contains 'description' field" >&2
    EXIT=1
  fi
fi

# composer.ts must NOT contain post-type business logic. cycle-006 S4 finalizes
# composer.ts as a thin router that only dispatches to orchestrators. Until S4
# closes, this check warns rather than fails — re-enable as a hard gate in S4.
if [[ -f "${ROOT}/compose/composer.ts" ]]; then
  if grep -cE "buildPostPayload|invoke\(config," "${ROOT}/compose/composer.ts" 2>/dev/null \
       | awk '{ exit !($1 > 0) }'; then
    if [[ "${LOA_SEAM_AUDIT_STRICT_COMPOSER:-0}" == "1" ]]; then
      echo "FAIL: composer.ts contains business logic; must be router only" >&2
      EXIT=1
    else
      echo "WARN: composer.ts still contains business logic (S4 finalization pending)" >&2
    fi
  fi
fi

# cycle-007 S7 · G-6 leak closure: orchestrators MUST NOT import to*Payload from live/discord-webhook.
# They route through PresentationPort instead (presentation.toDigestPayload etc).
# Strict mode (LOA_SEAM_AUDIT_STRICT_COMPOSER=1 OR --strict-composer flag) fails the build;
# default warns to allow incremental migration. After cycle-007 S7 close, strict mode becomes default.
STRICT_COMPOSER=0
for arg in "$@"; do
  [[ "$arg" == "--strict-composer" ]] && STRICT_COMPOSER=1
done
[[ "${LOA_SEAM_AUDIT_STRICT_COMPOSER:-0}" == "1" ]] && STRICT_COMPOSER=1

if [[ -d "${ROOT}/orchestrator" ]]; then
  leaks=$(grep -lE "to[A-Z][a-zA-Z]+Payload.*from.*live/discord-webhook" "${ROOT}"/orchestrator/*.ts 2>/dev/null || true)
  if [[ -n "$leaks" ]]; then
    if [[ "$STRICT_COMPOSER" == "1" ]]; then
      echo "FAIL: orchestrator files import to*Payload from live/discord-webhook directly (G-6 leak)" >&2
      echo "$leaks" >&2
      echo "Fix: route through PresentationPort (presentation.toDigestPayload etc)" >&2
      EXIT=1
    else
      echo "WARN: orchestrator files import to*Payload from live/discord-webhook directly (G-6 leak · use --strict-composer to enforce)" >&2
      echo "$leaks" >&2
    fi
  fi
fi

if [[ $EXIT -eq 0 ]]; then
  echo "OK: substrate-presentation seam clean (${ROOT})"
fi

exit ${EXIT}
