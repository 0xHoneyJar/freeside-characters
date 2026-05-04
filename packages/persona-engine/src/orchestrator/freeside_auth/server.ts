/**
 * Freeside-auth — in-bot SDK MCP server (V0.5-C).
 *
 * Resolves wallet addresses → user-overlay data (handle, discord,
 * mibera_id, pfp). Backs the persona prompt's directive: "if you cite
 * a wallet, call resolve_wallet first; use handle/discord over the raw
 * 0x address."
 *
 * ECS placement (per `vault/wiki/concepts/freeside-as-identity-spine.md`):
 *   - This server is the in-bot CONSUMER surface for the AuthSystem.
 *     The canonical AuthSystem (loa-freeside) will eventually publish a
 *     remote MCP / HTTP at the same shape; until then ruggy reads
 *     midi_profiles directly via Railway Postgres.
 *   - Operator pick (V0.5-C): in-bot mcp, fast iter. When freeside-auth
 *     proper deploys a `resolve_wallet` endpoint, swap the data source
 *     in this file; persona prompt + tool surface stays stable.
 *
 * Data source: RAILWAY_MIBERA_DATABASE_URL (Postgres).
 * Schema: `midi_profiles` table (post-supabase migration 2026-04-03,
 * loa-freeside#153).
 *
 * UNIX boundary: this module does ONE thing — wallet → identity claims.
 * It does NOT issue JWTs (loa-freeside/gateway's job), does NOT verify
 * credentials (Dynamic/Better Auth's job), does NOT cache score data
 * (rosenzu/score-mcp's job).
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Pool, type PoolClient } from 'pg';

interface ProfileRow {
  wallet_address: string;
  display_name: string | null;
  discord_id: string | null;
  discord_username: string | null;
  mibera_id: string | null;
  pfp_url: string | null;
}

export interface ResolvedWallet {
  found: boolean;
  wallet: string;
  /** Display name (operator-set). Use this in prose when present. */
  handle: string | null;
  discord_id: string | null;
  discord_username: string | null;
  /** Mibera ID — human-readable identifier, e.g. "miber-1234". */
  mibera_id: string | null;
  pfp_url: string | null;
  /** Truncated 0x... fallback for prose when no profile found. */
  fallback: string;
  /** Resolution path for telemetry. */
  resolved_via:
    | 'direct'
    | 'additional_wallets'
    | 'unknown'
    | 'db_unavailable'
    | 'cache_hit';
}

// ─── pg pool (lazy-init) ─────────────────────────────────────────────

let pool: Pool | null = null;
let poolInitTried = false;

function getPool(): Pool | null {
  if (pool) return pool;
  if (poolInitTried) return null;
  poolInitTried = true;

  const url = process.env.RAILWAY_MIBERA_DATABASE_URL;
  if (!url) {
    console.warn(
      '[freeside_auth] RAILWAY_MIBERA_DATABASE_URL not set — resolve_wallet will return fallback only',
    );
    return null;
  }

  pool = new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Railway public proxy URLs use TLS but pg doesn't auto-detect — let
    // the URL's `?sslmode=require` drive it; if the URL omits it, fall
    // back to permissive TLS so we don't hard-fail in dev.
    ssl: url.includes('sslmode=') ? undefined : { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    console.error('[freeside_auth] pg pool error', err);
  });

  return pool;
}

// ─── LRU-ish cache (capped Map) ─────────────────────────────────────

interface CacheEntry {
  value: ResolvedWallet;
  expires_at: number;
}
const CACHE = new Map<string, CacheEntry>();
const CACHE_MAX = 1024;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min

function cacheGet(wallet: string): ResolvedWallet | null {
  const entry = CACHE.get(wallet);
  if (!entry) return null;
  if (entry.expires_at < Date.now()) {
    CACHE.delete(wallet);
    return null;
  }
  return entry.value;
}

function cachePut(wallet: string, value: ResolvedWallet): void {
  if (CACHE.size >= CACHE_MAX) {
    // Evict oldest by insertion order (Map preserves it)
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(wallet, { value, expires_at: Date.now() + CACHE_TTL_MS });
}

// ─── helpers ─────────────────────────────────────────────────────────

function truncate(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function normalize(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function rowToResolved(
  wallet: string,
  row: ProfileRow,
  resolved_via: ResolvedWallet['resolved_via'],
): ResolvedWallet {
  return {
    found: true,
    wallet,
    handle: row.display_name,
    discord_id: row.discord_id,
    discord_username: row.discord_username,
    mibera_id: row.mibera_id,
    pfp_url: row.pfp_url,
    fallback: truncate(wallet),
    resolved_via,
  };
}

// ─── core resolver ───────────────────────────────────────────────────

async function resolveWallet(walletInput: string): Promise<ResolvedWallet> {
  const wallet = normalize(walletInput);

  const cached = cacheGet(wallet);
  if (cached) return { ...cached, resolved_via: 'cache_hit' };

  const p = getPool();
  if (!p) {
    return {
      found: false,
      wallet,
      handle: null,
      discord_id: null,
      discord_username: null,
      mibera_id: null,
      pfp_url: null,
      fallback: truncate(wallet),
      resolved_via: 'db_unavailable',
    };
  }

  let client: PoolClient | null = null;
  try {
    client = await p.connect();

    // Tier 1: direct match on wallet_address
    const direct = await client.query<ProfileRow>(
      `SELECT wallet_address, display_name, discord_id, discord_username, mibera_id, pfp_url
       FROM midi_profiles
       WHERE wallet_address = $1
       LIMIT 1`,
      [wallet],
    );
    if (direct.rows.length > 0) {
      const result = rowToResolved(wallet, direct.rows[0]!, 'direct');
      cachePut(wallet, result);
      return result;
    }

    // Tier 2: linked via additional_wallets jsonb array
    const linked = await client.query<ProfileRow>(
      `SELECT wallet_address, display_name, discord_id, discord_username, mibera_id, pfp_url
       FROM midi_profiles
       WHERE additional_wallets @> $1::jsonb
       LIMIT 2`,
      [JSON.stringify([wallet])],
    );
    if (linked.rows.length === 1) {
      const result = rowToResolved(wallet, linked.rows[0]!, 'additional_wallets');
      cachePut(wallet, result);
      return result;
    }

    // Unknown wallet — cache as not-found so we don't hammer DB on repeat lookups
    const unknown: ResolvedWallet = {
      found: false,
      wallet,
      handle: null,
      discord_id: null,
      discord_username: null,
      mibera_id: null,
      pfp_url: null,
      fallback: truncate(wallet),
      resolved_via: 'unknown',
    };
    cachePut(wallet, unknown);
    return unknown;
  } catch (err) {
    console.error('[freeside_auth] resolve_wallet error', err);
    return {
      found: false,
      wallet,
      handle: null,
      discord_id: null,
      discord_username: null,
      mibera_id: null,
      pfp_url: null,
      fallback: truncate(wallet),
      resolved_via: 'db_unavailable',
    };
  } finally {
    client?.release();
  }
}

// ─── reverse resolvers (CMP-boundary 2026-05-04 · close handle/mibera→wallet gap) ──
// Operator surfaced 2026-05-04 EOD: persona PR #30 unblocks get_wallet_scorecard
// via wallet input · but operators ask "what's xabbu's score" or "MIBERA-00123 OG"
// — both require REVERSE resolution (handle/mibera-id → wallet) before scorecard
// can be called. score-mibera advertises MIBERA-XXXXXX support but returns
// `mibera_not_resolvable` (V07A4 memory: "midi_profiles lives in midi-interface
// DB which is not currently accessible from score-mibera"). freeside_auth IS
// in-bot · already holds the midi_profiles connection · these resolvers are
// single-table SELECTs. Composes with PR #30 chain-shape: persona already says
// "chain freeside_auth → get_wallet_scorecard" — this PR makes the chain start
// from handle OR mibera-id (not just wallet).

interface ResolvedReverse {
  found: boolean;
  /** Original input · handle string OR mibera_id · echoed for trace clarity. */
  query: string;
  /** Resolved wallet (lowercase normalized) when found · null otherwise. */
  wallet: string | null;
  /** Match column · 'display_name' · 'discord_username' · 'mibera_id' · null when not found. */
  matched_via:
    | 'display_name'
    | 'discord_username'
    | 'mibera_id'
    | 'unknown'
    | 'db_unavailable';
  /** Brief op-readable hint for prose · e.g. "drop the wallet directly" when not found. */
  hint?: string;
}

async function resolveHandleToWallet(handleInput: string): Promise<ResolvedReverse> {
  const handle = handleInput.trim();
  if (!handle) {
    return {
      found: false,
      query: handleInput,
      wallet: null,
      matched_via: 'unknown',
      hint: 'empty handle — provide a non-empty display_name or discord_username',
    };
  }

  const p = getPool();
  if (!p) {
    return {
      found: false,
      query: handle,
      wallet: null,
      matched_via: 'db_unavailable',
      hint: 'midi_profiles unreachable — drop the wallet 0x... directly',
    };
  }

  let client: PoolClient | null = null;
  try {
    client = await p.connect();
    // Match against display_name OR discord_username (operator-set vs Discord-canon).
    // Case-insensitive on both sides — operators write handles however they remember.
    // LIMIT 2 so we can detect ambiguity (multiple profiles with same handle).
    const rows = await client.query<{ wallet_address: string; matched_col: string }>(
      `SELECT wallet_address,
              CASE
                WHEN LOWER(display_name) = LOWER($1) THEN 'display_name'
                WHEN LOWER(discord_username) = LOWER($1) THEN 'discord_username'
                ELSE 'unknown'
              END AS matched_col
       FROM midi_profiles
       WHERE LOWER(display_name) = LOWER($1)
          OR LOWER(discord_username) = LOWER($1)
       LIMIT 2`,
      [handle],
    );

    if (rows.rows.length === 0) {
      return {
        found: false,
        query: handle,
        wallet: null,
        matched_via: 'unknown',
        hint: `no profile matched '${handle}' — verify spelling or drop the wallet 0x... directly`,
      };
    }

    if (rows.rows.length > 1) {
      return {
        found: false,
        query: handle,
        wallet: null,
        matched_via: 'unknown',
        hint: `ambiguous: '${handle}' matches multiple profiles — drop the wallet 0x... to disambiguate`,
      };
    }

    const row = rows.rows[0]!;
    return {
      found: true,
      query: handle,
      wallet: row.wallet_address,
      matched_via: row.matched_col as ResolvedReverse['matched_via'],
    };
  } catch (err) {
    console.error('[freeside_auth] resolve_handle_to_wallet error', err);
    return {
      found: false,
      query: handle,
      wallet: null,
      matched_via: 'db_unavailable',
      hint: 'midi_profiles query failed — drop the wallet 0x... directly',
    };
  } finally {
    client?.release();
  }
}

async function resolveMiberaIdToWallet(miberaInput: string): Promise<ResolvedReverse> {
  const miberaId = miberaInput.trim();
  if (!miberaId) {
    return {
      found: false,
      query: miberaInput,
      wallet: null,
      matched_via: 'unknown',
      hint: 'empty mibera_id — provide MIBERA-XXXXXX or numeric form',
    };
  }

  const p = getPool();
  if (!p) {
    return {
      found: false,
      query: miberaId,
      wallet: null,
      matched_via: 'db_unavailable',
      hint: 'midi_profiles unreachable — drop the owner wallet 0x... directly',
    };
  }

  let client: PoolClient | null = null;
  try {
    client = await p.connect();
    // Case-insensitive match against mibera_id column.
    const rows = await client.query<{ wallet_address: string }>(
      `SELECT wallet_address
       FROM midi_profiles
       WHERE LOWER(mibera_id) = LOWER($1)
       LIMIT 2`,
      [miberaId],
    );

    if (rows.rows.length === 0) {
      return {
        found: false,
        query: miberaId,
        wallet: null,
        matched_via: 'unknown',
        hint: `no profile matched mibera_id '${miberaId}' — verify format (MIBERA-XXXXXX) or drop the owner wallet directly`,
      };
    }

    if (rows.rows.length > 1) {
      return {
        found: false,
        query: miberaId,
        wallet: null,
        matched_via: 'unknown',
        hint: `ambiguous: mibera_id '${miberaId}' matches multiple profiles — drop the wallet to disambiguate`,
      };
    }

    return {
      found: true,
      query: miberaId,
      wallet: rows.rows[0]!.wallet_address,
      matched_via: 'mibera_id',
    };
  } catch (err) {
    console.error('[freeside_auth] resolve_mibera_id_to_wallet error', err);
    return {
      found: false,
      query: miberaId,
      wallet: null,
      matched_via: 'db_unavailable',
      hint: 'midi_profiles query failed — drop the owner wallet directly',
    };
  } finally {
    client?.release();
  }
}

function ok(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

// ─── MCP server ──────────────────────────────────────────────────────

export const freesideAuthServer = createSdkMcpServer({
  name: 'freeside_auth',
  version: '0.1.0',
  tools: [
    tool(
      'resolve_wallet',
      'Resolves a wallet address to user-overlay data (handle/display name, discord, mibera_id, pfp). Returns `found: false` + `fallback: "0xb307...d8"` when the wallet is unknown OR when the auth DB is unavailable. Call this BEFORE citing a wallet in prose so readers see "@nomadbera" instead of "0xb307...d8". Reads canonical midi_profiles from Railway Postgres; cached 5min.',
      {
        wallet: z.string().describe('Ethereum wallet address (any case). Will be normalized lowercase internally.'),
      },
      async ({ wallet }) => {
        const result = await resolveWallet(wallet);
        return ok(result);
      },
    ),

    tool(
      'resolve_wallets',
      'Batch wallet resolver — call once with a list when composing a digest that mentions multiple wallets. Returns array; same shape as resolve_wallet per entry. More efficient than per-wallet calls.',
      {
        wallets: z.array(z.string()),
      },
      async ({ wallets }) => {
        const results = await Promise.all(wallets.map((w) => resolveWallet(w)));
        return ok(results);
      },
    ),

    tool(
      'resolve_handle_to_wallet',
      'REVERSE resolver — handle (display_name OR discord_username) → wallet address. Use when an operator asks about a NAMED user ("xabbu", "@nomadbera") and you need the wallet to chain into get_wallet_scorecard or other wallet-keyed lookups. Returns `found: false` with a `hint` field if the handle is unknown, ambiguous (matches multiple profiles), or DB unavailable. Case-insensitive match on both display_name and discord_username columns.',
      {
        handle: z
          .string()
          .describe(
            'Display name or Discord username (case-insensitive · trimmed). Without @ prefix typically.',
          ),
      },
      async ({ handle }) => {
        const result = await resolveHandleToWallet(handle);
        return ok(result);
      },
    ),

    tool(
      'resolve_mibera_id_to_wallet',
      'REVERSE resolver — Mibera ID (MIBERA-XXXXXX or alternate forms) → owner wallet address. Use when an operator references a Mibera by ID and you need the owner wallet to chain into get_wallet_scorecard. Bridges the gap that score-mibera explicitly cannot cross (score-api returns `mibera_not_resolvable` because midi_profiles lives in midi-interface DB · this resolver IS in-bot with that DB connection). Returns `found: false` + `hint` when unknown/ambiguous/db-unavailable.',
      {
        mibera_id: z
          .string()
          .describe(
            'Mibera ID — typically MIBERA-XXXXXX (case-insensitive). Trimmed before lookup.',
          ),
      },
      async ({ mibera_id }) => {
        const result = await resolveMiberaIdToWallet(mibera_id);
        return ok(result);
      },
    ),
  ],
});

// Exported for tests / inspection
export { resolveWallet, resolveHandleToWallet, resolveMiberaIdToWallet };
