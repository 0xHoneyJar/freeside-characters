// Tests for the score-MCP retry transport. Pure: injected fetch (response
// factories), injected sleep (records delays, never waits), injected random
// (deterministic jitter). Runs under `bun test` with no installed deps.
//
// Regression intent: the digest cron's rapid zone sweep made score-mcp 429,
// and the un-retried transport dropped the last zone (owsley-lab). These tests
// pin the retry contract that fixes it.

import { describe, expect, test } from "bun:test";
import {
  computeBackoffMs,
  fetchWithRetry,
  parseRetryAfterMs,
} from "./retry.ts";

type Step = (() => Response) | Error;

/** Fake fetch driven by a list of per-call response factories (or an Error to
 * throw). The last step repeats once exhausted; factories run per call so each
 * Response body is fresh/drainable. */
function fakeFetch(steps: Step[]) {
  let calls = 0;
  const fn = (async () => {
    const step = steps[Math.min(calls, steps.length - 1)]!;
    calls++;
    if (step instanceof Error) throw step;
    return step();
  }) as unknown as typeof fetch;
  return { fn, calls: () => calls };
}

const r = (status: number, headers: Record<string, string> = {}) => () =>
  new Response(status === 204 ? null : `body-${status}`, { status, headers });

describe("parseRetryAfterMs", () => {
  test("delta-seconds form", () => {
    expect(parseRetryAfterMs("30")).toBe(30_000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  test("HTTP-date form (future → positive delta, past → 0)", () => {
    const now = Date.parse("2026-05-24T00:00:00Z");
    expect(parseRetryAfterMs("Sun, 24 May 2026 00:00:10 GMT", now)).toBe(10_000);
    expect(parseRetryAfterMs("Sun, 24 May 2026 00:00:00 GMT", now)).toBe(0);
    expect(parseRetryAfterMs("Sat, 23 May 2026 00:00:00 GMT", now)).toBe(0);
  });

  test("absent / empty / unparseable → undefined", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs("")).toBeUndefined();
    expect(parseRetryAfterMs("soon")).toBeUndefined();
  });
});

describe("computeBackoffMs", () => {
  test("equal-jitter bounds: random=0 → half, random=1 → full", () => {
    expect(computeBackoffMs(1, 500, 8000, () => 0)).toBe(250);
    expect(computeBackoffMs(1, 500, 8000, () => 1)).toBe(500);
  });

  test("grows exponentially with attempt", () => {
    // random=0 → lower bound = (base*2^(n-1))/2
    expect(computeBackoffMs(1, 500, 8000, () => 0)).toBe(250); // 500/2
    expect(computeBackoffMs(2, 500, 8000, () => 0)).toBe(500); // 1000/2
    expect(computeBackoffMs(3, 500, 8000, () => 0)).toBe(1000); // 2000/2
  });

  test("caps at maxDelayMs", () => {
    expect(computeBackoffMs(10, 500, 8000, () => 1)).toBe(8000);
  });
});

describe("fetchWithRetry", () => {
  const sleeps = (): { sleep: (ms: number) => Promise<void>; ms: number[] } => {
    const ms: number[] = [];
    return { sleep: async (n) => void ms.push(n), ms };
  };

  test("returns immediately on 200 (no retry, no sleep)", async () => {
    const ff = fakeFetch([r(200)]);
    const s = sleeps();
    const res = await fetchWithRetry("u", {}, { fetchImpl: ff.fn, sleep: s.sleep });
    expect(res.status).toBe(200);
    expect(ff.calls()).toBe(1);
    expect(s.ms).toEqual([]);
  });

  test("429 then 200 → retries and succeeds", async () => {
    const ff = fakeFetch([r(429), r(200)]);
    const s = sleeps();
    const res = await fetchWithRetry(
      "u",
      {},
      { fetchImpl: ff.fn, sleep: s.sleep, random: () => 0 },
    );
    expect(res.status).toBe(200);
    expect(ff.calls()).toBe(2);
    expect(s.ms.length).toBe(1);
  });

  test("honors Retry-After over computed backoff", async () => {
    const ff = fakeFetch([r(429, { "retry-after": "2" }), r(200)]);
    const s = sleeps();
    await fetchWithRetry("u", {}, { fetchImpl: ff.fn, sleep: s.sleep });
    expect(s.ms).toEqual([2000]);
  });

  test("Retry-After: 0 → immediate retry (sleep 0)", async () => {
    const ff = fakeFetch([r(429, { "retry-after": "0" }), r(200)]);
    const s = sleeps();
    const res = await fetchWithRetry("u", {}, { fetchImpl: ff.fn, sleep: s.sleep });
    expect(res.status).toBe(200);
    expect(ff.calls()).toBe(2);
    expect(s.ms).toEqual([0]);
  });

  test("caps an oversized Retry-After at maxRetryAfterMs", async () => {
    const ff = fakeFetch([r(503, { "retry-after": "9999" }), r(200)]);
    const s = sleeps();
    await fetchWithRetry(
      "u",
      {},
      { fetchImpl: ff.fn, sleep: s.sleep, maxRetryAfterMs: 30_000 },
    );
    expect(s.ms).toEqual([30_000]);
  });

  test("persistent 429 → returns the 429 after maxAttempts (caller throws)", async () => {
    const ff = fakeFetch([r(429)]);
    const s = sleeps();
    const onRetry: number[] = [];
    const res = await fetchWithRetry(
      "u",
      {},
      {
        fetchImpl: ff.fn,
        sleep: s.sleep,
        maxAttempts: 3,
        random: () => 0,
        onRetry: (i) => onRetry.push(i.attempt),
      },
    );
    expect(res.status).toBe(429);
    expect(ff.calls()).toBe(3); // initial + 2 retries
    expect(s.ms.length).toBe(2);
    expect(onRetry).toEqual([1, 2]);
  });

  test("non-retryable status (401) passes straight through", async () => {
    const ff = fakeFetch([r(401)]);
    const s = sleeps();
    const res = await fetchWithRetry("u", {}, { fetchImpl: ff.fn, sleep: s.sleep });
    expect(res.status).toBe(401);
    expect(ff.calls()).toBe(1);
    expect(s.ms).toEqual([]);
  });

  test("network error then 200 → retries and succeeds", async () => {
    const ff = fakeFetch([new Error("ECONNRESET"), r(200)]);
    const s = sleeps();
    const res = await fetchWithRetry(
      "u",
      {},
      { fetchImpl: ff.fn, sleep: s.sleep, random: () => 0 },
    );
    expect(res.status).toBe(200);
    expect(ff.calls()).toBe(2);
    expect(s.ms.length).toBe(1);
  });

  test("persistent network error → throws after maxAttempts", async () => {
    const ff = fakeFetch([new Error("ETIMEDOUT")]);
    const s = sleeps();
    await expect(
      fetchWithRetry(
        "u",
        {},
        { fetchImpl: ff.fn, sleep: s.sleep, maxAttempts: 3, random: () => 0 },
      ),
    ).rejects.toThrow("ETIMEDOUT");
    expect(ff.calls()).toBe(3);
  });
});
