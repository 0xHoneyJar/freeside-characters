// cycle-008 S9 (g30) · terminal adapter — thin dev-aid medium (print + flag-supplied ratings).
//
// Kept per operator: a low-fidelity dry-inspection medium that rides the SAME core loop +
// port as Discord. Proves the hexagon: a second adapter, zero core changes.

import type { MediumAdapter, PresentedBatch } from '../../ports/medium-adapter.ts';
import type { PreferenceRating } from '../../core/preference-log.ts';

export interface TerminalAdapterConfig {
  /** Ratings supplied out-of-band (CLI --rate flags); capture returns them verbatim. */
  readonly ratings?: ReadonlyArray<PreferenceRating>;
  readonly log?: (line: string) => void;
}

export function createTerminalAdapter(config: TerminalAdapterConfig = {}): MediumAdapter {
  const log = config.log ?? ((s: string) => console.log(s));
  return {
    name: 'terminal',
    present: async (batch): Promise<PresentedBatch> => {
      log(`\nbatch ${batch.batchId} · ${batch.zoneDisplay} · ${batch.candidates.length} candidates`);
      for (const c of batch.candidates) {
        log(`── ${c.variantId} · ${c.variantLabel} · [${c.surface}]`);
        log(c.billboardLines.map((l) => `   ${l}`).join('\n'));
        log('');
      }
      return {
        batchId: batch.batchId,
        zone: batch.zone,
        presented: batch.candidates.map((c) => ({ variantId: c.variantId, handle: c.variantId })),
      };
    },
    capture: async (): Promise<{ ratings: ReadonlyArray<PreferenceRating> }> => ({
      ratings: config.ratings ?? [],
    }),
  };
}
