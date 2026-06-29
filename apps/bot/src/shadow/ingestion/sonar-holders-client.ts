/**
 * ingestion/sonar-holders-client.ts — the on-chain holder source (cycle-010 S2.1;
 * SDD §4.1b). Reads "holders of a contract" from the live sonar belt-hasura
 * GraphQL (`TrackedHolder`), confirmed against `sonar.0xhoneyjar.xyz/v1/graphql`
 * (see NOTES.md GATE-HOLDER resolved).
 *
 * READ-ONLY. FAIL-SOFT (mirrors inventory-http-client posture): missing config,
 * non-OK status, timeout, or any throw → returns `[]` for that contract — the
 * orchestrator marks the source degraded/stale, never crashes the run. The
 * `doFetch` is injected so tests are network-free.
 *
 * VOICELESS: a structural GraphQL read → holder rows. No persona.
 */

export interface SonarHolder {
  readonly address: string;
  readonly contract: string;
  readonly token_count: number;
}

export interface SonarHoldersClientConfig {
  /** e.g. https://sonar.0xhoneyjar.xyz/v1/graphql ; absent → fail-soft empty. */
  readonly endpoint?: string;
  /** x-hasura-admin-secret (absent → request sent without it). */
  readonly adminSecret?: string;
  readonly doFetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const QUERY = `query Holders($contract: String!) {
  TrackedHolder(where: { contract: { _eq: $contract }, tokenCount: { _gt: 0 } }) {
    address
    contract
    tokenCount
  }
}`;

/**
 * Fetch the holders of one contract. Contract is lowercased (the belt-hasura
 * index stores lowercase; case-sensitive `_eq` would 0-match a checksummed addr).
 */
export async function fetchSonarHolders(
  contract: string,
  cfg: SonarHoldersClientConfig,
): Promise<ReadonlyArray<SonarHolder>> {
  const endpoint = cfg.endpoint?.trim();
  if (!endpoint) return []; // dormant-until-configured (CI/dev), by design
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
      body: JSON.stringify({
        query: QUERY,
        variables: { contract: contract.toLowerCase() },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { TrackedHolder?: Array<{ address: string; contract: string; tokenCount: number }> };
      errors?: unknown;
    };
    if (json.errors || !json.data?.TrackedHolder) return [];
    return json.data.TrackedHolder.map((h) => ({
      address: h.address,
      contract: h.contract,
      token_count: h.tokenCount,
    }));
  } catch {
    return []; // fail-soft on timeout / network / parse
  } finally {
    clearTimeout(timer);
  }
}
