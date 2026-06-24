// cycle-008 S9 · shared Components V2 POST with bounded 429 retry.
//
// The prod CV2 delivery (Pattern-B webhook.url, bot channel REST, legacy webhook) all POST raw
// JSON — bypassing discord.js's built-in rate-limit handling. BB review flagged that the live
// digest would throw on a 429 where the RLHF present path retries. This is the one shared helper
// so all three branches handle rate limits identically (mirrors the present.ts / capture.ts retry).

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * POST JSON with bounded 429 retry (honors `retry_after`). Returns the parsed body (for `id`).
 * Throws on a non-OK non-429 response, or after retries are exhausted.
 */
export async function postComponentsV2(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  doFetch: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ id?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const retry = await res.json().then((j: { retry_after?: number }) => j.retry_after ?? 1).catch(() => 1);
      await sleep(Math.ceil(retry * 1000) + 250);
      continue;
    }
    if (!res.ok) {
      throw new Error(`components-v2 POST failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    return (await res.json().catch(() => ({}))) as { id?: string };
  }
  throw new Error('components-v2 POST failed: rate-limited after 3 attempts');
}
