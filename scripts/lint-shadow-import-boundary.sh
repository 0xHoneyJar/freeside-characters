#!/usr/bin/env bash
# lint-shadow-import-boundary.sh — the CROSS-REPO import-boundary proof
# (Sprint 405 / Task 405.3, SDD §8.4 proof 4 / §4.4.4, R-13).
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  THE HEADLINE CROSS-REPO PROOF: the substrate's "SHADOW ⇒ zero writes"     ║
# ║  gate must survive the REPO BOUNDARY. The substrate's own export test      ║
# ║  (§8.4 proof 1) proves the SUBSTRATE exposes no raw live-writer path, but   ║
# ║  it cannot stop a consumer in freeside-characters from calling discord.js  ║
# ║  directly. THIS lint closes that gap on the characters side.               ║
# ║                                                                            ║
# ║  RULE: discord.js ROLE-MUTATION (guild.roles.create / member roles.add /   ║
# ║  roles.set / role.delete / role.edit / role.setPermissions) is FORBIDDEN   ║
# ║  ANYWHERE EXCEPT the single gated adapter module:                          ║
# ║      apps/bot/src/shadow/role-writer.live.ts                               ║
# ║  A raw role mutation anywhere else FAILS CI (exit 1).                       ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# ── KNOWN LIMITS (sprint-flatline D5, ties B9 / SDD §8.4 proof 4) ─────────────
# This static lint is ACCIDENT-PREVENTION, NOT an airtight security boundary.
# It catches the syntactic / direct-call shapes. It does NOT catch:
#   • dynamic imports — `const dj = await import("discord.js"); dj.…roles.create`
#   • indirect / aliased references — `const rm = guild.roles; rm.create(…)`
#     or a method captured into a variable and called later
#   • reflection — `guild.roles["cre"+"ate"](…)` / bracket-string assembly
#   • a re-exported/wrapped discord.js client whose name we don't pattern-match
# These escape it BY DESIGN — a regex over source text cannot model the call
# graph. The ENFORCED boundary is the RUNTIME gate (the substrate's
# `GateCheckedRoleWriter`: invocation-time apply_mode read + server-side authz
# re-check + write-after-audit), exactly as in the B9 reframe (SDD §4.4.4). The
# integration tests (role-writer-boundary.test.ts) — NOT this lint — are the
# stronger of the two checks for the un-gated-path invariant: they prove the LIVE
# writer is reachable ONLY through the gate and cannot be obtained without a
# WriteCapability. This lint is the cheap, fast, first line of defense that
# catches the honest-mistake case in review.
#
# Exit codes:
#   0 — no role mutation outside the gated adapter
#   1 — one or more raw role mutations found outside the gated adapter (CI FAIL)
#
# Usage:
#   ./scripts/lint-shadow-import-boundary.sh
#   bun run lint:shadow-import-boundary

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TAG="[lint:shadow-import-boundary]"

# The single module allowed to perform discord.js role mutation (repo-relative).
GATED_ADAPTER="apps/bot/src/shadow/role-writer.live.ts"

# Role-MUTATION shapes (ERE). Role READS (roles.fetch / roles.cache) are allowed
# everywhere — only mutations are forbidden outside the gated adapter.
#   guild.roles.create / .roles.create(
#   member.roles.add / .roles.set / .roles.remove   (member role mutation)
#   <role>.delete( / <role>.edit( / .setPermissions( on a role
# We match the method-call shapes that mutate.
PATTERNS=(
  '\.roles\.create[[:space:]]*\('          # guild.roles.create(
  '\.roles\.add[[:space:]]*\('             # member.roles.add(
  '\.roles\.set[[:space:]]*\('             # member.roles.set(
  '\.roles\.remove[[:space:]]*\('          # member.roles.remove(
  '\.setRoles[[:space:]]*\('               # member.setRoles(
)

# Search ONLY first-party RUNTIME source (apps/, packages/, scripts/) — never
# node_modules. Test files (*.test.ts) are EXCLUDED: tests reference the
# mutation patterns in string literals (the lint's own proof test plants a
# violation; the gate tests describe the rule) and perform no real role mutation
# (they run the MOCK writer). The runtime boundary is what this lint guards.
mapfile -t SEARCH_FILES < <(
  find "$REPO_ROOT/apps" "$REPO_ROOT/packages" "$REPO_ROOT/scripts" \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) \
    -not -path '*/node_modules/*' -not -path '*/dist/*' \
    -not -name '*.test.ts' -not -name '*.test.tsx' -not -name '*.spec.ts' 2>/dev/null | sort
)

violations=0
echo "$TAG scanning $((${#SEARCH_FILES[@]})) source file(s) for discord.js role mutation outside the gated adapter…"

for f in "${SEARCH_FILES[@]}"; do
  rel="${f#"$REPO_ROOT"/}"
  # The gated adapter is the single allowlisted module — skip it.
  [[ "$rel" == "$GATED_ADAPTER" ]] && continue

  for pat in "${PATTERNS[@]}"; do
    # grep -nE; ignore comment-only lines (leading // or *) to reduce false hits
    # on documentation that mentions the pattern. The gated adapter (the only
    # place these legitimately appear) is already excluded above.
    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      line_no="${hit%%:*}"
      content="${hit#*:}"
      trimmed="${content#"${content%%[![:space:]]*}"}"   # left-trim
      case "$trimmed" in
        '//'*|'*'*|'/*'*|'#'*) continue ;;  # comment line — not executable
      esac
      echo "$TAG  ✗ VIOLATION: $rel:$line_no" >&2
      echo "$TAG      $trimmed" >&2
      violations=$((violations+1))
    done < <(grep -nE "$pat" "$f" 2>/dev/null || true)
  done
done

echo
if [[ $violations -gt 0 ]]; then
  echo "$TAG FAIL: $violations raw discord.js role-mutation(s) found OUTSIDE the gated adapter ($GATED_ADAPTER)." >&2
  echo "$TAG Role mutation MUST go through the substrate's GateCheckedRoleWriter (SDD §4.4.4)." >&2
  echo "$TAG The ONLY module allowed to call discord.js role mutation is: $GATED_ADAPTER" >&2
  echo "$TAG (Known limits: this lint is accident-prevention, not airtight — see the header + the integration tests.)" >&2
  exit 1
fi

echo "$TAG OK: no discord.js role mutation outside the gated adapter ($GATED_ADAPTER) ✓"
exit 0
