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

  test("renders the new states (wallet_only on-chain-only + unresolved)", () => {
    const container = renderMemberGraphCV2(PROJECTION, cleanSummary);
    const blob = JSON.stringify(container);
    expect(container.type).toBe(17);
    expect(blob).toContain("On-chain holders");
    expect(blob).toContain("0xWALLET");
    expect(blob).toContain("Needs CM resolution"); // unresolved section present
    expect(blob).toContain("pythenian:elder"); // freeside role on the linked member
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
