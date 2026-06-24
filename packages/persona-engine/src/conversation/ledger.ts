/**
 * Per-channel conversation ledger (V0.7-A.0).
 *
 * In-process ring buffer of recent messages per Discord channel. Used by
 * `composeReply` to give characters short-term "reading-the-room" awareness
 * across slash invocations without a persistent memory primitive.
 *
 * Civic-layer note (per `listener-router-substrate.md` §invariants 5):
 * this is CONVERSATION CONTEXT, not character MEMORY. Restart loses it
 * by design — restart-loss only becomes a problem when felt. Persistent
 * cross-session character memory is V0.7+ daemon-stage territory.
 *
 * Cap: 50 entries per channel (matches moltbot `chat.ts:319` precedent).
 * Drop-oldest-on-overflow. No persistence. No cross-channel leakage.
 *
 * Pattern source: `~/Documents/GitHub/ruggy-moltbot/src/handlers/chat.ts`
 * (loadConversationHistory + storeConversation) — same shape, R2 dropped
 * for in-process Map.
 */

export interface LedgerEntry {
  /** 'user' = human invoker · 'character' = a character's reply */
  role: 'user' | 'character';
  /** The message text. For character entries, the LLM's reply (not chunks). */
  content: string;
  /** Present only when role='character' — which character authored. */
  characterId?: string;
  /**
   * For role='user': Discord user id.
   * For role='character': character.id (e.g. 'ruggy', 'satoshi').
   */
  authorId: string;
  /**
   * Display label for transcript rendering.
   * For role='user': Discord username (resolved via mention lookup if needed).
   * For role='character': character.displayName ?? character.id.
   */
  authorUsername: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

const MAX_ENTRIES_PER_CHANNEL = 50;

const ledgers = new Map<string, LedgerEntry[]>();

export function appendToLedger(channelId: string, entry: LedgerEntry): void {
  const buf = ledgers.get(channelId) ?? [];
  buf.push(entry);
  if (buf.length > MAX_ENTRIES_PER_CHANNEL) {
    buf.splice(0, buf.length - MAX_ENTRIES_PER_CHANNEL);
  }
  ledgers.set(channelId, buf);
}

export function getLedgerSnapshot(channelId: string, lastN: number): LedgerEntry[] {
  const buf = ledgers.get(channelId);
  if (!buf || buf.length === 0) return [];
  if (lastN <= 0) return [];
  return buf.slice(-lastN);
}

/** Testing only — not exported from package barrel. */
export function clearLedger(channelId: string): void {
  ledgers.delete(channelId);
}

/** Diagnostic — exposed for boot banner / health checks. */
export function ledgerChannelCount(): number {
  return ledgers.size;
}
