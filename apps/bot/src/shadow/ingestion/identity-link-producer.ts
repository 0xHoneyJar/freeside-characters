/**
 * ingestion/identity-link-producer.ts — the IDENTITY ingestion angle
 * (cycle-010 S2.2; SDD §4.1c). Reads wallet↔account links from identity-api and
 * emits `identity.wallet.linked.v1` / `identity.account.linked.v1` — the events
 * the ledger reduces to stitch `wallet_only` + `discord_member` subjects into a
 * reconciled `identity_user` (the conflict-safe stitch is the orchestrator's
 * Phase-B pre-check, §4.4 / S2.3).
 *
 * Phase B, required. Reads via an injected link reader (network-free tests; the
 * live adapter backs it with `persona-engine/.../freeside-auth-client`). READ-ONLY.
 * VOICELESS.
 */
import { makeEvent } from "./event.ts";
import type { ShadowEvent, WalletRef } from "./shadow-mode-contract.ts";
import { ProducerError, type SourceProducer, type WorldRef } from "./source-producer.ts";

/** One identity link as read from identity-api (the live adapter's row). */
export interface IdentityLink {
  readonly user_id: string;
  /** a verified wallet bound to this identity. */
  readonly wallet?: WalletRef;
  /** a verified discord account bound to this identity. */
  readonly discord_user_id?: string;
  readonly proof_ref?: string;
}

/** Injected, network-free link reader (live adapter = freeside-auth-client). */
export type IdentityLinkReader = (world: WorldRef) => Promise<ReadonlyArray<IdentityLink>>;

export interface IdentityLinkProducerDeps {
  readonly readLinks: IdentityLinkReader;
  readonly observedAt: () => string;
  /**
   * `required` (default): an identity failure degrades the run + suppresses
   * enforcement (the go-live path — you must not assign roles on a half-resolved
   * graph). `optional`: identity is enrichment (a read-only member-graph VIEW —
   * a transient resolve blip shouldn't degrade the whole card).
   */
  readonly criticality?: "required" | "optional";
}

export function makeIdentityLinkProducer(
  deps: IdentityLinkProducerDeps,
): SourceProducer {
  return {
    kind: "identity",
    criticality: deps.criticality ?? "required",
    phase: "B",
    async produce(world: WorldRef): Promise<ReadonlyArray<ShadowEvent>> {
      let links: ReadonlyArray<IdentityLink>;
      try {
        links = await deps.readLinks(world);
      } catch (err) {
        throw new ProducerError("identity", "identity-api link read failed", err);
      }
      const observed_at = deps.observedAt();
      const meta = {
        community_id: world.community_id,
        source: "identity" as const,
        truth_status: "verified" as const,
        observed_at,
        emitted_at: observed_at,
      };
      const events: ShadowEvent[] = [];
      for (const link of links) {
        if (link.wallet) {
          events.push(
            makeEvent<Extract<ShadowEvent, { name: "identity.wallet.linked.v1" }>>(
              "identity.wallet.linked.v1",
              { user_id: link.user_id, wallet: link.wallet, proof_ref: link.proof_ref },
              meta,
            ),
          );
        }
        if (link.discord_user_id) {
          events.push(
            makeEvent<Extract<ShadowEvent, { name: "identity.account.linked.v1" }>>(
              "identity.account.linked.v1",
              {
                user_id: link.user_id,
                account_kind: "discord",
                external_id: link.discord_user_id,
                proof_ref: link.proof_ref,
              },
              meta,
            ),
          );
        }
      }
      return events;
    },
  };
}
