// observability.ts — T5.4 · verify-flow metrics + structured logs (cycle-009 · sprint-5).
//
// In-process counters + a structured log line per event — enough to drive the cutover monitor
// (FR/§9) and the rollback matrix without wiring an external metrics backend in v1. A counter
// snapshot is exposed on the /health surface; the structured logs are scrapeable by the host
// (Railway/ECS) log pipeline. Events never carry the service token / signature / bot token (RT-3).

export type VerifyEvent =
  | 'verify_root' // GET /verify/:token hit
  | 'oauth_callback' // callback reached
  | 'oauth_mismatch' // ATK-001 — discord_id != token.did
  | 'siwe_fail' // signature verification failed
  | 'nonce_replay' // ATK-002 — nonce already claimed
  | 'nonce_reissue_blocked' // C4 — a second SIWE nonce refused for an already-issued handoff token
  | 'precheck_resolve_failed' // C8 — DEP-A resolveByDiscord errored (identity-api degradation)
  | 'grant_failed' // C19 — role grant returned false (role-hierarchy / Discord API)
  | 'link_outage' // FR-14 — identity-api link failed
  | 'conflict' // FR-12 — rebound, pending review
  | 'verified'; // success

const counters: Record<VerifyEvent, number> = {
  verify_root: 0,
  oauth_callback: 0,
  oauth_mismatch: 0,
  siwe_fail: 0,
  nonce_replay: 0,
  nonce_reissue_blocked: 0,
  precheck_resolve_failed: 0,
  grant_failed: 0,
  link_outage: 0,
  conflict: 0,
  verified: 0,
};

/** Record an event: bump the counter + emit a single structured (token-free) log line. */
export function recordVerifyEvent(event: VerifyEvent, fields: Record<string, string | number | boolean> = {}): void {
  counters[event] += 1;
  // one-line structured log · lowercase (repo voice) · no secrets.
  const kv = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(`onboarding.verify event=${event}${kv ? ' ' + kv : ''}`);
}

/** Snapshot the counters (for /health + the cutover monitor). */
export function verifyMetricsSnapshot(): Record<VerifyEvent, number> {
  return { ...counters };
}

/** Test/boot reset. */
export function resetVerifyMetrics(): void {
  (Object.keys(counters) as VerifyEvent[]).forEach((k) => {
    counters[k] = 0;
  });
}
