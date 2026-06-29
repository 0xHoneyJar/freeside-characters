/**
 * ingestion/sonar-holders-client.ts — the on-chain holder source (cycle-010 S2.1;
 * SDD §4.1b). Reads "holders of a watched collection" from the live sonar
 * belt-hasura GraphQL, dispatching by identifier shape (confirmed against
 * `sonar.0xhoneyjar.xyz/v1/graphql`, see NOTES.md GATE-HOLDER):
 *   • EVM contract (`0x…`)        → `TrackedHolder(contract)` → checksum-insensitive.
 *   • Solana collection_key (else) → `svm_collection_owner_derived(collection_key)`
 *                                    → distinct owners; addresses are CASE-SENSITIVE.
 *
 * READ-ONLY. FAIL-SOFT (mirrors inventory-http-client): missing config / non-OK /
 * timeout / throw → `[]` for that identifier; the orchestrator marks the source
 * degraded/stale, never crashes. `doFetch` injected for network-free tests.
 *
 * VOICELESS.
 */

export interface SonarHolder {
  readonly address: string;
  /** the watched-collection identifier this holder was attributed under. */
  readonly collection: string;
  readonly token_count: number;
  /** 'solana' for SVM holders; undefined for EVM (drives chain-aware aliasing). */
  readonly chain?: "solana";
}

export interface SonarHoldersClientConfig {
  /** e.g. https://sonar.0xhoneyjar.xyz/v1/graphql ; absent → fail-soft empty. */
  readonly endpoint?: string;
  readonly adminSecret?: string;
  readonly doFetch?: typeof fetch;
  readonly timeoutMs?: number;
  /** bound the holder set (R-4 no-pagination); default 10_000. */
  readonly maxHolders?: number;
}

const EVM_QUERY = `query Evm($contract: String!, $limit: Int!) {
  TrackedHolder(where: { contract: { _eq: $contract }, tokenCount: { _gt: 0 } }, limit: $limit) {
    address
    contract
    tokenCount
  }
}`;

const SVM_QUERY = `query Svm($key: String!, $limit: Int!) {
  svm_collection_owner_derived(where: { collection_key: { _eq: $key } }, distinct_on: owner, limit: $limit) {
    owner
    collection_key
  }
}`;

// EVM contracts start `0x`; Solana base58 collection_keys/mints never do (base58
// excludes '0'), so the `0x` prefix is an unambiguous discriminator.
const isEvmContract = (id: string): boolean => id.trim().toLowerCase().startsWith("0x");

async function gql(
  cfg: SonarHoldersClientConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown | null> {
  const endpoint = cfg.endpoint?.trim();
  if (!endpoint) return null; // dormant-until-configured, by design
  const doFetch = cfg.doFetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 20_000);
  try {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.adminSecret ? { "x-hasura-admin-secret": cfg.adminSecret } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: unknown; errors?: unknown };
    if (json.errors || !json.data) return null;
    return json.data;
  } catch {
    return null; // fail-soft
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the holders of one watched collection. EVM contract → checksum-insensitive
 * (lowercased); Solana collection_key → distinct owners (case preserved).
 */
export async function fetchSonarHolders(
  identifier: string,
  cfg: SonarHoldersClientConfig,
): Promise<ReadonlyArray<SonarHolder>> {
  const limit = cfg.maxHolders ?? 10_000;
  if (isEvmContract(identifier)) {
    const data = (await gql(cfg, EVM_QUERY, { contract: identifier.toLowerCase(), limit })) as {
      TrackedHolder?: Array<{ address: string; contract: string; tokenCount: number }>;
    } | null;
    return (data?.TrackedHolder ?? []).map((h) => ({
      address: h.address,
      collection: h.contract,
      token_count: h.tokenCount,
    }));
  }
  // Solana collection_key (e.g. "pythians").
  const data = (await gql(cfg, SVM_QUERY, { key: identifier, limit })) as {
    svm_collection_owner_derived?: Array<{ owner: string; collection_key: string }>;
  } | null;
  return (data?.svm_collection_owner_derived ?? []).map((h) => ({
    address: h.owner, // base58 — case preserved
    collection: h.collection_key,
    token_count: 1, // distinct owner holds ≥1; per-owner count is a follow
    chain: "solana" as const,
  }));
}
