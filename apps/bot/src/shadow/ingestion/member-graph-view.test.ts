/**
 * member-graph-view.test.ts — the multi-source render (cycle-010 S3.1/S3.2).
 * Proves the new states surface (wallet_only / unresolved), the degraded banner
 * (S3.2 / SKP-002), and the shared kind→display map (IMP-008). Network-free.
 */
import { describe, expect, test } from "bun:test";
import {
  KIND_DISPLAY,
  degradedBanner,
  memberGraphCV2Payload,
  renderMemberGraphCV2,
  summarizeGraph,
  enrichDisplayNames,
} from "./member-graph-view.ts";
import type { IngestionRunSummary } from "./orchestrator.ts";
import type { MemberGraphProjection, ShadowSubject } from "./shadow-mode-contract.ts";

function subj(kind: ShadowSubject["kind"], over: Partial<ShadowSubject> = {}): ShadowSubject {
  return {
    subject_id: `s_${kind}_${over.subject_id ?? "1"}`,
    community_id: "pythenian",
    kind,
    wallets: [],
    aliases: [],
    current_roles: [],
    incumbent_roles: [],
    freeside_roles: [],
    ...over,
  };
}

const PROJECTION: MemberGraphProjection = {
  community_id: "pythenian",
  subjects: [
    subj("wallet_only", { wallets: [{ address: "0xWALLET" }] }),
    subj("discord_member", { discord_user_id: "111", display_name: "ada" }),
    subj("identity_user", { identity_user_id: "u1", discord_user_id: "111", freeside_roles: ["pythenian:elder"] }),
    subj("unresolved", { subject_id: "x" }),
  ],
};

const cleanSummary: IngestionRunSummary = {
  community_id: "pythenian",
  degraded: false,
  timed_out: false,
  ingested: 4,
  duplicates: 0,
  quarantined: 0,
  sources: [],
  source_freshness: { discord: "ok", sonar: "ok", identity: "ok" },
};

describe("member graph view", () => {
  test("counts every kind", () => {
    const c = summarizeGraph(PROJECTION);
    expect(c).toEqual({ total: 4, identity_user: 1, discord_member: 1, wallet_only: 1, unresolved: 1 });
  });

  test("renders a tight summary: holders, linked, sampled + truncated", () => {
    const container = renderMemberGraphCV2(PROJECTION, cleanSummary);
    const blob = JSON.stringify(container);
    expect(container.type).toBe(17);
    expect(blob).toContain("On-chain holders");
    expect(blob).toContain("0xWALLET"); // ≤14 chars → not truncated
    expect(blob).toContain("not yet linked"); // resolve framing
    expect(blob).toContain("Verify your wallet"); // resolve CTA
    expect(blob).toContain("pythenian:elder"); // freeside role on the linked member
  });

  test("truncates long wallets + links the dashboard when a URL is given", () => {
    const longWallet = "0x45f8415a15f5ce5988b60319ed2331650a6e3da3";
    const proj: MemberGraphProjection = {
      community_id: "mibera",
      subjects: [subj("wallet_only", { wallets: [{ address: longWallet }] })],
    };
    const container = renderMemberGraphCV2(proj, cleanSummary, { dashboardUrl: "https://freeside.0xhoneyjar.xyz/" });
    const blob = JSON.stringify(container);
    expect(blob).toContain("0x45f8…3da3"); // truncated
    expect(blob).not.toContain(longWallet); // full address NOT shown
    // a Link button (style 5) to the community dashboard page
    const row = container.components.find((c) => c.type === 1) as { components: Array<{ style: number; url: string }> };
    expect(row).toBeDefined();
    expect(row.components[0].style).toBe(5);
    expect(row.components[0].url).toBe("https://freeside.0xhoneyjar.xyz/mibera");
  });

  test("no dashboard URL → no link button (no broken buttons)", () => {
    const container = renderMemberGraphCV2(PROJECTION, cleanSummary, {});
    expect(container.components.some((c) => c.type === 1)).toBe(false);
  });

  test("enrichDisplayNames: a wallet's username renders instead of its address", () => {
    const proj: MemberGraphProjection = {
      community_id: "mibera",
      subjects: [subj("wallet_only", { wallets: [{ address: "0xDEADBEEF00000000000000000000000000000001" }] })],
    };
    const enriched = enrichDisplayNames(proj, new Map([["0xdeadbeef00000000000000000000000000000001", "dexdax"]]));
    const blob = JSON.stringify(renderMemberGraphCV2(enriched, cleanSummary));
    expect(enriched.subjects[0].display_name).toBe("dexdax");
    expect(blob).toContain("dexdax"); // username shown
    expect(blob).not.toContain("0xDEAD"); // address NOT shown when a name exists
  });

  test("named holders sort before un-named in the sample", () => {
    const proj: MemberGraphProjection = {
      community_id: "mibera",
      subjects: [
        subj("wallet_only", { subject_id: "a", wallets: [{ address: "0xa" }] }),
        subj("wallet_only", { subject_id: "b", wallets: [{ address: "0xb" }], display_name: "named" }),
      ],
    };
    const blob = JSON.stringify(renderMemberGraphCV2(proj, cleanSummary));
    expect(blob).toContain("1 named");
  });

  test("kind→display map is the single source of truth (IMP-008)", () => {
    expect(KIND_DISPLAY.wallet_only.label).toBe("On-chain only");
    expect(KIND_DISPLAY.identity_user.glyph).toBe("🔗");
  });

  test("degraded run surfaces a not-authoritative banner with stale sources (S3.2)", () => {
    const degraded: IngestionRunSummary = {
      ...cleanSummary,
      degraded: true,
      source_freshness: { discord: "stale", sonar: "ok", identity: "ok" },
    };
    const banner = degradedBanner(degraded);
    expect(banner).toContain("not authoritative");
    expect(banner).toContain("discord");
    const container = renderMemberGraphCV2(PROJECTION, degraded);
    expect(container.accent_color).not.toBe(renderMemberGraphCV2(PROJECTION, cleanSummary).accent_color);
  });

  test("clean run has no banner", () => {
    expect(degradedBanner(cleanSummary)).toBeNull();
  });

  test("payload wraps with the Components-V2 flag", () => {
    const payload = memberGraphCV2Payload(PROJECTION, cleanSummary);
    expect(payload.flags & (1 << 15)).toBe(1 << 15);
    expect(payload.components).toHaveLength(1);
  });
});
