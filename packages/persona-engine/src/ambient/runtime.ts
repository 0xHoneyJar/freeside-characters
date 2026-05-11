/**
 * Ambient runtime — single ManagedRuntime.make site (FAGAN gate S9).
 *
 * Composes all 6 Live layers into one runtime. Per construct-effect-substrate
 * suffix-as-type:
 *   $ grep -r "ManagedRuntime\.make(" src/ambient --include='*.ts' | wc -l
 *   → 1 (this file)
 *
 * SIGTERM handler registered for graceful shutdown (NFR-32):
 *   process.on("SIGTERM", () => runtime.dispose())
 *   in-flight stir tick completes; cursor + ledger flushed; flocks released.
 */

import { Layer, ManagedRuntime } from "effect";
import { EventSourceLive } from "./live/event-source.live.ts";
import { PulseSinkLive } from "./live/pulse-sink.live.ts";
import { MiberaResolverLive } from "./live/mibera-resolver.live.ts";
import { WalletResolverLive } from "./live/wallet-resolver.live.ts";
import { CircuitBreakerLive } from "./live/circuit-breaker.live.ts";
import { PopInLedgerLive } from "./live/pop-in-ledger.live.ts";

// CircuitBreakerLive must come first since other lives require it.
const AmbientBaseLayer = Layer.mergeAll(
  CircuitBreakerLive,
  PulseSinkLive,
  PopInLedgerLive,
);

const AmbientDependentLayer = Layer.mergeAll(
  EventSourceLive,
  MiberaResolverLive,
  WalletResolverLive,
).pipe(Layer.provide(AmbientBaseLayer));

/** Composed ambient layer — provides all 6 services + sub-deps. */
export const AmbientLayer = Layer.merge(AmbientBaseLayer, AmbientDependentLayer);

/** Single ManagedRuntime.make site. FAGAN-checked in CI (S9). */
export const ambientRuntime = ManagedRuntime.make(AmbientLayer);

/** Graceful shutdown handler (NFR-32). Called from scheduler integration
 * (S3.T4). Drains in-flight effects, flushes cursor + ledger, releases flocks. */
export function disposeAmbientRuntime(): Promise<void> {
  return ambientRuntime.dispose();
}
