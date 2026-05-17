#!/usr/bin/env bun
/**
 * INV-12 · TS-AST lint (cycle-007 S1/T1.5 · AC-RT-004 operator-attested rewrite).
 *
 * Scans voice-prompt-producing files (manifest at `.claude/data/voice-prompt-paths.json`)
 * for raw kebab ZoneId string literals OUTSIDE `domain/zone-registry.ts` imports.
 *
 * Closes Bug A at SOURCE — INV-12 SOURCE-side enforcement complements the SINK-side
 * `detectKebabZoneIds` sanitizer (FR-1.4 · log-only V1).
 *
 * Quality-gate provenance:
 * - Flatline PRD IMP-004 (Phase 2 · 800): CI lint guard against kebab in voice-prompt files.
 * - Flatline SDD SKP-001/CRITICAL (Phase 4 · 850): original bash logic skipped ENTIRE FILE if registry imported.
 *   THIS REWRITE: skip ONLY the import-statement line · flag literals on all other lines.
 * - Red Team AC-RT-004 (Phase 4.5 · 700 · operator-FORK-attested): bash grep cannot catch JS escape sequences
 *   ('el-dorado'), template literals (`el${'-'}dorado`), String.fromCharCode chains.
 *   THIS REWRITE uses TypeScript compiler API to resolve string-literal forms at AST level.
 * - Flatline SDD IMP-013 (Phase 4 · 770): manifest malformed = fail CI (no silent fallback to hardcoded list).
 * - Phase 6 SKP-001/CRITICAL: CODEOWNERS via signed-off-by trailer is forgeable. CI does monotonic-only.
 *   GitHub branch protection + CODEOWNERS required-reviews enforces operator approval (operator-action item).
 *
 * Detection patterns (caught by AST resolution):
 *   1. Plain string literal: `const z = 'el-dorado'`
 *   2. JS unicode escape:    `const z = 'el-dorado'` (decoded at parse-time to 'el-dorado')
 *   3. Template literal with constant parts: `` `el${'-'}dorado` `` (evaluated)
 *   4. String.fromCharCode chains: `String.fromCharCode(101,108,45,100,111,114,97,100,111)`
 *      (evaluated as numeric → string)
 *
 * Known limits (per Phase 6 SKP-007 · documented in SDD §2.7):
 *   - Identifier resolution beyond manifest files (e.g. importing ZONE_IDS from elsewhere)
 *   - Object property access (`config.zones["el-dorado"]`)
 *   - Runtime helper imports that return kebab strings
 *   - JSON config data loaded at runtime
 *   Defense-in-depth: SINK-side detectKebabZoneIds sanitizer (S6) catches what SOURCE-side lint misses.
 */

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import * as ts from 'typescript';

interface Manifest {
  paths: string[];
  exclude: string[];
}

interface Violation {
  file: string;
  line: number;
  column: number;
  text: string;
  reason: 'string-literal' | 'template-literal' | 'char-code-chain';
}

const REPO_ROOT = process.cwd();
// Manifest lives at .claude/overrides/ (project-local · outside the Loa submodule at .claude/data/).
// Per cycle-007 architectural cleanup 2026-05-17: .claude/data/ is a symlink into the Loa framework
// submodule (.loa/.claude/data/) · project-specific data belongs in .claude/overrides/ which is
// real-project-local directory (Loa convention for project overrides).
const MANIFEST_PATH = join(REPO_ROOT, '.claude/overrides/voice-prompt-paths.json');
const ZONE_REGISTRY_PATH = 'packages/persona-engine/src/domain/zone-registry.ts';

// Loaded from manifest · escape regex meta-chars defensively (ZoneIds are kebab-safe today but future-proof)
let ZONE_ID_SET: Set<string> = new Set();

function loadManifest(): Manifest {
  let raw: string;
  try {
    raw = readFileSync(MANIFEST_PATH, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[INV-12 lint] WARNING: ${MANIFEST_PATH} missing · using hardcoded fallback (first-time bootstrap)`);
      return {
        paths: [
          'packages/persona-engine/src/compose',
          'packages/persona-engine/src/persona',
          'packages/persona-engine/src/live/claude-sdk.live.ts',
        ],
        exclude: ['packages/persona-engine/src/domain/zone-registry.ts'],
      };
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`[INV-12 lint] ERROR: manifest malformed JSON · refusing to fall back silently: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!parsed || typeof parsed !== 'object' || !('paths' in parsed) || !Array.isArray((parsed as Manifest).paths)) {
    console.error(`[INV-12 lint] ERROR: manifest missing required "paths" array · refusing to fall back silently`);
    process.exit(2);
  }
  const m = parsed as Manifest;
  if (!Array.isArray(m.exclude)) m.exclude = [];
  return m;
}

function loadZoneIds(): Set<string> {
  // Read ZONE_IDS array from score/types.ts via simple regex (it's a frozen const · stable shape)
  const typesPath = join(REPO_ROOT, 'packages/persona-engine/src/score/types.ts');
  const content = readFileSync(typesPath, 'utf8');
  const match = content.match(/ZONE_IDS:\s*readonly\s+ZoneId\[\]\s*=\s*\[([^\]]+)\]/);
  if (!match) {
    console.error(`[INV-12 lint] ERROR: could not find ZONE_IDS array in ${typesPath}`);
    process.exit(2);
  }
  const ids = new Set<string>();
  const itemRegex = /['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(match[1])) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function* walkFiles(rootPath: string): Generator<string> {
  const stat = statSync(rootPath);
  if (stat.isFile()) {
    yield rootPath;
    return;
  }
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (ext !== '.ts' && ext !== '.tsx') continue;
      // Skip test files — fixtures legitimately contain kebab ZoneIds
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
      yield full;
    }
  }
}

/**
 * Returns true if this string literal is used as a record/object property KEY
 * (e.g. `{ 'el-dorado': 'value' }`). Keys are TYPE-LEVEL identifiers, not VALUE
 * flowing into prose — safe to skip per INV-12 intent.
 */
function isObjectPropertyKey(node: ts.Node): boolean {
  if (!node.parent) return false;
  if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return true;
  if (ts.isPropertySignature(node.parent) && node.parent.name === node) return true;
  if (ts.isComputedPropertyName(node.parent)) return true;
  return false;
}

/**
 * Returns true if this string literal is an element of an array literal that's
 * typed as ZoneId[] (e.g. `export const ALL_ZONES: ZoneId[] = ['el-dorado', ...]`).
 * Such arrays are routing-key collections, not prose · safe to skip.
 */
function isZoneIdArrayElement(node: ts.Node): boolean {
  if (!node.parent || !ts.isArrayLiteralExpression(node.parent)) return false;
  // Walk up to the variable declaration
  let current: ts.Node | undefined = node.parent.parent;
  while (current) {
    if (ts.isVariableDeclaration(current)) {
      const typeNode = current.type;
      if (typeNode) {
        const typeText = typeNode.getText();
        if (typeText.includes('ZoneId')) return true;
      }
      // Also allow when initializer is the array literal we're in (no explicit type)
      // — heuristic: variable name contains "ZONE" or "Zones"
      if (current.name && ts.isIdentifier(current.name)) {
        const name = current.name.text;
        if (/^(ALL_ZONES|ZONES|ZONE_IDS|.*Zones)$/i.test(name)) return true;
      }
      return false;
    }
    current = current.parent;
  }
  return false;
}

function isImportFromZoneRegistry(node: ts.Node): boolean {
  // Walk up to find the containing import declaration
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isImportDeclaration(current)) {
      const moduleSpec = current.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpec)) {
        return moduleSpec.text.includes('zone-registry');
      }
    }
    current = current.parent;
  }
  return false;
}

/**
 * Try to evaluate a node to a string literal value at compile-time.
 * Handles: string literals (with escape sequences decoded), template literals
 * with constant parts, String.fromCharCode chains.
 *
 * Returns the resolved string OR null if non-static.
 */
function evaluateAsString(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text; // TS parser already decodes \uXXXX escapes
  }
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans) {
      const exprValue = evaluateAsString(span.expression);
      if (exprValue === null) return null;
      result += exprValue + span.literal.text;
    }
    return result;
  }
  if (ts.isCallExpression(node)) {
    // String.fromCharCode(n, n, n, ...)
    const callee = node.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'String' &&
      ts.isIdentifier(callee.name) &&
      callee.name.text === 'fromCharCode'
    ) {
      const codes: number[] = [];
      for (const arg of node.arguments) {
        if (!ts.isNumericLiteral(arg)) return null;
        codes.push(Number(arg.text));
      }
      return String.fromCharCode(...codes);
    }
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    // 'el' + '-' + 'dorado' concatenation
    const left = evaluateAsString(node.left);
    const right = evaluateAsString(node.right);
    if (left !== null && right !== null) return left + right;
  }
  if (ts.isParenthesizedExpression(node)) {
    return evaluateAsString(node.expression);
  }
  return null;
}

function isOnImportStatementLine(file: ts.SourceFile, node: ts.Node): boolean {
  // Phase 6 SKP-001/CRITICAL fix: skip ONLY the import-statement LINE, not first 50 lines.
  // Find the import declaration whose source-location overlaps this node's line.
  const nodeStart = file.getLineAndCharacterOfPosition(node.getStart(file));
  let onImport = false;
  ts.forEachChild(file, function visit(child) {
    if (ts.isImportDeclaration(child)) {
      const importStart = file.getLineAndCharacterOfPosition(child.getStart(file));
      const importEnd = file.getLineAndCharacterOfPosition(child.getEnd());
      if (nodeStart.line >= importStart.line && nodeStart.line <= importEnd.line) {
        onImport = true;
      }
    }
    ts.forEachChild(child, visit);
  });
  return onImport;
}

function scanFile(filePath: string, violations: Violation[]) {
  const content = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const relPath = relative(REPO_ROOT, filePath);

  function visit(node: ts.Node) {
    const value = evaluateAsString(node);
    if (value !== null && ZONE_ID_SET.has(value)) {
      // Skip safe contexts:
      //   - import statements from zone-registry
      //   - import statement lines (Phase 6 SKP-001/CRITICAL precise scoping)
      //   - object property keys (record-typed routing maps)
      //   - elements of ZoneId[] arrays (e.g. ALL_ZONES const)
      if (
        !isImportFromZoneRegistry(node) &&
        !isOnImportStatementLine(sourceFile, node) &&
        !isObjectPropertyKey(node) &&
        !isZoneIdArrayElement(node)
      ) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const reason: Violation['reason'] = ts.isTemplateExpression(node)
          ? 'template-literal'
          : ts.isCallExpression(node)
            ? 'char-code-chain'
            : 'string-literal';
        violations.push({
          file: relPath,
          line: line + 1,
          column: character + 1,
          text: value,
          reason,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function main() {
  const manifest = loadManifest();
  ZONE_ID_SET = loadZoneIds();

  if (ZONE_ID_SET.size === 0) {
    console.error('[INV-12 lint] ERROR: no ZoneIds loaded · cannot scan');
    process.exit(2);
  }

  const excludeAbs = new Set(manifest.exclude.map((p) => join(REPO_ROOT, p)));
  const violations: Violation[] = [];

  for (const path of manifest.paths) {
    const abs = join(REPO_ROOT, path);
    try {
      statSync(abs);
    } catch {
      console.warn(`[INV-12 lint] WARNING: manifest path not found: ${path}`);
      continue;
    }
    for (const file of walkFiles(abs)) {
      if (excludeAbs.has(file)) continue;
      scanFile(file, violations);
    }
  }

  if (violations.length === 0) {
    console.log(`[INV-12 lint] ✅ 0 voice-prompt kebab leaks (scanned ${manifest.paths.length} paths · ${ZONE_ID_SET.size} ZoneIds)`);
    process.exit(0);
  }

  console.error(`[INV-12 lint] ❌ ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.column}  '${v.text}'  [${v.reason}]`);
  }
  console.error('');
  console.error('Fix: import zone IDs from packages/persona-engine/src/domain/zone-registry.ts');
  console.error('     OR remove the kebab literal · use safeResolveZoneDisplayName / safeResolveZoneRichLabel');
  process.exit(1);
}

main();
