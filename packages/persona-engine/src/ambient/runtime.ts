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
 *
 * BB pass-3 F10 closure: validateEndpointConfig fires at module load to
 * fail-fast on misconfigured MCP endpoints. In production (NODE_ENV=
 * production), validation failures throw; in dev/test, they log warnings
 * and continue (preserves STUB_MODE workflows).
 */

import { Layer, ManagedRuntime } from "effect";
import { EventSourceLive } from "./live/event-source.live.ts";
import { PulseSinkLive } from "./live/pulse-sink.live.ts";
import { MiberaResolverLive } from "./live/mibera-resolver.live.ts";
import { WalletResolverLive } from "./live/wallet-resolver.live.ts";
import { CircuitBreakerLive } from "./live/circuit-breaker.live.ts";
import { PopInLedgerLive } from "./live/pop-in-ledger.live.ts";
import {
  validateEndpointConfig,
  type AmbientMcpEndpoint,
} from "./live/score-mcp-client.ts";
import { loadConfig } from "../config.ts";

// BB pass-3 F10 closure: validate MCP endpoint config at module load.
// Strict in production (throw); lenient in dev/test (warn-and-continue
// so STUB_MODE works without env vars set).
function _bootstrapEndpointValidation(): void {
  if (process.env.EVENT_HEARTBEAT_ENABLED === "false") {
    // Stir tier disabled — skip endpoint validation entirely.
    return;
  }
  let config;
  try {
    config = loadConfig();
  } catch {
    // Config loader threw — likely missing required env. Bail to warning.
    console.warn(
      "ambient-runtime: skipping endpoint validation (config load failed)",
    );
    return;
  }
  const isProd = process.env.NODE_ENV === "production";
  const endpoints: ReadonlyArray<AmbientMcpEndpoint> = [
    "score",
    "codex",
    "freeside-auth",
  ];
  for (const endpoint of endpoints) {
    const result = validateEndpointConfig(endpoint, config);
    if (!result.ok) {
      const msg = `ambient-runtime: endpoint validation failed [${endpoint}] — ${result.reason}`;
      if (isProd) {
        throw new Error(msg);
      }
      console.warn(msg + " (dev mode — continuing)");
    }
  }
}

_bootstrapEndpointValidation();

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
