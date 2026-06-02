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
#
# ── .delete( / .edit( FALSE-POSITIVE GUARD (FAGAN iter-2) ────────────────────
# `.delete(` / `.edit(` are used widely on non-Discord receivers (Map/Set/
# Collection caches: `sseClients.delete(id)`, `cache.delete(url)`, …). A bare
# `\.delete\s*\(` would flag all of them. So the role DELETE/EDIT patterns are
# SCOPED to a role-ish receiver: a token that is `role`/`roles` or ends in
# `Role`/`Roles` (case-insensitive) immediately before the method. This catches a
# planted `role.delete()` / `someRole.edit()` OUTSIDE the gated adapter while
# leaving Map/Set deletes untouched. `.setPermissions(` is Discord role/channel-
# only (no false-positive surface in this repo) so it is matched broadly.
# KNOWN LIMIT (documented in the header): a bare aliased variable
# (`const r = guild.roles.cache.get(id); r.delete()`) escapes the receiver-name
# scope — the same call-graph-blind limit the header already declares; the
# RUNTIME gate is the enforced boundary.
PATTERNS=(
  '\.roles\.create[[:space:]]*\('                       # guild.roles.create(
  '\.roles\.add[[:space:]]*\('                          # member.roles.add(
  '\.roles\.set[[:space:]]*\('                          # member.roles.set(
  '\.roles\.remove[[:space:]]*\('                       # member.roles.remove(
  '\.setRoles[[:space:]]*\('                            # member.setRoles(
  '\b[A-Za-z_]*[Rr]ole[s]?\.delete[[:space:]]*\('       # role.delete( / roles.delete( / fooRole.delete(
  '\b[A-Za-z_]*[Rr]ole[s]?\.edit[[:space:]]*\('         # role.edit( / fooRole.edit(
  '\.setPermissions[[:space:]]*\('                      # <role>.setPermissions(
)

# Search ONLY first-party RUNTIME source (apps/, packages/, scripts/) — never
# node_modules. Test files (*.test.ts) are EXCLUDED: tests reference the
# mutation patterns in string literals (the lint's own proof test plants a
# violation; the gate tests describe the rule) and perform no real role mutation
# (they run the MOCK writer). The runtime boundary is what this lint guards.
# -prune node_modules/dist (do NOT descend into them) — far faster than a
# post-hoc `-not -path` filter, which still walks every node_modules entry.
mapfile -t SEARCH_FILES < <(
  find "$REPO_ROOT/apps" "$REPO_ROOT/packages" "$REPO_ROOT/scripts" \
    \( -type d \( -name node_modules -o -name dist \) -prune \) -o \
    \( -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) \
       ! -name '*.test.ts' ! -name '*.test.tsx' ! -name '*.spec.ts' -print \) 2>/dev/null | sort
)

violations=0
echo "$TAG scanning $((${#SEARCH_FILES[@]})) source file(s) for discord.js role mutation outside the gated adapter…"

# Collapse the PATTERNS into ONE ERE alternation and grep each file ONCE (vs once
# per pattern). This keeps the scan fast (one grep per file, not N) — the
# multi-pass form was O(patterns × files) grep spawns and blew the test-runner
# latency budget once the delete/edit patterns were added (FAGAN iter-2).
COMBINED_ERE=""
for pat in "${PATTERNS[@]}"; do
  COMBINED_ERE="${COMBINED_ERE:+$COMBINED_ERE|}($pat)"
done

for f in "${SEARCH_FILES[@]}"; do
  rel="${f#"$REPO_ROOT"/}"
  # The gated adapter is the single allowlisted module — skip it.
  [[ "$rel" == "$GATED_ADAPTER" ]] && continue

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
  done < <(grep -nE "$COMBINED_ERE" "$f" 2>/dev/null || true)
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
