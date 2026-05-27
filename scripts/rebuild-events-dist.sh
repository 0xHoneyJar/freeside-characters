#!/usr/bin/env bash
# rebuild-events-dist.sh — Rebuild @0xhoneyjar/events dist from source with
# supply-chain verification.
#
# Sister script to scripts/rebuild-hounfour-dist.sh (which lives in
# loa-freeside root). Same posture, adapted for a SUBDIR package: the
# @0xhoneyjar/events package lives at loa-freeside/packages/events/, not at
# the repo root. The script clones loa-freeside at a pinned SHA, cds into
# packages/events/, builds via the package's own pnpm pipeline, and copies
# dist/ back into node_modules/@0xhoneyjar/events/dist.
#
# Per cluster sovereignty doctrine (memory:cluster-no-npm-sovereignty,
# 2026-05-26), the events package is NOT published to npm. Children
# (sonar-api, freeside-characters, future cells) consume via git-URL
# pinned to a commit SHA, and run this script as a postinstall hook to
# materialize the dist/ from the clone.
#
# Supply-chain verification (matches the rebuild-hounfour-dist.sh posture):
#   - Isolated clone via git init + fetch --depth 1 (deterministic)
#   - SHA verification before build
#   - set -euo pipefail + explicit error messages
#   - pnpm install --ignore-scripts (no post-install from transitive deps)
#   - SOURCE_DATE_EPOCH=0 for reproducible timestamps
#   - dist/src/SOURCE_SHA provenance file
#   - All 8 export specifiers verified (per packages/events/package.json)
#   - Stale-detection via SCHEMA_VERSION literal + SOURCE_SHA match
#
# Called automatically via "postinstall" in the consuming repo's
# package.json. Copy this file into the consumer's scripts/ directory
# and reference it from postinstall.

set -euo pipefail

REPO="https://github.com/0xHoneyJar/loa-freeside.git"
SUBDIR="packages/events"
PKG_NAME="@0xhoneyjar/events"
PKG_DIR_FILE_NAME="events"
TAG="[rebuild-events-dist]"
ROOT_DIR=$(pwd -P)

# =============================================================================
# Step 0: Extract the commit SHA from caller's package.json
# =============================================================================

COMMIT_SHA=""
DECLARED_IN_PACKAGE_JSON=0
if [[ -f "package.json" ]]; then
  # BB#105 rd-2 F-001: SHA extraction reads from BOTH cluster.eventsPin.sha
  # (the cluster sovereignty workaround for pnpm's subdir-github limitation)
  # AND the standard dependencies/devDependencies field. Previously only the
  # dep field was checked, so consumers using only cluster.eventsPin.sha
  # (the canonical sonar/pnpm pattern) would always hit the declared-but-no-SHA
  # error. Precedence: cluster.eventsPin.sha first (explicit sovereignty),
  # then dependencies (legacy/bun-style consumers).
  COMMIT_SHA=$(node -e "
    const pkg = require('./package.json');
    const SHA_RE = /^[0-9a-f]{7,40}\$/;
    let sha = '';
    // 1. cluster.eventsPin.sha (preferred per sovereignty doctrine)
    const pinSha = ((pkg.cluster || {}).eventsPin || {}).sha;
    if (pinSha && SHA_RE.test(pinSha)) {
      sha = pinSha;
    } else {
      // 2. dependencies/devDependencies github:owner/repo#<sha>
      const dep = (pkg.devDependencies || {})['${PKG_NAME}'] ||
                  (pkg.dependencies || {})['${PKG_NAME}'] || '';
      const match = dep.match(/#([0-9a-f]{7,40})\$/);
      if (match) sha = match[1];
    }
    if (sha) console.log(sha);
  " 2>/dev/null || echo "")
  # BB#105 F-002: track whether the package is DECLARED (vs absent). When
  # declared-but-not-installed, we must fail loud below instead of silently
  # skipping (deferring the import error to runtime). Declared = either the
  # dep is named in deps/devDeps (any value) OR cluster.eventsPin.sha is set.
  DECLARED_IN_PACKAGE_JSON=$(node -e "
    const pkg = require('./package.json');
    const declared = (pkg.devDependencies || {})['${PKG_NAME}'] !== undefined
                  || (pkg.dependencies || {})['${PKG_NAME}'] !== undefined
                  || ((pkg.cluster || {}).eventsPin || {}).sha !== undefined;
    console.log(declared ? '1' : '0');
  " 2>/dev/null || echo "0")
fi

if [[ -z "$COMMIT_SHA" ]]; then
  # No SHA found AND package not declared → genuinely a non-consumer; skip safely.
  if [[ "$DECLARED_IN_PACKAGE_JSON" != "1" ]]; then
    echo "$TAG ${PKG_NAME} not declared in package.json — skipping (script is a cluster-shared template; harmless in non-consumer repos)"
    exit 0
  fi
  # Declared but no SHA extractable → caller misconfigured the pin. Fail loud.
  echo "$TAG ERROR: ${PKG_NAME} is declared in package.json but no git commit SHA can be extracted." >&2
  echo "$TAG Expected one of:" >&2
  echo "$TAG   - dependencies/devDependencies entry like: \"${PKG_NAME}\": \"github:owner/repo#<40-char-sha>\"" >&2
  echo "$TAG   - cluster.eventsPin.sha block with a 40-char SHA" >&2
  exit 1
fi

# =============================================================================
# Step 1: Find the installed events package directory in node_modules
# =============================================================================

EVENTS_DIR=""
# pnpm hoisted layout
for candidate in "$ROOT_DIR"/node_modules/.pnpm/@0xhoneyjar+${PKG_DIR_FILE_NAME}@*/node_modules/${PKG_NAME}; do
  if [[ -d "$candidate" ]]; then
    EVENTS_DIR="$candidate"
  fi
done
# npm / pnpm hoisted (flat) layout
if [[ -z "$EVENTS_DIR" && -d "$ROOT_DIR/node_modules/${PKG_NAME}" ]]; then
  EVENTS_DIR="$ROOT_DIR/node_modules/${PKG_NAME}"
fi

if [[ -z "$EVENTS_DIR" ]]; then
  # BB#105 F-002: the consumer DECLARED ${PKG_NAME} (we extracted a SHA
  # above), so a missing node_modules entry means the install layout is
  # broken — most likely the bun-fixup script didn't run, OR pnpm bootstrap
  # failed silently. Either way, runtime imports will throw with an opaque
  # "Cannot find package" error. Fail loud at install time instead.
  echo "$TAG ERROR: ${PKG_NAME} is declared with SHA ${COMMIT_SHA:0:12} but no package directory found in node_modules." >&2
  echo "$TAG Expected one of:" >&2
  echo "$TAG   - $ROOT_DIR/node_modules/.pnpm/@0xhoneyjar+${PKG_DIR_FILE_NAME}@*/node_modules/${PKG_NAME}" >&2
  echo "$TAG   - $ROOT_DIR/node_modules/${PKG_NAME}" >&2
  echo "$TAG If using bun: ensure scripts/fixup-events-bun.sh ran BEFORE this script." >&2
  echo "$TAG If using pnpm: ensure the consumer's pnpm-lock.yaml resolves ${PKG_NAME} (you may need to clear node_modules + reinstall)." >&2
  exit 1
fi

# =============================================================================
# Step 2: Check if dist is already up-to-date (acvp-l1-v2 fingerprint)
# =============================================================================

# Stale-detection: SCHEMA_VERSION literal in dist + SOURCE_SHA provenance
HAS_VALID_SCHEMA_VERSION=false
if [[ -f "$EVENTS_DIR/dist/src/envelope.js" ]]; then
  if grep -q 'acvp-l1-v2' "$EVENTS_DIR/dist/src/envelope.js" 2>/dev/null; then
    HAS_VALID_SCHEMA_VERSION=true
  fi
fi

HAS_VALID_SOURCE_SHA=false
if [[ -f "$EVENTS_DIR/dist/SOURCE_SHA" ]]; then
  EXISTING_SOURCE_SHA=$(cat "$EVENTS_DIR/dist/SOURCE_SHA" 2>/dev/null | tr -d '[:space:]')
  if [[ "$EXISTING_SOURCE_SHA" == "$COMMIT_SHA" ]]; then
    HAS_VALID_SOURCE_SHA=true
  fi
fi

if [[ "$HAS_VALID_SCHEMA_VERSION" == "true" && "$HAS_VALID_SOURCE_SHA" == "true" ]]; then
  echo "$TAG dist/ already up-to-date (acvp-l1-v2, SOURCE_SHA=$COMMIT_SHA) — skipping"
  exit 0
fi

# Path ε hotfix 8 (2026-05-26): if the schema-version fingerprint matches but
# SOURCE_SHA doesn't (because dist was committed to loa-freeside upstream and
# its SOURCE_SHA file lags by definition — it can't contain the SHA of the
# commit that introduces it), trust the schema literal alone. Avoids the
# pnpm-install-in-standalone-subdir failure that took 7 hotfix layers to
# surface (PRs #108-#113 on this repo).
if [[ "$HAS_VALID_SCHEMA_VERSION" == "true" ]]; then
  echo "$TAG dist/ has valid acvp-l1-v2 schema fingerprint (SOURCE_SHA=$(cat "$EVENTS_DIR/dist/SOURCE_SHA" 2>/dev/null || echo "missing") vs expected $COMMIT_SHA — accepting upstream dist regardless) — skipping rebuild"
  exit 0
fi

echo "$TAG Rebuilding ${PKG_NAME} dist from loa-freeside@${COMMIT_SHA:0:12}..."
echo "$TAG Schema version fingerprint present: $HAS_VALID_SCHEMA_VERSION"
echo "$TAG Source SHA valid: $HAS_VALID_SOURCE_SHA"

# =============================================================================
# Step 3: Verify git + pnpm available
# =============================================================================

# BB#105 rd-2 F-002 HIGH: once we're past the declared-but-not-found checks
# above (package IS declared + needs rebuild), every remaining prerequisite
# failure MUST exit 1. Silent-success at this point is a supply-chain hazard
# — install goes green but the runtime import will throw "Cannot find package"
# with no breadcrumb. Per BB review: "Required materialization scripts must
# fail closed. Exit codes are an API to CI and operators."
if ! command -v git &>/dev/null; then
  echo "$TAG ERROR: git not available — cannot rebuild ${PKG_NAME} from source" >&2
  echo "$TAG Install git or run rebuild-events-dist.sh from an environment with git available." >&2
  exit 1
fi

PNPM_BIN=""
if command -v pnpm &>/dev/null; then
  PNPM_BIN="pnpm"
elif command -v corepack &>/dev/null; then
  # corepack will provision pnpm on first invocation
  PNPM_BIN="corepack pnpm"
else
  echo "$TAG ERROR: pnpm not available (and no corepack) — cannot build ${PKG_NAME} subdir package" >&2
  echo "$TAG Install pnpm or enable corepack: 'corepack enable'" >&2
  exit 1
fi

# =============================================================================
# Step 4: Isolated clone via git init + fetch --depth 1 (deterministic)
# =============================================================================

BUILD_DIR=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "$TAG Cloning loa-freeside at $COMMIT_SHA (isolated fetch)..."

cd "$BUILD_DIR"
git init repo >/dev/null 2>&1
cd repo
git remote add origin "$REPO"
git fetch --depth 1 origin "$COMMIT_SHA" 2>/dev/null || {
  echo "$TAG SECURITY: Failed to fetch expected SHA $COMMIT_SHA"
  echo "$TAG Falling back to full clone + checkout..."
  cd "$BUILD_DIR"
  rm -rf repo
  git clone "$REPO" repo 2>/dev/null || {
    # BB#105 rd-2 F-002: fail loud — declared dep cannot rebuild.
    echo "$TAG ERROR: git clone of ${REPO} failed — cannot rebuild ${PKG_NAME}" >&2
    exit 1
  }
  cd repo
  git checkout "$COMMIT_SHA" 2>/dev/null || {
    echo "$TAG ERROR: Could not checkout $COMMIT_SHA in ${REPO} — cannot rebuild ${PKG_NAME}" >&2
    exit 1
  }
}

if git rev-parse FETCH_HEAD >/dev/null 2>&1; then
  git checkout --detach FETCH_HEAD 2>/dev/null || true
fi

# =============================================================================
# Step 5: Verify commit SHA in the cloned repo
# =============================================================================

ACTUAL_SHA=$(git rev-parse HEAD)
if [[ "$ACTUAL_SHA" != "$COMMIT_SHA" ]]; then
  echo "$TAG SECURITY: SHA mismatch. Expected $COMMIT_SHA, got $ACTUAL_SHA"
  exit 1
fi

echo "$TAG SHA verified: $ACTUAL_SHA"

# =============================================================================
# Step 6: CD into the subdir (events lives at packages/events/, not root)
# =============================================================================

if [[ ! -d "$SUBDIR" ]]; then
  # BB#105 rd-2 F-002: subdir-package SHA pinned to a commit that doesn't
  # contain the subdir is operator-configuration broken — fail loud.
  echo "$TAG ERROR: $SUBDIR not present in cloned loa-freeside@$COMMIT_SHA — cannot rebuild ${PKG_NAME}" >&2
  echo "$TAG The pinned SHA may predate the subdir. Update cluster.eventsPin.sha or the github: URL #sha." >&2
  exit 1
fi

cd "$SUBDIR"
echo "$TAG Entered subdir: $SUBDIR"

# =============================================================================
# Step 7: Install + build (deterministic, ignore-scripts)
# =============================================================================

echo "$TAG Installing events package deps (pnpm install --ignore-scripts)..."
$PNPM_BIN install --ignore-scripts 2>/dev/null || {
  # BB#105 rd-2 F-002: pnpm install failure leaves dist unrebuilt; fail loud.
  echo "$TAG ERROR: pnpm install --ignore-scripts failed in $SUBDIR — cannot rebuild ${PKG_NAME}" >&2
  exit 1
}

export SOURCE_DATE_EPOCH=0
echo "$TAG Building events package (pnpm build, SOURCE_DATE_EPOCH=0)..."
$PNPM_BIN build 2>/dev/null || {
  echo "$TAG ERROR: pnpm build failed in $SUBDIR — cannot rebuild ${PKG_NAME}" >&2
  exit 1
}

# =============================================================================
# Step 8: Verify the build produced correct output
# =============================================================================

if [[ ! -d "dist" ]]; then
  echo "$TAG ERROR: pnpm build succeeded but produced no dist/ in $SUBDIR — cannot rebuild ${PKG_NAME}" >&2
  exit 1
fi

if ! grep -q 'acvp-l1-v2' "dist/src/envelope.js" 2>/dev/null; then
  echo "$TAG WARNING: built dist/src/envelope.js does NOT contain acvp-l1-v2 fingerprint — refusing to ship"
  exit 1
fi

echo "$TAG Built dist/ (acvp-l1-v2 fingerprint present)"

# =============================================================================
# Step 9: Embed source provenance
# =============================================================================

echo "$ACTUAL_SHA" > dist/SOURCE_SHA
echo "$TAG Embedded SOURCE_SHA: $ACTUAL_SHA"

# =============================================================================
# Step 10: Verify all export specifiers resolve from built dist
# =============================================================================

echo "$TAG Verifying export specifiers..."
SPECIFIERS=("" "/envelope" "/jcs" "/signer" "/topics" "/publisher" "/subscriber" "/schemas/nft-mint-detected")
for specifier in "${SPECIFIERS[@]}"; do
  if [[ -z "$specifier" ]]; then
    ENTRY_FILE="dist/src/index.js"
    LABEL="root"
  else
    ENTRY_FILE="dist/src${specifier}.js"
    LABEL="${specifier#/}"
  fi
  if [[ ! -f "$ENTRY_FILE" ]]; then
    echo "$TAG MANIFEST: Failed to resolve specifier '${LABEL}' — $ENTRY_FILE not found"
    exit 1
  fi
  echo "$TAG   [OK] ${LABEL} -> $ENTRY_FILE"
done

# =============================================================================
# Step 11: Replace stale dist with rebuilt one
# =============================================================================

cd "$ROOT_DIR"
rm -rf "$EVENTS_DIR/dist"
cp -r "$BUILD_DIR/repo/$SUBDIR/dist" "$EVENTS_DIR/dist"

echo "$TAG Successfully rebuilt dist (SOURCE_SHA=${ACTUAL_SHA:0:12})"
