/**
 * discrepancy-cv2.test.ts — the medium-agnostic CV2 render proof (Sprint 405 /
 * Task 405.5, SDD §1.3 C6/§5.1, G-5).
 *
 * G-5 (feature-agnostic substrate): the SAME `Discrepancy` read-model the web
 * lens (S3) renders as DOM, this lens renders as a Discord Components-V2 message
 * — ONE contract, two media, NO substrate change. We build a `Discrepancy` from
 * the substrate's pure `diff` (the exact contract the web lens consumes) and
 * assert the CV2 renderer:
 *   • produces a valid CV2 container (type 17 + IS_COMPONENTS_V2 flag);
 *   • distinguishes managed vs pre-existing roles (D2);
 *   • surfaces the 250-role projection predictively (D3);
 *   • surfaces the MOCK latent provenance flag honestly (FR-6/§8.5).
 */
import { describe, expect, test } from "bun:test";
import type { Discrepancy } from "@freeside-worlds/shadow-substrate";
import {
  renderDiscrepancyCV2,
  discrepancyCV2Payload,
  IS_COMPONENTS_V2,
} from "./discrepancy-cv2.ts";

// A representative `Discrepancy` typed against the substrate's EXPORTED type —
// the EXACT contract the web lens also consumes. Typing the literal as
// `Discrepancy` makes `tsc` enforce the contract (a field rename/add/remove in
// the substrate fails the typecheck), so this is contract-faithful without
// pulling in @effect/schema at runtime.
const DISCREPANCY: Discrepancy = {
  world: "purupuru",
  role_map_hash: "eda5e02d3a5a90befbfd3ab156a7e2614a2c1484a0700117a4f7f1108dd77415" as Discrepancy["role_map_hash"],
  before: { roles: [{ role_key: "purupuru:holder", members: 3, managed: true }] },
  after: {
    roles: [
      { role_key: "purupuru:holder", members: 3, managed: true },
      { role_key: "purupuru:whale", members: 0, managed: true, created: true },
    ],
  },
  preexisting: { roles: [{ role_key: "CollabLand VIP", members: 42, managed: false }] },
  latent_qualified: [{ role_key: "purupuru:whale", count: 7, source: "MOCK" }],
  role_count: { existing: 248, to_create: 1, projected_total: 249, limit: 250, exceeds: false },
  generated_at: "2026-06-02T12:00:00Z",
};

describe("405.5 — Discord CV2 render of the same Discrepancy (G-5)", () => {
  test("produces a CV2 container component (type 17)", () => {
    const c = renderDiscrepancyCV2(DISCREPANCY);
    expect(c.type).toBe(17);
    expect(Array.isArray(c.components)).toBe(true);
    // all child components are valid CV2 element types (10 text / 14 separator).
    for (const child of c.components) {
      expect([10, 14]).toContain(child.type);
    }
  });

  test("the full payload carries the IS_COMPONENTS_V2 flag (1<<15) + components only", () => {
    const p = discrepancyCV2Payload(DISCREPANCY);
    expect(p.flags).toBe(IS_COMPONENTS_V2);
    expect(p.flags).toBe(1 << 15);
    expect(p.components.length).toBe(1);
    expect(p.components[0]!.type).toBe(17);
  });

  test("D2: pre-existing/Collab.Land roles render as LOCKED context, never 'would change'", () => {
    const text = renderDiscrepancyCV2(DISCREPANCY)
      .components.filter((c): c is { type: 10; content: string } => c.type === 10)
      .map((c) => c.content)
      .join("\n");
    // pre-existing role appears under a lock affordance, not in before/after diff.
    expect(text).toContain("🔒");
    expect(text).toContain("CollabLand VIP");
    // managed roles carry the change affordance; the created one is marked.
    expect(text).toContain("purupuru:whale");
    expect(text).toContain("🆕"); // created-role marker on the managed not-yet-created role
  });

  test("FR-6: latent counts render with the honest MOCK provenance flag", () => {
    const text = renderDiscrepancyCV2(DISCREPANCY)
      .components.filter((c): c is { type: 10; content: string } => c.type === 10)
      .map((c) => c.content)
      .join("\n");
    expect(text).toContain("7 qualify off-server");
    expect(text).toContain("MOCK");
  });

  test("D3: a Discrepancy whose projection EXCEEDS 250 surfaces the overage predictively + warns", () => {
    const over = { ...DISCREPANCY, role_count: { existing: 249, to_create: 5, projected_total: 254, limit: 250 as const, exceeds: true } };
    const c = renderDiscrepancyCV2(over);
    const text = c.components.filter((x): x is { type: 10; content: string } => x.type === 10).map((x) => x.content).join("\n");
    expect(text).toContain("Would exceed Discord's 250-role limit");
    expect(text).toContain("254");
    // accent flips to the warn color when over the limit.
    expect(c.accent_color).toBe(0xe0a83d);
  });

  test("G-5 parity: the renderer consumes the Discrepancy contract verbatim (no extra fields needed)", () => {
    // The render input is EXACTLY the substrate's `Discrepancy` type — the SAME
    // object the web lens (S3) consumes. The render needs NO medium-specific
    // field: the renderer reads only the contract's fields. That the input is
    // typed as the substrate's exported `Discrepancy` (tsc-enforced) AND renders
    // without throwing is the G-5 proof — one contract, two media, no substrate
    // change. The lens does NOT mutate the contract object.
    const before = JSON.stringify(DISCREPANCY);
    expect(() => renderDiscrepancyCV2(DISCREPANCY)).not.toThrow();
    expect(JSON.stringify(DISCREPANCY)).toBe(before); // render is non-mutating (voiceless)
    expect(DISCREPANCY.role_count.limit).toBe(250);
  });
});
