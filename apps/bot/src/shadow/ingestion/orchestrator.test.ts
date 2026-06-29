/**
 * orchestrator.test.ts — two-phase execution (cycle-010 S1.4; SDD §4.3) +
 * idempotency (S1.6) + degraded posture (SKP-002/780). Network-free.
 *
 * The ordering test is MECHANICAL (SKP-001/870 demanded "not just observed"):
 * the identity (Phase B) producer captures the ledger's subject kinds AT
 * produce-time and we assert the Phase-A subjects were already committed.
 */
import { describe, expect, test } from "bun:test";
import { makeEvent } from "./event.ts";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { SourceProducer, WorldRef } from "./source-producer.ts";

const WORLD: WorldRef = {
  community_id: "pythenian",
  world_slug: "pythenian",
  guild_id: "g1",
  namespace_prefix: "pythenian:",
  watched_contracts: ["0xabc"],
  score_community_slug: "pythenian",
};
const ts = { observed_at: "2026-06-29T00:00:00.000Z", emitted_at: "2026-06-29T00:00:00.000Z" };

function discordProducer(): SourceProducer {
  return {
    kind: "discord",
    criticality: "required",
    phase: "A",
    async produce() {
      return [
        makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
          "discord.member.snapshot.v1",
          { discord_user_id: "111", display_name: "ada", role_ids: [] },
          { community_id: "pythenian", source: "discord", truth_status: "observed_only", ...ts },
        ),
      ];
    },
  };
}
function sonarProducer(): SourceProducer {
  return {
    kind: "sonar",
    criticality: "optional",
    phase: "A",
    async produce() {
      return [
        makeEvent<Extract<ShadowEvent, { name: "sonar.wallet.attributed.v1" }>>(
          "sonar.wallet.attributed.v1",
          { wallet: { address: "0xWALLET" }, contract_address: "0xabc", edge_kind: "held_at_snapshot" },
          { community_id: "pythenian", source: "sonar", truth_status: "observed_only", ...ts },
        ),
      ];
    },
  };
}

describe("IngestionOrchestrator two-phase", () => {
  test("Phase A subjects are committed BEFORE Phase B (identity) runs", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    let kindsSeenWhenIdentityRan: string[] = [];

    const identityProducer: SourceProducer = {
      kind: "identity",
      criticality: "required",
      phase: "B",
      async produce() {
        // capture what the ledger already holds at Phase-B produce-time
        kindsSeenWhenIdentityRan = ledger
          .getMemberGraph("pythenian")
          .subjects.map((s) => s.kind)
          .sort();
        return [
          makeEvent<Extract<ShadowEvent, { name: "identity.wallet.linked.v1" }>>(
            "identity.wallet.linked.v1",
            { user_id: "u1", wallet: { address: "0xWALLET" } },
            { community_id: "pythenian", source: "identity", truth_status: "verified", ...ts },
          ),
        ];
      },
    };

    const orch = new IngestionOrchestrator(ledger, [
      discordProducer(),
      sonarProducer(),
      identityProducer,
    ]);
    const summary = await orch.run(WORLD);

    // mechanical ordering proof: discord + sonar subjects existed before identity ran
    expect(kindsSeenWhenIdentityRan).toContain("discord_member");
    expect(kindsSeenWhenIdentityRan).toContain("wallet_only");
    expect(summary.degraded).toBe(false);

    // and the stitch produced an identity_user that absorbed the wallet
    const subjects = ledger.getMemberGraph("pythenian").subjects;
    const identity = subjects.find((s) => s.kind === "identity_user");
    expect(identity).toBeDefined();
    expect(identity!.wallets.some((w) => w.address === "0xWALLET")).toBe(true);
  });

  test("idempotency: a second run ingests nothing new (S1.6)", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const producers = [discordProducer(), sonarProducer()];
    const orch = new IngestionOrchestrator(ledger, producers);

    const first = await orch.run(WORLD);
    expect(first.ingested).toBeGreaterThan(0);

    const second = await orch.run(WORLD);
    expect(second.ingested).toBe(0);
    expect(second.duplicates).toBe(first.ingested);
  });

  test("degraded: a required producer failing marks the run degraded", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const failing: SourceProducer = {
      kind: "discord",
      criticality: "required",
      phase: "A",
      async produce() {
        throw new Error("discord gateway down");
      },
    };
    const orch = new IngestionOrchestrator(ledger, [failing, sonarProducer()]);
    const summary = await orch.run(WORLD);
    expect(summary.degraded).toBe(true);
    expect(summary.sources.find((s) => s.kind === "discord")!.status).toBe("error");
  });

  test("per-producer timeout: a hung producer is isolated, not fatal", async () => {
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const hung: SourceProducer = {
      kind: "sonar",
      criticality: "optional",
      phase: "A",
      produce: () => new Promise(() => {}), // never resolves
    };
    const orch = new IngestionOrchestrator(ledger, [discordProducer(), hung], {
      perProducerTimeoutMs: 20,
    });
    const summary = await orch.run(WORLD);
    expect(summary.timed_out).toBe(true);
    expect(summary.degraded).toBe(false); // sonar is optional
    expect(summary.sources.find((s) => s.kind === "sonar")!.status).toBe("timeout");
  });
});
