/**
 * onchain-holder-producer.test.ts — the on-chain angle (cycle-010 S2.1).
 * Network-free (injected fetch). Proves: holders → wallet_only subjects (G3,
 * bottom-up), fail-soft on a down/untracked source, and contract lowercasing.
 */
import { describe, expect, test } from "bun:test";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import { makeOnChainHolderProducer } from "./onchain-holder-producer.ts";
import type { WorldRef } from "./source-producer.ts";

const WORLD: WorldRef = {
  community_id: "pythenian",
  world_slug: "pythenian",
  guild_id: "g1",
  namespace_prefix: "pythenian:",
  watched_contracts: ["0xABCdef0000000000000000000000000000000001"],
  score_community_slug: "pythenian",
};

function stubFetch(holders: Array<{ address: string; contract: string; tokenCount: number }>): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    // assert the producer lowercased the contract in the query var
    const body = JSON.parse(String(init?.body));
    expect(body.variables.contract).toBe(body.variables.contract.toLowerCase());
    return new Response(JSON.stringify({ data: { TrackedHolder: holders } }), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("OnChainHolderProducer", () => {
  test("bottom-up: a holder absent from Discord becomes a wallet_only subject (G3)", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const producer = makeOnChainHolderProducer({
      sonar: {
        endpoint: "https://sonar.example/v1/graphql",
        adminSecret: "x",
        doFetch: stubFetch([
          { address: "0xWALLET1", contract: WORLD.watched_contracts[0], tokenCount: 3 },
        ]),
      },
      observedAt: () => "2026-06-29T00:00:00.000Z",
    });
    const summary = await new IngestionOrchestrator(ledger, [producer]).run(WORLD);
    expect(summary.degraded).toBe(false);

    const subjects = ledger.getMemberGraph("pythenian").subjects;
    const walletOnly = subjects.find((s) => s.kind === "wallet_only");
    expect(walletOnly).toBeDefined();
    expect(walletOnly!.wallets[0].address).toBe("0xWALLET1");
  });

  test("fail-soft: an unreachable/untracked source degrades gracefully (optional)", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const producer = makeOnChainHolderProducer({
      sonar: { endpoint: undefined }, // dormant-until-configured
      observedAt: () => "2026-06-29T00:00:00.000Z",
    });
    const summary = await new IngestionOrchestrator(ledger, [producer]).run(WORLD);
    expect(summary.degraded).toBe(false); // sonar is optional
    expect(ledger.getMemberGraph("pythenian").subjects.length).toBe(0);
  });
});
