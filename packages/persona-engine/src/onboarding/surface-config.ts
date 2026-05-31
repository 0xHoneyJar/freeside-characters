// surface-config.ts — DB-0 (arrakis-ojm0) · per-world surface config read-shim.
//
// Reads the `surface_config` table (migrations/0001_surface_config.sql) so a CM can
// override per-world onboarding copy WITHOUT a code deploy. SHIPS DARK: until a CM
// inserts an `enabled = true` row this returns null on every path and the caller falls
// through to its code-constant defaults — byte-identical behavior to today.
//
// FAIL-SOFT is the contract. No pool / no row / disabled row / any query error / timeout
// → return null. We NEVER throw out of getSurfaceConfig: a config store that is down must
// not break onboarding. The caller's `cfg?.enabled ? cfg.copy : {}` guard then yields the
// same `{}` it passes today.
//
// Reuses the existing freeside_auth pool (RAILWAY_MIBERA_DATABASE_URL → mibera-db) — does
// NOT open a second Pool.

import { getPool } from '../orchestrator/freeside_auth/server.ts';

/** Short bound on the config read — onboarding must not block on a slow/hung DB. */
const SURFACE_CONFIG_QUERY_TIMEOUT_MS = 1_500;

export interface SurfaceConfig {
  enabled: boolean;
  copy: Record<string, string>;
  template_json: unknown;
}

interface SurfaceConfigRow {
  enabled: boolean | null;
  copy: unknown;
  template_json: unknown;
}

/** Promise that rejects after `ms`, used to bound the DB read. */
function timeout(ms: number): Promise<never> {
  return new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error('surface-config query timeout')), ms),
  );
}

/** Coerce an unknown jsonb value into a flat string-map; anything unexpected → {}. */
function asStringMap(value: unknown): Record<string, string> {
  if (value === null || value === undefined || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Look up the surface config for (worldId, surface). Returns null on EVERY failure or
 * absence path (no pool, no row, query error, timeout) so the caller falls back to its
 * code-constant defaults. Never throws.
 *
 * @param worldId world slug, e.g. 'mibera'
 * @param surface surface key, e.g. 'onboarding:verify'
 */
export async function getSurfaceConfig(
  worldId: string,
  surface: string,
): Promise<SurfaceConfig | null> {
  const pool = getPool();
  if (!pool) return null; // DB unavailable — fall through to defaults.

  try {
    const query = pool.query<SurfaceConfigRow>(
      `SELECT enabled, copy, template_json
         FROM surface_config
        WHERE world_id = $1 AND surface = $2
        LIMIT 1`,
      [worldId, surface],
    );

    const result = await Promise.race([query, timeout(SURFACE_CONFIG_QUERY_TIMEOUT_MS)]);
    const row = result.rows[0];
    if (!row) return null; // no config row — default-OFF.

    return {
      enabled: row.enabled === true,
      copy: asStringMap(row.copy),
      template_json: row.template_json ?? null,
    };
  } catch (err) {
    // Fail soft: a missing table, transient outage, or timeout must not break onboarding.
    console.warn(
      `[surface-config] read failed for ${worldId}/${surface} — falling back to defaults: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}
