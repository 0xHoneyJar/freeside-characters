/**
 * ingestion/shadow-mode-contract.ts — LOCAL STUB of the substrate ledger
 * contract (cycle-010, GATE-PKG=stub).
 *
 * ⚠️ STUB — to be REPLACED by `@freeside/shadow-mode-protocol` +
 * `@freeside/shadow-mode-service` once a consume mechanism is decided (those
 * packages are currently `private:true`, unpublished, and live in a separate
 * pnpm monorepo — see grimoires/loa/NOTES.md cycle-010 GATE-PKG).
 *
 * This mirrors the symbols GROUNDED from loa-freeside origin/main (SDD §2):
 * `ShadowEvent` envelope + payload taxonomy · `ShadowSubject` (the canonical
 * member node) · `ILedgerStore` · `ShadowLedger` (ingest/projections) · the
 * `*Alias` builders. The consumer's OWN code (producers, orchestrator, envelope
 * builder, conflict pre-check, enforcement) is REAL and final — only THIS file
 * is the placeholder, swapped by a one-line import change.
 *
 * VOICELESS: pure structural types + an in-memory reducer. No persona import.
 */

// ── Common ───────────────────────────────────────────────────────────────────
export type SourceKind = "discord" | "sonar" | "identity" | "config";
export type TruthStatus = "verified" | "observed_only" | "unresolved";
export interface WalletRef {
  readonly address: string;
  readonly chain?: string;
}

// ── Envelope + event taxonomy (subset used by cycle-010 producers) ─────────────
export const SCHEMA_VERSION = "shadow.event.v1" as const;

export type EventName =
  | "community.config.updated.v1"
  | "discord.member.snapshot.v1"
  | "incumbent.role.observed.v1"
  | "sonar.wallet.attributed.v1"
  | "identity.wallet.linked.v1"
  | "identity.account.linked.v1";

export interface EventEnvelope<TName extends EventName, TPayload> {
  readonly event_id: string;
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly community_id: string;
  readonly name: TName;
  readonly source: SourceKind;
  readonly truth_status: TruthStatus;
  readonly observed_at: string;
  readonly emitted_at: string;
  readonly evidence_ref?: string;
  readonly payload: TPayload;
}

export interface DiscordMemberSnapshotPayload {
  readonly discord_user_id: string;
  readonly display_name?: string;
  readonly role_ids: ReadonlyArray<string>;
  readonly joined_at?: string;
}
export interface IncumbentRoleObservedPayload {
  readonly discord_user_id: string;
  readonly incumbent: string;
  readonly role_ids: ReadonlyArray<string>;
}
export interface SonarWalletAttributedPayload {
  readonly wallet: WalletRef;
  readonly contract_address: string;
  readonly edge_kind:
    | "minted"
    | "held_at_snapshot"
    | "received_transfer"
    | "sent_transfer"
    | "market_interaction";
  readonly token_id?: string;
}
export interface IdentityWalletLinkedPayload {
  readonly user_id: string;
  readonly wallet: WalletRef;
  readonly proof_ref?: string;
}
export interface IdentityAccountLinkedPayload {
  readonly user_id: string;
  readonly account_kind: "discord" | "telegram" | "x" | "email";
  readonly external_id: string;
  readonly proof_ref?: string;
}
export interface CommunityConfigUpdatedPayload {
  readonly role_rank?: Record<string, number>;
  readonly watched_contracts?: ReadonlyArray<string>;
  readonly incumbent_bot_ids?: ReadonlyArray<string>;
}

export type ShadowEvent =
  | EventEnvelope<"discord.member.snapshot.v1", DiscordMemberSnapshotPayload>
  | EventEnvelope<"incumbent.role.observed.v1", IncumbentRoleObservedPayload>
  | EventEnvelope<"sonar.wallet.attributed.v1", SonarWalletAttributedPayload>
  | EventEnvelope<"identity.wallet.linked.v1", IdentityWalletLinkedPayload>
  | EventEnvelope<"identity.account.linked.v1", IdentityAccountLinkedPayload>
  | EventEnvelope<"community.config.updated.v1", CommunityConfigUpdatedPayload>;

// ── Canonical member node (mirrors ShadowSubject, SDD §2) ──────────────────────
export type SubjectKind =
  | "identity_user"
  | "discord_member"
  | "wallet_only"
  | "unresolved";

export interface ShadowSubject {
  readonly subject_id: string;
  readonly community_id: string;
  kind: SubjectKind;
  identity_user_id?: string;
  discord_user_id?: string;
  display_name?: string;
  wallets: WalletRef[];
  aliases: string[];
  current_roles: string[];
  incumbent_roles: string[];
  freeside_roles: string[];
}

// ── Alias builders (mirror protocol exports) ───────────────────────────────────
export const identityAlias = (userId: string): string => `identity:${userId}`;
export const discordAlias = (discordId: string): string => `discord:${discordId}`;
export const walletAlias = (w: WalletRef): string =>
  `wallet:${w.address.toLowerCase()}`;

// ── Ledger store port (mirrors ILedgerStore, SDD §2) ───────────────────────────
export interface ILedgerStore {
  getSubject(subjectId: string): ShadowSubject | undefined;
  findSubjectByAlias(communityId: string, alias: string): ShadowSubject | undefined;
  upsertSubject(subject: ShadowSubject): void;
  upsertAlias(communityId: string, alias: string, subjectId: string): void;
  subjects(communityId: string): ShadowSubject[];
}

export type IngestResult =
  | { status: "ingested"; event_id: string }
  | { status: "duplicate"; event_id: string };

export interface MemberGraphProjection {
  readonly community_id: string;
  readonly subjects: ReadonlyArray<ShadowSubject>;
}
