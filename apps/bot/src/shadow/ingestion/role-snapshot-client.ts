/**
 * role-snapshot-client.ts — POST a `RoleSnapshot` to the LIVE shadow-audit ingestion seam
 * (S3 / EXPORT-1). The S1↔S3 transport.
 *
 *   POST <endpoint>/v1/role-snapshot
 *     X-Ingest-Token:    <ROLE_SNAPSHOT_INGEST_TOKEN>   (operator-held; never logged)
 *     X-Snapshot-Sha256: sha256 hex of the EXACT raw request-body bytes
 *     Content-Type:      application/json
 *
 * Grounded against the consumer's route (loa-freeside
 * `packages/services/shadow-audit/src/http/audit-router.ts`, `POST /v1/role-snapshot`):
 *
 *   200 { ok, stored, community, captured_at, entries }
 *         accepted. **`stored:false` is SUCCESS**, not an error — the store is MONOTONIC on
 *         `captured_at` (role-store.ts `isNewer`), so re-POSTing an equal-or-older snapshot is a
 *         no-op that refuses to roll the held snapshot backwards. This makes the exporter safe to
 *         be at-least-once: a replay cannot corrupt state.
 *   401   missing/wrong X-Ingest-Token (constant-time compare; empty body by design)
 *   403   `community` is not operated by this deploy (must be exactly `thj`)
 *   413   body > 10 MB
 *   422   sha256 mismatch, or the body fails RoleSnapshotSchema
 *   400   invalid JSON
 *
 * The service REFUSES rather than guesses. A 4xx is telling you something true — read it, do not
 * retry blindly. This client therefore does NOT retry internally; the CLI is idempotent and safe to
 * re-run, which is the right place for a retry decision.
 *
 * ── INTEGRITY ────────────────────────────────────────────────────────────────
 * The hash MUST cover the exact bytes on the wire. We serialize ONCE into `body` and both hash and
 * send THAT string — never re-serialize (a second `JSON.stringify` could differ in key order and
 * turn a good snapshot into a 422). The server hashes with
 * `createHash('sha256').update(raw, 'utf8')`; we mirror it byte-for-byte.
 *
 * ── SECRET DISCIPLINE ────────────────────────────────────────────────────────
 * The ingest token is read from the caller, used once as a header, and NEVER logged, echoed, or
 * included in an error. Response bodies from this endpoint carry no member data (the receipt is
 * counts only), so surfacing them is safe.
 */
import { createHash } from "node:crypto";
import type { RoleSnapshot } from "./role-snapshot.contract.ts";

/** The deployed ingestion seam (verified live 2026-07-12). */
export const DEFAULT_INGEST_ENDPOINT = "https://shadow-audit-api-production.up.railway.app";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface PostRoleSnapshotConfig {
  /** Base URL. Default {@link DEFAULT_INGEST_ENDPOINT}. */
  readonly endpoint?: string;
  /** ROLE_SNAPSHOT_INGEST_TOKEN. Operator-held. NEVER logged. */
  readonly token: string;
  /** Injectable fetch (tests). Production omits it (global fetch). */
  readonly fetchImpl?: typeof fetch;
  /** Request deadline in ms (default 30s; <=0 disables). */
  readonly timeoutMs?: number;
}

/** The 200 receipt — counts only, no member data echoed. */
export interface IngestReceipt {
  readonly ok: boolean;
  /** FALSE ⇒ an equal-or-newer snapshot is already held. A successful NO-OP, not an error. */
  readonly stored: boolean;
  readonly community: string;
  readonly captured_at: string;
  readonly entries: number;
}

export type PostRoleSnapshotResult =
  | { readonly kind: "accepted"; readonly status: 200; readonly receipt: IngestReceipt }
  /** A typed refusal from the service (401/403/413/422/400) — READ it, do not retry blindly. */
  | { readonly kind: "refused"; readonly status: number; readonly reason: string }
  /** Transport error / deadline — the one case where a retry is sensible. */
  | { readonly kind: "transport_error"; readonly reason: string };

/** What the request WOULD be (`--dry-run` prints this; the POST path sends exactly it). */
export interface PreparedRequest {
  readonly url: string;
  readonly body: string;
  readonly sha256: string;
  readonly bytes: number;
}

/**
 * Serialize + hash ONCE. The returned `body` is the exact string that goes on the wire, and
 * `sha256` is the digest of exactly those utf8 bytes.
 */
export function prepareRoleSnapshotRequest(
  snapshot: RoleSnapshot,
  endpoint: string = DEFAULT_INGEST_ENDPOINT,
): PreparedRequest {
  const body = JSON.stringify(snapshot);
  return {
    url: `${endpoint.replace(/\/+$/, "")}/v1/role-snapshot`,
    body,
    sha256: createHash("sha256").update(body, "utf8").digest("hex"),
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

/** Human-readable cause per refusal status — so a 4xx is actionable instead of opaque. */
function refusalReason(status: number, detail: string): string {
  const known: Record<number, string> = {
    400: "invalid JSON body",
    401: "missing/wrong X-Ingest-Token (check ROLE_SNAPSHOT_INGEST_TOKEN)",
    403: "community is not operated by this deploy (it must be exactly 'thj')",
    413: "snapshot exceeds the 10 MB limit",
    422: "sha256 mismatch, or the body failed RoleSnapshotSchema validation",
  };
  const base = known[status] ?? `unexpected status ${status}`;
  return detail ? `${base} — ${detail}` : base;
}

/** POST the snapshot. Never throws; every outcome is a typed result. */
export async function postRoleSnapshot(
  snapshot: RoleSnapshot,
  cfg: PostRoleSnapshotConfig,
): Promise<PostRoleSnapshotResult> {
  const prepared = prepareRoleSnapshotRequest(snapshot, cfg.endpoint);
  const doFetch = cfg.fetchImpl ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await doFetch(prepared.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secret. Used here, never logged.
        "X-Ingest-Token": cfg.token,
        "X-Snapshot-Sha256": prepared.sha256,
      },
      body: prepared.body,
      signal: timeoutMs > 0 ? controller.signal : undefined,
    });
  } catch (e) {
    return { kind: "transport_error", reason: e instanceof Error ? e.message : String(e) };
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (res.status === 200) {
    const receipt = (await res.json().catch(() => null)) as IngestReceipt | null;
    if (!receipt || typeof receipt.stored !== "boolean") {
      return { kind: "refused", status: 200, reason: "malformed 200 receipt (expected {ok, stored, ...})" };
    }
    return { kind: "accepted", status: 200, receipt };
  }

  // 401 is an intentionally empty body; the others carry {error}. Read it best-effort for the
  // operator, but never assume a shape.
  const detail = await res
    .text()
    .then((t) => t.trim().slice(0, 200))
    .catch(() => "");
  return { kind: "refused", status: res.status, reason: refusalReason(res.status, detail) };
}
