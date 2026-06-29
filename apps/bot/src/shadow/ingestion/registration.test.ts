/**
 * registration.test.ts — community bring-up (cycle-010 S4.1/S4.2; FR-1/FR-7).
 * Proves: fail-closed validation, privileged authz (SKP-005), runtime-JSON
 * persistence, and the Phytians config-only path register → ingest →
 * member graph (G5; fixture producers = the demote-to-demo gate). Network-free.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { makeEvent } from "./event.ts";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import { makeOnChainHolderProducer } from "./onchain-holder-producer.ts";
import { RegistrationError, missingFields, registerCommunity, type RegistrationPayload } from "./registration.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { SourceProducer } from "./source-producer.ts";

const TMP = join(".run", "shadow", "communities", "__test__");
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const PHYTIAN: RegistrationPayload = {
  community_id: "phytian",
  world_slug: "phytian",
  discord_guild_id: "999000111222333444",
  namespace_prefix: "phytian:",
  collection_contracts: ["0x144b27b1a267ee71989664b3907030da84cc4754"],
  score_community_slug: "phytian",
  identity_authority: "freeside",
};
const OPTS = { caller: "operator-1", admin_principals: ["operator-1"], registryDir: TMP, observedAt: () => "2026-06-29T00:00:00.000Z" };

describe("registerCommunity", () => {
  test("fail-closed: missing required fields are refused, listed", () => {
    const partial = { community_id: "x", world_slug: "x" };
    expect(missingFields(partial)).toContain("discord_guild_id");
    expect(() => registerCommunity(partial, OPTS)).toThrow(RegistrationError);
    try {
      registerCommunity(partial, OPTS);
    } catch (e) {
      expect((e as RegistrationError).reason).toBe("missing_fields");
      expect((e as RegistrationError).missing).toContain("collection_contracts");
    }
  });

  test("privileged: a non-admin caller is rejected (SKP-005)", () => {
    expect(() =>
      registerCommunity(PHYTIAN, { ...OPTS, caller: "rando", admin_principals: ["operator-1"] }),
    ).toThrow(/not an admin principal/);
  });

  test("valid registration derives a WorldRef + emits config event + persists", () => {
    const res = registerCommunity(PHYTIAN, OPTS);
    expect(res.world.community_id).toBe("phytian");
    expect(res.world.watched_contracts).toEqual(PHYTIAN.collection_contracts);
    expect(res.event.name).toBe("community.config.updated.v1");
    expect(res.config_path).toContain("phytian.json");
  });

  test("Phytians config-only bring-up: register → ingest → member graph (G5 demo)", async () => {
    const { world } = registerCommunity(PHYTIAN, OPTS);

    // a fixture Discord producer + a stubbed on-chain producer = the demote-to-demo
    // path (no live data dependency); proves the wiring end-to-end.
    const discord: SourceProducer = {
      kind: "discord",
      criticality: "required",
      phase: "A",
      async produce() {
        return [
          makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
            "discord.member.snapshot.v1",
            { discord_user_id: "111", display_name: "ada", role_ids: [] },
            { community_id: "phytian", source: "discord", truth_status: "observed_only", observed_at: "t", emitted_at: "t" },
          ),
        ];
      },
    };
    const onchain = makeOnChainHolderProducer({
      sonar: {
        endpoint: "https://x/v1/graphql",
        doFetch: (async () =>
          new Response(
            JSON.stringify({ data: { TrackedHolder: [{ address: "0xHOLDER", contract: world.watched_contracts[0], tokenCount: 2 }] } }),
            { status: 200 },
          )) as unknown as typeof fetch,
      },
      observedAt: () => "2026-06-29T00:00:00.000Z",
    });

    const ledger = new ShadowLedger(new InMemoryLedgerStore());
    const summary = await new IngestionOrchestrator(ledger, [discord, onchain]).run(world);
    expect(summary.degraded).toBe(false);

    const subjects = ledger.getMemberGraph("phytian").subjects;
    expect(subjects.some((s) => s.kind === "discord_member")).toBe(true);
    expect(subjects.some((s) => s.kind === "wallet_only")).toBe(true); // bottom-up holder
  });
});
