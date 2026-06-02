/**
 * shadow/admin-allowlist.live.ts — the LIVE `AdminAllowlistSource` Layer
 * (Sprint 405 / Task 405.2, SDD §1.9/§6.2, FR-10).
 *
 * Reads a world's `admin_principals` (the FR-10 allowlist) from the deploy-bound
 * world manifest (`packages/registry/worlds/<world>.yaml`, e.g. `purupuru.yaml`).
 * The substrate's `resolveAuthz` resolves grant/deny by membership against this
 * list; the gate re-resolves it (`bypassCache: true`) at the write boundary to
 * close the mid-flow REVOCATION window (B4) and at the go_live confirm (B6).
 *
 * ── TTL CACHE ≤10s (B6) ──────────────────────────────────────────────────────
 * The allowlist is TTL-cached at ≤10s so a revoked admin loses read+write within
 * the window. `bypassCache: true` skips the cache (fresh manifest read) — used by
 * the go_live fresh re-check and the write-boundary re-check.
 *
 * ── CIRCULARITY GUARD (SKP-007) ──────────────────────────────────────────────
 * The allowlist lives in the MANIFEST, never a config surface — so the config
 * write path can never self-grant. This Layer reads the manifest file directly.
 *
 * The manifest path is supplied by the composition root so tests can point at a
 * fixture. In deploy, it points at the checked-in `purupuru.yaml`.
 */
import { Effect, Layer } from "effect";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { AdminAllowlistSource, AuthzError } from "./substrate.ts";

export interface LiveAllowlistConfig {
  /** resolve a world slug → its manifest file path. */
  readonly manifestPath: (world: string) => string;
  /** cache TTL in ms (default 10_000 — the ≤10s ceiling, B6). */
  readonly ttlMs?: number;
  /** injectable clock (tests). */
  readonly now?: () => number;
  /** injectable reader (tests). */
  readonly readFile?: (path: string) => string;
}

interface CacheEntry {
  principals: readonly string[];
  fetched_at: number;
}

/**
 * Parse `admin_principals` out of a world manifest. The field is a v1.3
 * (shadow-onboarding) addition nested under `shadow_onboarding.admin_principals`
 * (so the strict additionalProperties:false manifest schema stays satisfiable —
 * see purupuru.yaml). Returns [] if absent (deny-all default — fail-safe).
 */
function extractAdminPrincipals(yamlText: string): readonly string[] {
  const doc = parseYaml(yamlText) as
    | { shadow_onboarding?: { admin_principals?: unknown } }
    | undefined;
  const list = doc?.shadow_onboarding?.admin_principals;
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is string => typeof x === "string");
}

export function makeAdminAllowlistLive(
  cfg: LiveAllowlistConfig,
): Layer.Layer<AdminAllowlistSource> {
  const ttlMs = cfg.ttlMs ?? 10_000;
  const now = cfg.now ?? (() => Date.now());
  const read = cfg.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const cache = new Map<string, CacheEntry>();

  return Layer.succeed(
    AdminAllowlistSource,
    AdminAllowlistSource.of({
      adminPrincipals: (world, opts) =>
        Effect.try({
          try: () => {
            const w = world as unknown as string;
            const t = now();
            if (!opts?.bypassCache) {
              const hit = cache.get(w);
              if (hit && t - hit.fetched_at < ttlMs) return hit.principals;
            }
            const text = read(cfg.manifestPath(w));
            const principals = extractAdminPrincipals(text);
            cache.set(w, { principals, fetched_at: t });
            return principals;
          },
          catch: (e) =>
            new AuthzError({
              message: `admin_principals read failed for '${world}': ${e instanceof Error ? e.message : String(e)}`,
            }),
        }),
    }),
  );
}

/**
 * An IN-MEMORY `AdminAllowlistSource` for tests — no file I/O. `principals` is a
 * mutable map so a test can simulate REVOCATION mid-flow (mutate then call with
 * `bypassCache: true` to see the gate deny).
 */
export function makeAdminAllowlistInMemory(
  principalsByWorld: Map<string, readonly string[]>,
): Layer.Layer<AdminAllowlistSource> {
  return Layer.succeed(
    AdminAllowlistSource,
    AdminAllowlistSource.of({
      adminPrincipals: (world) =>
        Effect.succeed(principalsByWorld.get(world as unknown as string) ?? []),
    }),
  );
}
