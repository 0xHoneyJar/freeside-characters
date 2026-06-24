/**
 * WalletResolver port — CLAUDE.md wallet redaction requirement (NFR-29).
 *
 * Per CLAUDE.md "Don't do" rule:
 *   "Cite raw `0x…` wallets in prose without first calling
 *    `mcp__freeside_auth__resolve_wallet`"
 *
 * This port is MANDATORY in the narration path. Router calls
 * `resolve(wallet)` BEFORE composer renders narration. Cache miss + MCP
 * failure path returns the anonymized identity (NEVER raw 0x…).
 *
 * Cache: 200-item LRU · 10-min TTL.
 *
 * Flatline SDD SKP-001 (900): added in pair-point 4 (sdd construct sweep)
 * because the brief omitted this wiring — a CRITICAL CLAUDE.md violation
 * if shipped as-is.
 */

import { Context, Effect } from "effect";
import type { Wallet } from "../domain/event.ts";

export interface WalletIdentity {
  readonly wallet_address: string;
  readonly discord_handle: string | null;
  readonly display_handle: string | null;
  readonly mibera_id: number | null;
  readonly midi_profile_url: string | null;
}

/** Fallback identity used on resolver failure (NFR-29). NEVER leak raw 0x…. */
export const ANONYMOUS_KEEPER: WalletIdentity = {
  wallet_address: "redacted",
  discord_handle: null,
  display_handle: "an anonymous keeper",
  mibera_id: null,
  midi_profile_url: null,
};

export interface WalletResolverError {
  readonly _tag: "WalletResolverError";
  readonly reason: "timeout" | "transport" | "not_found";
  readonly message: string;
}

export class WalletResolver extends Context.Tag("ambient/WalletResolver")<
  WalletResolver,
  {
    /** Resolve a wallet to its display identity. Adapter falls back to
     * ANONYMOUS_KEEPER on cache miss + MCP failure — narrators receive
     * either a real handle OR the anonymous keeper, NEVER raw `0x…`. */
    readonly resolve: (wallet: Wallet) => Effect.Effect<WalletIdentity>;

    /** Invalidate cache for a wallet (used after reveal/burn events that
     * may change ownership state). */
    readonly invalidate: (wallet: Wallet) => Effect.Effect<void>;
  }
>() {}
