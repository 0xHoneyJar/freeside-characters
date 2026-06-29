/**
 * registration.test.ts — manifest-driven community bring-up (cycle-010 S4.1/S4.2;
 * FR-1/FR-7). The world manifest is the SINGLE config source (operator feedback:
 * no parallel .run store). Proves: fail-closed on an incomplete/placeholder
 * manifest, privileged authz (SKP-005), and the config-only register → ingest →
 * member graph path (G5). Network/fs-free (injected manifest reader).
 */
import { describe, expect, test } from "bun:test";
import { makeEvent } from "./event.ts";
import { InMemoryLedgerStore, ShadowLedger } from "./ledger-host.ts";
import { IngestionOrchestrator } from "./orchestrator.ts";
import { makeOnChainHolderProducer } from "./onchain-holder-producer.ts";
import {
  RegistrationError,
  missingFields,
  parseShadowOnboarding,
  registerCommunity,
} from "./registration.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { SourceProducer } from "./source-producer.ts";

const COMPLETE_MANIFEST = `
schema_version: "1.3"
slug: pythenian
name: "Pythenians"
shadow_onboarding:
  guild_id: "826115122799837205"
  namespace_prefix: "pythenian:"
  watched_contracts: ["0x144b27b1a267ee71989664b3907030da84cc4754"]
  score_community_slug: "pythenian"
  identity_authority: "freeside"
  admin_principals: ["operator-1"]
`;
const INCOMPLETE_MANIFEST = `
slug: pythenian
shadow_onboarding:
  guild_id: "TODO_PYTHENIAN_GUILD_SNOWFLAKE"
  namespace_prefix: "pythenian:"
  watched_contracts: []
  admin_principals: ["operator-1"]
`;
const reader = (text: string) => () => text;
const OPTS = (text: string, caller = "operator-1") => ({
  caller,
  readManifest: reader(text),
  observedAt: () => "2026-06-29T00:00:00.000Z",
});

describe("registerCommunity (manifest-driven)", () => {
  test("fail-closed: an incomplete / placeholder manifest is refused, listed", () => {
    const cfg = parseShadowOnboarding(INCOMPLETE_MANIFEST);
    const missing = missingFields(cfg);
    expect(missing).toContain("guild_id"); // TODO_ placeholder counts as missing
    expect(missing).toContain("watched_contracts"); // empty array
    expect(() => registerCommunity("pythenian", OPTS(INCOMPLETE_MANIFEST))).toThrow(RegistrationError);
  });

  test("privileged: a non-admin caller is rejected (SKP-005)", () => {
    expect(() => registerCommunity("pythenian", OPTS(COMPLETE_MANIFEST, "rando"))).toThrow(
      /not an admin principal/,
    );
  });

  test("deny-all: an empty admin_principals refuses everyone (fail-safe)", () => {
    const noAdmins = COMPLETE_MANIFEST.replace('["operator-1"]', "[]");
    expect(() => registerCommunity("pythenian", OPTS(noAdmins))).toThrow(/not an admin principal/);
  });

  test("valid manifest → WorldRef + config event (single source, no parallel store)", () => {
    const res = registerCommunity("pythenian", OPTS(COMPLETE_MANIFEST));
    expect(res.world.community_id).toBe("pythenian");
    expect(res.world.guild_id).toBe("826115122799837205");
    expect(res.world.watched_contracts).toEqual(["0x144b27b1a267ee71989664b3907030da84cc4754"]);
    expect(res.event.name).toBe("community.config.updated.v1");
    // RegistrationResult exposes no `config_path` — there is no parallel JSON.
    expect((res as { config_path?: string }).config_path).toBeUndefined();
  });

  test("config-only bring-up: manifest → register → ingest → member graph (G5)", async () => {
    const { world } = registerCommunity("pythenian", OPTS(COMPLETE_MANIFEST));
    const discord: SourceProducer = {
      kind: "discord",
      criticality: "required",
      phase: "A",
      async produce() {
        return [
          makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
            "discord.member.snapshot.v1",
            { discord_user_id: "111", display_name: "ada", role_ids: [] },
            { community_id: "pythenian", source: "discord", truth_status: "observed_only", observed_at: "t", emitted_at: "t" },
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
    const subjects = ledger.getMemberGraph("pythenian").subjects;
    expect(subjects.some((s) => s.kind === "discord_member")).toBe(true);
    expect(subjects.some((s) => s.kind === "wallet_only")).toBe(true);
  });
});
