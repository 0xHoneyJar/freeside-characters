// onboarding-records.ts — C6 support · audit + conflict-review jsonl records
// (cycle-009 · sprint-4 · T4.1/T4.2 · RT-2/RT-3/RT-4).
//
// Two append-only .run jsonl logs (repo rule: no database). Both go through appendJsonl, which
// JSON-encodes each record as exactly one line — a wallet/handle carrying a newline cannot forge
// a second record (RT-2). NEITHER log ever contains the service token or any header (RT-3).

import { appendJsonl, isWallet } from './state-token.ts';

const AUDIT_LOG = 'onboarding-audit.jsonl';
const REVIEW_QUEUE = 'onboarding-review.jsonl';

export type ConflictKind = 'wallet_rebound' | 'discord_rebound';

export interface LinkAuditRecord {
  discordId: string;
  walletAddress: string;
  userId: string;
  idempotent: boolean;
  conflict: ConflictKind | null;
  roleGranted: boolean;
}

/** Append a redacted link-audit line (RT-3 — no token, no headers). */
export function auditLink(rec: LinkAuditRecord, now: number = Date.now()): void {
  appendJsonl(AUDIT_LOG, {
    ts: new Date(now).toISOString(),
    event: 'link',
    discord_id: rec.discordId,
    wallet: isWallet(rec.walletAddress) ? rec.walletAddress : 'invalid',
    user_id: rec.userId,
    idempotent: rec.idempotent,
    conflict: rec.conflict,
    role_granted: rec.roleGranted,
  });
}

export interface ConflictReviewRecord {
  discordId: string;
  walletAddress: string;
  userId: string;
  conflict: ConflictKind;
}

/**
 * Record a rebound link to the review queue (RT-4 · FR-12). The link (spine write) already
 * succeeded; the ROLE is withheld pending operator review. The entry is well-formed (RT-2).
 */
export function recordConflictForReview(rec: ConflictReviewRecord, now: number = Date.now()): void {
  appendJsonl(REVIEW_QUEUE, {
    ts: new Date(now).toISOString(),
    status: 'pending_review',
    discord_id: rec.discordId,
    wallet: isWallet(rec.walletAddress) ? rec.walletAddress : 'invalid',
    user_id: rec.userId,
    conflict: rec.conflict,
  });
}
