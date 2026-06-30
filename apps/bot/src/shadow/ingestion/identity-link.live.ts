/**
 * ingestion/identity-link.live.ts — the LIVE identity-link reader (cycle-010
 * "wire it"). Resolves wallet↔discord links over the Phase-A candidates and
 * feeds them to `IdentityLinkProducer` (SDD §4.1c / §4.4).
 *
 * REUSES the blessed link seam, NOT a new identity-api client (avoids the config
 * sprawl the operator flagged): the injected `resolveWallets` is the existing
 * shadow `wallet-discord-link.live.ts` resolver (freeside_auth / midi_profiles,
 * cached, fail-soft). The CLI wires the production default; this module stays
 * decoupled (injected) + VOICELESS (no persona / freeside_auth static import).
 *
 * Identity anchoring: freeside_auth pairs wallet↔discord directly (no separate
 * user_id), so we anchor the canonical identity on the discord snowflake
 * (`wd:<discord_id>`) — emitting BOTH a wallet-link and an account-link with that
 * id makes the ledger reducer stitch the wallet_only + discord_member subjects
 * into one identity_user.
 *
 * Phase B runs after Phase A commits, so `getCandidates()` sees the discord +
 * on-chain subjects already in the ledger.
 */
import type { IdentityLink, IdentityLinkReader } from "./identity-link-producer.ts";
import type { ShadowSubject } from "./shadow-mode-contract.ts";

/** One wallet's resolution (mirrors wallet-discord-link.live.ts ResolvedWalletLike). */
export interface ResolvedWalletLink {
  readonly wallet: string;
  readonly discord_id: string | null;
}
/** Injected batch resolver — the production default is wallet-discord-link.live.ts. */
export type WalletLinkResolver = (
  wallets: ReadonlyArray<string>,
) => Promise<ReadonlyArray<ResolvedWalletLink>>;

export interface IdentityLinkReaderLiveDeps {
  readonly resolveWallets: WalletLinkResolver;
  /** Phase-A subjects (CLI passes `() => ledger.ledgerStore.subjects(cid)`). */
  readonly getCandidates: () => ReadonlyArray<ShadowSubject>;
  /** bound the resolve fan-out (R-4); default 2000. */
  readonly maxResolve?: number;
}

/**
 * Build a LIVE `IdentityLinkReader`. Collects the EVM wallets from the Phase-A
 * candidates (freeside_auth/midi_profiles is EVM-keyed — Solana wallets won't
 * resolve, which is the correct "not linked yet" state for a fresh SVM community),
 * resolves them, and emits a link per wallet that has a discord pairing.
 */
export function makeIdentityLinkReaderLive(deps: IdentityLinkReaderLiveDeps): IdentityLinkReader {
  const cap = deps.maxResolve ?? 2000;
  return async (): Promise<ReadonlyArray<IdentityLink>> => {
    const candidates = deps.getCandidates();
    const wallets = [
      ...new Set(
        candidates
          .flatMap((s: ShadowSubject) => s.wallets)
          .filter((w) => w.chain !== "solana") // EVM-keyed identity DB
          .map((w) => w.address.toLowerCase()),
      ),
    ].slice(0, cap);
    if (!wallets.length) return [];

    const resolved = await deps.resolveWallets(wallets);
    const links: IdentityLink[] = [];
    for (const r of resolved) {
      if (!r.discord_id) continue; // unlinked / unresolved → skip
      links.push({
        user_id: `wd:${r.discord_id}`, // anchor identity on the discord snowflake
        wallet: { address: r.wallet },
        discord_user_id: r.discord_id,
      });
    }
    return links;
  };
}
