/**
 * resolve-nft-pfp — consume the `inventory-api` building (in-process) for a
 * wallet's NFT profile picture. Issue #87 / consume-pattern two-organ brief
 * (grimoires/loa/context/consume-pattern-two-organ.md): the consume HOT-PATH is
 * a typed call, not a per-verb MCP tool-call — the deterministic "code-mode"
 * organ. Discovery (registry/beacons) is the other organ; not this path.
 *
 * FAIL-SOFT (ADR-008 §D-4): inventory-api is a sibling building. If it's
 * unavailable, errors, or is slow, we return null and the caller falls back to
 * the freeside_auth DB pfp / handle — the spotlight is degraded, never broken,
 * and NEVER "an anonymous mibera" purely because a building stalled.
 *
 * The import is lazy + the specifier is dynamic so persona-engine builds even
 * when @0xhoneyjar/inventory isn't installed yet (declared as a dep; resolves at
 * runtime). The V2 arc moves this to the gateway capability-safe runtime.
 */

export type NftPfpResolver = (wallet: string) => Promise<string | null>;

/** Bounded like resolveWallet (server.ts) — a slow building must not wedge a digest zone. */
const NFT_PFP_TIMEOUT_MS = 3_000;

interface InventoryModule {
  getProfilePicture(wallet: string, options?: { contract?: string }): Promise<string | null>;
}

export const resolveNftPfp: NftPfpResolver = async (wallet) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Dynamic specifier (`as string`) — not statically resolved, so the package
    // builds without @0xhoneyjar/inventory present; runtime resolves the dep.
    const mod = (await import('@0xhoneyjar/inventory' as string)) as unknown as InventoryModule;
    return await Promise.race([
      mod.getProfilePicture(wallet),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), NFT_PFP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null; // building unavailable / errored — fail-soft to DB/handle
  } finally {
    if (timer) clearTimeout(timer);
  }
};
