/**
 * ingestion/onchain-holder-producer.ts — the ON-CHAIN ingestion angle
 * (cycle-010 S2.1; SDD §4.1b). The "fill bottom-up from chain" piece: a wallet
 * that HOLDS the community's collection becomes a `wallet_only` subject even if
 * it never joined Discord (G3).
 *
 * Reads holders of each `world.watched_contracts` entry from sonar
 * (`fetchSonarHolders`) → `sonar.wallet.attributed.v1`. Phase A. `optional`
 * criticality: if a contract isn't tracked in sonar yet (a community-onboarding
 * config step) or sonar is unreachable, the run degrades gracefully — the angle
 * is WIRED, not skipped.
 *
 * VOICELESS. READ-ONLY.
 */
import { makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import {
  fetchSonarHolders,
  type SonarHoldersClientConfig,
} from "./sonar-holders-client.ts";
import { ProducerError, type SourceProducer, type WorldRef } from "./source-producer.ts";

export interface OnChainHolderProducerDeps {
  readonly sonar: SonarHoldersClientConfig;
  readonly observedAt: () => string;
}

export function makeOnChainHolderProducer(
  deps: OnChainHolderProducerDeps,
): SourceProducer {
  return {
    kind: "sonar",
    criticality: "optional",
    phase: "A",
    async produce(world: WorldRef): Promise<ReadonlyArray<ShadowEvent>> {
      const observed_at = deps.observedAt();
      const events: ShadowEvent[] = [];
      try {
        for (const contract of world.watched_contracts) {
          const holders = await fetchSonarHolders(contract, deps.sonar);
          for (const h of holders) {
            events.push(
              makeEvent<Extract<ShadowEvent, { name: "sonar.wallet.attributed.v1" }>>(
                "sonar.wallet.attributed.v1",
                {
                  wallet: { address: h.address },
                  contract_address: h.contract,
                  edge_kind: "held_at_snapshot",
                },
                {
                  community_id: world.community_id,
                  source: "sonar",
                  truth_status: "observed_only",
                  observed_at,
                  emitted_at: observed_at,
                },
              ),
            );
          }
        }
      } catch (err) {
        throw new ProducerError("sonar", "on-chain holder read failed", err);
      }
      return events;
    },
  };
}
