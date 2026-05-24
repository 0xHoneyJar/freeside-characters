/**
 * HTTP retry with exponential backoff for the score-MCP client.
 *
 * Why: the weekly digest cron sweeps all zones in a tight loop
 * (cron/scheduler.ts) — four rapid `get_zone_digest` calls. score-mcp
 * rate-limits the burst, and the raw `fetch` in mcpInit/mcpToolCall threw on
 * the first 429 with no retry, so the LAST zone in the sweep (owsley-lab)
 * silently failed every run. This wraps the transport in a retry that honors
 * the server's `Retry-After` and otherwise backs off exponentially.
 *
 * Retries: 429 (rate limit) + 502/503/504 (transient upstream) + thrown
 * network errors. Non-retryable 4xx (401/403/404/400) pass straight through —
 * the caller's existing `if (!res.ok) throw` surfaces them unchanged.
 *
 * Pure + injectable (fetchImpl / sleep / random) so it unit-tests without real
 * network, real timers, or installed deps.
 */

export interface RetryInfo {
  /** 1-based attempt number that just failed. */
  readonly attempt: number;
  /** HTTP status when the failure was a response; undefined for network errors. */
  readonly status?: number;
  /** Delay before the next attempt, ms. */
  readonly delayMs: number;
  /** Human-readable cause. */
  readonly reason: string;
}

export interface FetchRetryOptions {
  /** Total attempts including the first. Default 4 (1 + 3 retries). */
  readonly maxAttempts?: number;
  /** Base for exponential backoff, ms. Default 500. */
  readonly baseDelayMs?: number;
  /** Cap for COMPUTED backoff, ms. Default 8000. */
  readonly maxDelayMs?: number;
  /** Cap for honoring a server `Retry-After`, ms. Default 60000. */
  readonly maxRetryAfterMs?: number;
  /** Statuses that trigger a retry. Default {429,502,503,504}. */
  readonly retryableStatuses?: ReadonlySet<number>;
  /** Injectable fetch (tests). Default global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable sleep (tests). Default setTimeout-based. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable RNG for jitter (tests). Default Math.random. */
  readonly random?: () => number;
  /** Observability hook fired before each backoff wait. */
  readonly onRetry?: (info: RetryInfo) => void;
}

export const DEFAULT_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  429, 502, 503, 504,
]);

/**
 * Parse an HTTP `Retry-After` header into milliseconds.
 * Supports both forms: delta-seconds (`"30"`) and an HTTP-date.
 * Returns undefined for absent/unparseable/negative values.
 */
export function parseRetryAfterMs(
  header: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (header == null) return undefined;
  const trimmed = header.trim();
  if (trimmed === "") return undefined;

  // delta-seconds form
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds * 1000 : undefined;
  }

  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  const delta = dateMs - now;
  return delta > 0 ? delta : 0;
}

/**
 * Exponential backoff with equal-jitter: half fixed, half random, capped at
 * maxDelayMs. attempt is 1-based.
 */
export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const exp = baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exp, maxDelayMs);
  // equal jitter: [capped/2, capped]
  return Math.round(capped / 2 + random() * (capped / 2));
}

/**
 * fetch with retry. Returns the final Response (even a retryable one once
 * attempts are exhausted, so the caller's status handling is unchanged).
 * Rethrows the last network error if every attempt threw.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8000;
  const maxRetryAfterMs = opts.maxRetryAfterMs ?? 60000;
  const retryable = opts.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, init);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) throw err;
      const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, random);
      opts.onRetry?.({
        attempt,
        delayMs,
        reason: `network error: ${err instanceof Error ? err.message : String(err)}`,
      });
      await sleep(delayMs);
      continue;
    }

    // Success or a non-retryable status, or no attempts left → hand it back.
    if (response.ok || !retryable.has(response.status) || attempt >= maxAttempts) {
      return response;
    }

    // Retryable status with attempts remaining: honor Retry-After if sane,
    // else exponential backoff.
    const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
    const delayMs =
      retryAfter !== undefined
        ? Math.min(retryAfter, maxRetryAfterMs)
        : computeBackoffMs(attempt, baseDelayMs, maxDelayMs, random);

    opts.onRetry?.({
      attempt,
      status: response.status,
      delayMs,
      reason: `HTTP ${response.status}`,
    });

    // Drain the body so the connection releases before we retry.
    try {
      await response.text();
    } catch {
      /* ignore drain errors */
    }

    await sleep(delayMs);
  }

  // Loop always returns or throws above; this satisfies the type checker.
  throw lastError ?? new Error("fetchWithRetry: exhausted without a response");
}
