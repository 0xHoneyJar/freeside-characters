/**
 * identity-link.live.test.ts — the LIVE identity reader (cycle-010 "wire it").
 * Network-free (stub resolver). Proves: it resolves Phase-A candidate wallets,
 * emits a link per discord-paired wallet, skips Solana wallets (EVM-keyed DB) +
 * unlinked, and the emitted links drive a real wallet↔discord stitch end-to-end.
 */
import { describe, expect, test } from "bun:test";
import { makeIdentityLinkProducer } from "./identity-link-producer.ts";
import { makeIdentityLinkReaderLive, type ResolvedWalletLink } from "./identity-link.live.ts";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import type { ShadowSubject } from "./shadow-mode-contract.ts";
import type { SourceProducer, WorldRef } from "./source-producer.ts";
import { makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";

const WORLD: WorldRef = {
  community_id: "mibera",
  world_slug: "mibera",
  guild_id: "g1",
  namespace_prefix: "mibera:",
  watched_contracts: ["0xCAFE"],
  score_community_slug: "mibera",
};
const at = () => "2026-06-29T00:00:00.000Z";

function subj(over: Partial<ShadowSubject>): ShadowSubject {
  return {
    subject_id: `s_${over.subject_id ?? "1"}`,
    community_id: "mibera",
    kind: "wallet_only",
    wallets: [],
    aliases: [],
    current_roles: [],
    incumbent_roles: [],
    freeside_roles: [],
    ...over,
  };
}

describe("makeIdentityLinkReaderLive", () => {
  test("emits a link per discord-paired wallet; skips unlinked + Solana", async () => {
    const candidates: ShadowSubject[] = [
      subj({ subject_id: "evm-linked", wallets: [{ address: "0xAbC" }] }),
      subj({ subject_id: "evm-unlinked", wallets: [{ address: "0xDeF" }] }),
      subj({ subject_id: "sol", wallets: [{ address: "SoLaNaCaseSensitive", chain: "solana" }] }),
    ];
    const resolveWallets = async (wallets: ReadonlyArray<string>): Promise<ResolvedWalletLink[]> => {
      // EVM wallets are lowercased by the reader; Solana must NOT appear
      expect(wallets).toContain("0xabc");
      expect(wallets).toContain("0xdef");
      expect(wallets.some((w) => w.toLowerCase().includes("solana"))).toBe(false);
      return [
        { wallet: "0xabc", discord_id: "111" },
        { wallet: "0xdef", discord_id: null }, // unlinked
      ];
    };
    const reader = makeIdentityLinkReaderLive({ resolveWallets, getCandidates: () => candidates });
    const links = await reader(WORLD);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ user_id: "wd:111", discord_user_id: "111" });
    expect(links[0].wallet?.address).toBe("0xabc");
  });

  test("no candidate wallets → no resolve call, no links", async () => {
    let called = false;
    const reader = makeIdentityLinkReaderLive({
      resolveWallets: async () => {
        called = true;
        return [];
      },
      getCandidates: () => [],
    });
    expect(await reader(WORLD)).toEqual([]);
    expect(called).toBe(false);
  });

  test("end-to-end: live links stitch wallet_only + discord_member → identity_user", async () => {
    // Phase A producers: a discord member + an on-chain holder of the same wallet.
    const discord: SourceProducer = {
      kind: "discord",
      criticality: "required",
      phase: "A",
      async produce() {
        return [
          makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
            "discord.member.snapshot.v1",
            { discord_user_id: "111", display_name: "ada", role_ids: [] },
            { community_id: "mibera", source: "discord", truth_status: "observed_only", observed_at: at(), emitted_at: at() },
          ),
        ];
      },
    };
    const onchain: SourceProducer = {
      kind: "sonar",
      criticality: "optional",
      phase: "A",
      async produce() {
        return [
          makeEvent<Extract<ShadowEvent, { name: "sonar.wallet.attributed.v1" }>>(
            "sonar.wallet.attributed.v1",
            { wallet: { address: "0xabc" }, contract_address: "0xCAFE", edge_kind: "held_at_snapshot" },
            { community_id: "mibera", source: "sonar", truth_status: "observed_only", observed_at: at(), emitted_at: at() },
          ),
        ];
      },
    };
    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const liveReader = makeIdentityLinkReaderLive({
      resolveWallets: async () => [{ wallet: "0xabc", discord_id: "111" }],
      getCandidates: () => ledger.ledgerStore.subjects("mibera"), // Phase-A state at Phase-B time
    });
    const identity = makeIdentityLinkProducer({ readLinks: liveReader, observedAt: at });

    await new IngestionOrchestrator(ledger, [discord, onchain, identity]).run(WORLD);

    const subjects = ledger.getMemberGraph("mibera").subjects;
    const id = subjects.find((s) => s.kind === "identity_user");
    expect(id).toBeDefined();
    expect(id!.discord_user_id).toBe("111");
    expect(id!.wallets.some((w) => w.address === "0xabc")).toBe(true);
  });
});
