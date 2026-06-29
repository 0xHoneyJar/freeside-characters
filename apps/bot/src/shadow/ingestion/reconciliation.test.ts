/**
 * reconciliation.test.ts — the full multi-angle graph + takeover-safety
 * (cycle-010 S2.2/S2.3/S2.6; SDD §4.4). Network-free. Proves:
 *  - G2: discord + on-chain + identity → discord_member, wallet_only, identity_user.
 *  - R4: a wallet already bound to identity A, re-linked to B → NO stitch,
 *        quarantined, no eligibility leaked (the account-takeover shape).
 */
import { describe, expect, test } from "bun:test";
import { makeEvent } from "./event.ts";
import { makeIdentityLinkProducer } from "./identity-link-producer.ts";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { makeOnChainHolderProducer } from "./onchain-holder-producer.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import { walletAlias, type ShadowEvent } from "./shadow-mode-contract.ts";
import type { SourceProducer, WorldRef } from "./source-producer.ts";

const WORLD: WorldRef = {
  community_id: "pythenian",
  world_slug: "pythenian",
  guild_id: "g1",
  namespace_prefix: "pythenian:",
  watched_contracts: ["0xCAFE"],
  score_community_slug: "pythenian",
};
const at = () => "2026-06-29T00:00:00.000Z";

function discordProducer(discordId: string): SourceProducer {
  return {
    kind: "discord",
    criticality: "required",
    phase: "A",
    async produce() {
      return [
        makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
          "discord.member.snapshot.v1",
          { discord_user_id: discordId, display_name: "ada", role_ids: [] },
          { community_id: "pythenian", source: "discord", truth_status: "observed_only", observed_at: at(), emitted_at: at() },
        ),
      ];
    },
  };
}
function sonarStub(holders: Array<{ address: string; contract: string; tokenCount: number }>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ data: { TrackedHolder: holders } }), { status: 200 })) as unknown as typeof fetch;
}

describe("multi-angle reconciliation", () => {
  test("G2: three angles → discord_member + wallet_only + reconciled identity_user", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const onchain = makeOnChainHolderProducer({
      sonar: { endpoint: "https://x/v1/graphql", doFetch: sonarStub([{ address: "0xW", contract: "0xCAFE", tokenCount: 1 }]) },
      observedAt: at,
    });
    const identity = makeIdentityLinkProducer({
      readLinks: async () => [{ user_id: "u1", wallet: { address: "0xW" }, discord_user_id: "111" }],
      observedAt: at,
    });
    const summary = await new IngestionOrchestrator(ledger, [discordProducer("111"), onchain, identity]).run(WORLD);
    expect(summary.degraded).toBe(false);

    const subjects = ledger.getMemberGraph("pythenian").subjects;
    const identitySubject = subjects.find((s) => s.kind === "identity_user");
    expect(identitySubject).toBeDefined();
    // the identity absorbed both the wallet and the discord id
    expect(identitySubject!.wallets.some((w) => w.address === "0xW")).toBe(true);
    expect(identitySubject!.discord_user_id).toBe("111");
  });

  test("R4 takeover: a wallet owned by identity A cannot be re-stitched to B", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const store = (ledger as unknown as { ledgerStore: InMemoryLedgerStore }).ledgerStore;

    // A already owns wallet 0xW (seed an identity_user subject bound to it)
    store.upsertSubject({
      subject_id: "subA",
      community_id: "pythenian",
      kind: "identity_user",
      identity_user_id: "A",
      wallets: [{ address: "0xW" }],
      aliases: [walletAlias({ address: "0xW" }), "identity:A"],
      current_roles: [],
      incumbent_roles: [],
      freeside_roles: [],
    });

    // B now attempts to link the same wallet
    const identityB = makeIdentityLinkProducer({
      readLinks: async () => [{ user_id: "B", wallet: { address: "0xW" } }],
      observedAt: at,
    });
    const summary = await new IngestionOrchestrator(ledger, [identityB]).run(WORLD);

    expect(summary.quarantined).toBe(1); // the stitch was REFUSED
    // wallet still owned by A — not re-pointed to B
    const owner = store.findSubjectByAlias("pythenian", walletAlias({ address: "0xW" }));
    expect(owner!.identity_user_id).toBe("A");
    // B did not gain a subject that owns the contested wallet
    const bSubject = store.findSubjectByAlias("pythenian", "identity:B");
    expect(bSubject?.wallets?.some((w) => w.address === "0xW") ?? false).toBe(false);
  });
});
