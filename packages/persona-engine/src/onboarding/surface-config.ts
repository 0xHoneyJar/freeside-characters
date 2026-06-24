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

import type { Pool, PoolClient } from 'pg';
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
 * @param poolOverride test seam — inject a Pool (or null) instead of the shared getPool().
 */
export async function getSurfaceConfig(
  worldId: string,
  surface: string,
  poolOverride?: Pool | null,
): Promise<SurfaceConfig | null> {
  const pool = poolOverride !== undefined ? poolOverride : getPool();
  if (!pool) return null; // DB unavailable — fall through to defaults.

  // Acquire a dedicated client so statement_timeout CANCELS the query DB-side and the
  // connection is RELEASED in finally. A bare Promise.race (the prior impl) abandoned the
  // wait but left the query running against a checked-out connection — under the exact
  // sustained DB degradation this bound targets, every call would hold a pool slot for the
  // full DB-side duration → pool exhaustion (BB #180 HIGH). `SET LOCAL` inside a txn auto-
  // resets at txn end, so the pooled connection isn't left with a sticky statement_timeout.
  let client: PoolClient;
  try {
    client = await pool.connect(); // bounded by the pool's connectionTimeoutMillis (5s)
  } catch (err) {
    console.warn(
      `[surface-config] pool.connect failed for ${worldId}/${surface} — falling back to defaults: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${SURFACE_CONFIG_QUERY_TIMEOUT_MS}`);
    const result = await client.query<SurfaceConfigRow>(
      `SELECT enabled, copy, template_json
         FROM surface_config
        WHERE world_id = $1 AND surface = $2
        LIMIT 1`,
      [worldId, surface],
    );
    await client.query('COMMIT');

    const row = result.rows[0];
    if (!row) return null; // no config row — default-OFF.

    return {
      enabled: row.enabled === true,
      copy: asStringMap(row.copy),
      template_json: row.template_json ?? null,
    };
  } catch (err) {
    // Fail soft: a missing table, transient outage, or statement_timeout cancel must not
    // break onboarding. Roll back so the connection returns to the pool clean.
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection may already be gone — release() below still returns the slot */
    }
    console.warn(
      `[surface-config] read failed for ${worldId}/${surface} — falling back to defaults: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  } finally {
    client.release();
  }
}
