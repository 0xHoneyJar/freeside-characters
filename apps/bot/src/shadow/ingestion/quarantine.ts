/**
 * ingestion/quarantine.ts — conflict pre-check + durable quarantine
 * (cycle-010 S2.3/S2.4; SDD §4.4). Closes the account-takeover shape (R4) and
 * the substrate's last-writer-alias ceiling under Z: rather than feed the
 * reducer a stitch that would re-point an alias to a different identity, we
 * REFUSE the stitch and quarantine the conflict for CM resolution.
 *
 * Durable: entries are append-only-persisted to
 * `.run/shadow/<community_id>-quarantine.jsonl` and re-surfaced each cycle
 * (Flatline SKP-002/760 lifecycle: resolved/expired entries compact out).
 *
 * VOICELESS: structural conflict records, no persona.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  discordAlias,
  walletAlias,
  type ILedgerStore,
  type ShadowEvent,
} from "./shadow-mode-contract.ts";

export interface ConflictQuarantineEntry {
  readonly community_id: string;
  /** the alias whose binding is contested. */
  readonly alias: string;
  /** the identity that already owns the alias. */
  readonly owned_by_identity: string;
  /** the identity that attempted to claim it. */
  readonly attempted_by_identity: string;
  readonly event_id: string;
  readonly observed_at: string;
  resolved?: boolean;
  expires_at?: string;
}

/**
 * A collision exists iff the event's alias already resolves to a subject bound
 * to a DIFFERENT `identity_user_id`. A first stitch onto an unclaimed
 * wallet_only / discord_member subject is NOT a collision.
 */
export function detectConflict(
  store: ILedgerStore,
  event: ShadowEvent,
): { alias: string; ownedBy: string; attemptedBy: string } | null {
  let alias: string | undefined;
  let attemptedBy: string | undefined;
  if (event.name === "identity.wallet.linked.v1") {
    alias = walletAlias(event.payload.wallet);
    attemptedBy = event.payload.user_id;
  } else if (event.name === "identity.account.linked.v1" && event.payload.account_kind === "discord") {
    alias = discordAlias(event.payload.external_id);
    attemptedBy = event.payload.user_id;
  }
  if (!alias || !attemptedBy) return null;
  const prior = store.findSubjectByAlias(event.community_id, alias);
  if (prior?.identity_user_id && prior.identity_user_id !== attemptedBy) {
    return { alias, ownedBy: prior.identity_user_id, attemptedBy };
  }
  return null;
}

/** Durable, bounded conflict-quarantine store (.run/shadow JSONL). */
export class ConflictQuarantine {
  private readonly entries: ConflictQuarantineEntry[] = [];
  constructor(
    private readonly communityId: string,
    private readonly path: string,
    private readonly cap = 1000,
  ) {
    this.replay();
  }

  /** Re-surface unresolved/unexpired entries from prior cycles (SKP-002/760). */
  private replay(): void {
    if (!existsSync(this.path)) return;
    const now = Date.now();
    const seen = new Set<string>();
    for (const line of readFileSync(this.path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let e: ConflictQuarantineEntry;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      const key = `${e.alias}|${e.attempted_by_identity}`;
      if (e.resolved) {
        seen.add(key);
        continue;
      } // compact out resolved
      if (e.expires_at && Date.parse(e.expires_at) < now) continue; // expired
      if (seen.has(key)) continue;
      seen.add(key);
      this.entries.push(e);
    }
  }

  record(entry: ConflictQuarantineEntry): void {
    if (this.entries.length >= this.cap) return; // bounded
    if (
      this.entries.some(
        (e) => e.alias === entry.alias && e.attempted_by_identity === entry.attempted_by_identity,
      )
    ) {
      return; // a re-detected, still-open conflict does not re-quarantine
    }
    this.entries.push(entry);
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(entry) + "\n");
  }

  open(): ReadonlyArray<ConflictQuarantineEntry> {
    return this.entries.filter((e) => !e.resolved);
  }

  static defaultPath(runDir: string, communityId: string): string {
    return join(runDir, "shadow", `${communityId}-quarantine.jsonl`);
  }
}
