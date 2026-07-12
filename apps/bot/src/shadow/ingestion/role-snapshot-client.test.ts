/**
 * role-snapshot-client.test.ts — the ingestion transport (S3 / EXPORT-1).
 *
 * Pins the integrity header (the sha256 must cover the EXACT bytes sent — a mismatch is a live 422)
 * and the response mapping, including the one that is easy to get backwards:
 * **`200 {stored:false}` is SUCCESS**, not an error.
 *
 * Network-free: fetch is injected. The live POST is NOT exercised here (no ingest token in CI) —
 * the coordinator runs the live probe. See the report.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  postRoleSnapshot,
  prepareRoleSnapshotRequest,
  DEFAULT_INGEST_ENDPOINT,
} from "./role-snapshot-client.ts";
import { parseRoleSnapshot, type RoleSnapshot } from "./role-snapshot.contract.ts";

const SNAPSHOT: RoleSnapshot = parseRoleSnapshot({
  source: "discord:guild:1135545260538339420",
  community: "thj",
  captured_at: "2026-07-12T12:00:00.000Z",
  export_method: "freeside-characters:role-snapshot-exporter@1",
  owner: "0x886d2176d899796cd1affa07eff07b9b2b80f1be",
  freshness_threshold_seconds: 86400,
  entries: [
    {
      discord_user_id: "111111111111111111",
      wallet: "0x1111111111111111111111111111111111111111",
      role_ids: ["900000000000000001"],
    },
    { discord_user_id: "222222222222222222", role_ids: ["900000000000000001"] },
  ],
});

const TOKEN = "s3cr3t-ingest-token";

/** Capture the outgoing request, answer with a canned response. */
function captureFetch(status: number, body?: unknown): {
  fetchImpl: typeof fetch;
  seen: () => { url: string; headers: Record<string, string>; body: string };
} {
  let captured: { url: string; headers: Record<string, string>; body: string } | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured = {
      url: typeof input === "string" ? input : input.toString(),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ""),
    };
    if (body === undefined) return new Response(null, { status });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, seen: () => captured! };
}

const RECEIPT = (stored: boolean) => ({
  ok: true,
  stored,
  community: "thj",
  captured_at: "2026-07-12T12:00:00.000Z",
  entries: 2,
});

describe("prepareRoleSnapshotRequest — byte-exact integrity", () => {
  test("the sha256 is the digest of the EXACT body string that will be sent", () => {
    const p = prepareRoleSnapshotRequest(SNAPSHOT);
    expect(p.sha256).toBe(createHash("sha256").update(p.body, "utf8").digest("hex"));
    expect(p.bytes).toBe(Buffer.byteLength(p.body, "utf8"));
    expect(p.url).toBe(`${DEFAULT_INGEST_ENDPOINT}/v1/role-snapshot`);
  });

  test("the body round-trips back through the contract (what we hash is what the service parses)", () => {
    const p = prepareRoleSnapshotRequest(SNAPSHOT);
    expect(() => parseRoleSnapshot(JSON.parse(p.body))).not.toThrow();
  });

  test("an unmatched entry serializes with NO wallet key (a null would be a 422)", () => {
    const p = prepareRoleSnapshotRequest(SNAPSHOT);
    expect(p.body).not.toContain('"wallet":null');
    const wire = JSON.parse(p.body) as { entries: Array<Record<string, unknown>> };
    expect(Object.keys(wire.entries[1]!).sort()).toEqual(["discord_user_id", "role_ids"]);
  });
});

describe("postRoleSnapshot — request shape", () => {
  test("sends the token + the sha256 of the sent bytes, as JSON", async () => {
    const { fetchImpl, seen } = captureFetch(200, RECEIPT(true));
    await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    const req = seen();
    expect(req.url).toBe(`${DEFAULT_INGEST_ENDPOINT}/v1/role-snapshot`);
    expect(req.headers["X-Ingest-Token"]).toBe(TOKEN);
    expect(req.headers["Content-Type"]).toBe("application/json");
    // the header must match a hash of the body ACTUALLY sent — this is what the service re-computes.
    expect(req.headers["X-Snapshot-Sha256"]).toBe(
      createHash("sha256").update(req.body, "utf8").digest("hex"),
    );
  });

  test("honors a custom endpoint (and strips a trailing slash)", async () => {
    const { fetchImpl, seen } = captureFetch(200, RECEIPT(true));
    await postRoleSnapshot(SNAPSHOT, {
      token: TOKEN,
      fetchImpl,
      timeoutMs: 0,
      endpoint: "https://staging.example.com/",
    });
    expect(seen().url).toBe("https://staging.example.com/v1/role-snapshot");
  });
});

describe("postRoleSnapshot — response mapping", () => {
  test("200 {stored:true} ⇒ accepted", async () => {
    const { fetchImpl } = captureFetch(200, RECEIPT(true));
    const r = await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    expect(r.kind).toBe("accepted");
    if (r.kind === "accepted") expect(r.receipt.stored).toBe(true);
  });

  test("200 {stored:false} is SUCCESS — a monotonic no-op replay, NOT an error", async () => {
    const { fetchImpl } = captureFetch(200, RECEIPT(false));
    const r = await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    expect(r.kind).toBe("accepted"); // ← the assertion that keeps at-least-once retries safe
    if (r.kind === "accepted") expect(r.receipt.stored).toBe(false);
  });

  test.each([
    [401, "X-Ingest-Token"],
    [403, "not operated"],
    [413, "10 MB"],
    [422, "sha256"],
    [400, "invalid JSON"],
  ])("%i ⇒ a typed refusal naming the cause", async (status, expected) => {
    const { fetchImpl } = captureFetch(status as number, { error: "nope" });
    const r = await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") {
      expect(r.status).toBe(status as number);
      expect(r.reason).toContain(expected as string);
    }
  });

  test("a transport error is typed, never thrown", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const r = await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    expect(r.kind).toBe("transport_error");
    if (r.kind === "transport_error") expect(r.reason).toContain("ECONNREFUSED");
  });

  test("a malformed 200 receipt is refused, not silently treated as accepted", async () => {
    const { fetchImpl } = captureFetch(200, { unexpected: true });
    const r = await postRoleSnapshot(SNAPSHOT, { token: TOKEN, fetchImpl, timeoutMs: 0 });
    expect(r.kind).toBe("refused");
  });
});
