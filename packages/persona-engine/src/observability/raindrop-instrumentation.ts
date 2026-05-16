// Raindrop Workshop instrumentation for the Claude Agent SDK call surface.
//
// Without writeKey: SDK runs in LOCAL-ONLY mode, mirroring traces to the
// Raindrop Workshop daemon at http://localhost:5899 (or whatever
// RAINDROP_LOCAL_DEBUGGER points to). No cloud egress.
//
// With writeKey (RAINDROP_WRITE_KEY env): traces also stream to Raindrop Cloud.
//
// Workshop daemon install: https://github.com/raindrop-ai/workshop
//   curl -fsSL https://raindrop.sh/install | bash
//   raindrop workshop
//   → opens http://localhost:5899 with live trace UI
//
// Operator instrument flow:
//   1. `bun add @raindrop-ai/claude-agent-sdk` in packages/persona-engine/
//   2. `raindrop workshop` to start daemon (port 5899)
//   3. Run `bun run digest:once` — traces stream into Workshop UI
//
// Toggle: set RAINDROP_DISABLED=1 to bypass instrumentation entirely.

import { query as rawQuery } from '@anthropic-ai/claude-agent-sdk';

type QueryFn = typeof rawQuery;

const EVENT_NAME = 'freeside-character';
const USER_ID = process.env.FREESIDE_CHARACTER_ID ?? 'freeside-character';
const CONVO_ID = 'cron-default';

let _wrappedQuery: QueryFn | null | undefined;

/**
 * Resolve the query() function to use — Raindrop-wrapped if available, raw
 * SDK otherwise. Result is cached after first call (single wrap per process).
 *
 * Fail-open: any initialization error returns raw query so post delivery is
 * never blocked by instrumentation. Errors are logged once at RAINDROP_DEBUG=1.
 */
export async function resolveQuery(): Promise<QueryFn> {
  if (_wrappedQuery !== undefined) return _wrappedQuery ?? rawQuery;
  if (process.env.RAINDROP_DISABLED === '1') {
    _wrappedQuery = null;
    return rawQuery;
  }

  try {
    // Dynamic import. Package is now in deps (cycle-006 commit 1dfc38b);
    // the dynamic-import shape preserves the fail-open guard for any future
    // removal of the dep without code edit.
    const mod = await import('@raindrop-ai/claude-agent-sdk');
    const raindrop = mod.createRaindropClaudeAgentSDK({
      writeKey: process.env.RAINDROP_WRITE_KEY, // optional
    });
    // SDK auto-resolves localWorkshopUrl from RAINDROP_LOCAL_DEBUGGER or
    // the default localhost:5899 when NODE_ENV !== 'production'.
    const wrapped = raindrop.wrap(
      { query: rawQuery },
      {
        context: {
          userId: USER_ID,
          eventName: EVENT_NAME,
          convoId: CONVO_ID,
        },
      },
    );
    _wrappedQuery = wrapped.query as QueryFn;
    return _wrappedQuery;
  } catch (err) {
    _wrappedQuery = null;
    if (process.env.RAINDROP_DEBUG === '1') {
      console.error(
        `[raindrop-instrumentation] failed to initialize; falling back to raw query(): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return rawQuery;
  }
}

/**
 * Synchronous fallback for sites that can't `await` the resolver. Returns the
 * cached wrapped query OR raw query if not yet initialized. First few calls
 * may bypass Raindrop until the async resolveQuery() warms the cache.
 */
export function syncQuery(): QueryFn {
  return _wrappedQuery ?? rawQuery;
}

export type { QueryFn };
