// observability.test.ts — cycle-009 sprint-5 T5.4 ACs.
import { describe, test, expect, beforeEach } from 'bun:test';
import { recordVerifyEvent, verifyMetricsSnapshot, resetVerifyMetrics } from './observability.ts';

describe('observability T5.4', () => {
  beforeEach(() => resetVerifyMetrics());

  test('counters start at zero and increment per event', () => {
    expect(verifyMetricsSnapshot().verified).toBe(0);
    recordVerifyEvent('verified', { role_granted: true });
    recordVerifyEvent('verified', { role_granted: false });
    recordVerifyEvent('conflict', { kind: 'wallet_rebound' });
    const snap = verifyMetricsSnapshot();
    expect(snap.verified).toBe(2);
    expect(snap.conflict).toBe(1);
    expect(snap.oauth_mismatch).toBe(0);
  });

  test('snapshot is a copy (mutating it does not corrupt the counters)', () => {
    recordVerifyEvent('link_outage');
    const snap = verifyMetricsSnapshot();
    snap.link_outage = 999;
    expect(verifyMetricsSnapshot().link_outage).toBe(1);
  });
});
