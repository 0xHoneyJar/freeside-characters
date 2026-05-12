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

// BB pass-3 F10 + pass-4 F10 closure: validate MCP endpoint config at
// module load.
//
// Pass-3 made the prod path throw — which kills the entire bot (digest
// cron + read-side + everything) when only the ambient stir tier should
// be disabled. The throw cascades to anyone importing runtime.ts (the
// scheduler's lazy import would crash too) — F10 = conflate "stir
// misconfigured" with "process should refuse to start".
//
// Pass-4 fix: set an internal disable flag instead of throwing. Callers
// (the scheduler stir-tier cron) check `isAmbientStirDisabled()` and
// skip if true. Digest + read-side remain healthy.
let _ambientStirDisabled = false;
let _ambientStirDisabledReasons: ReadonlyArray<string> = [];

/** True when boot-time MCP endpoint validation failed in production.
 * Scheduler stir-tier checks this and no-ops. Digest cron is unaffected. */
export function isAmbientStirDisabled(): boolean {
  return _ambientStirDisabled;
}

export function getAmbientStirDisableReasons(): ReadonlyArray<string> {
  return _ambientStirDisabledReasons;
}

function _bootstrapEndpointValidation(): void {
  if (process.env.EVENT_HEARTBEAT_ENABLED === "false") {
    // Stir tier disabled — skip endpoint validation entirely.
    return;
  }
  let config;
  try {
    config = loadConfig();
  } catch {
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
  const reasons: Array<string> = [];
  for (const endpoint of endpoints) {
    const result = validateEndpointConfig(endpoint, config);
    if (!result.ok) {
      const msg = `ambient-runtime: endpoint validation failed [${endpoint}] — ${result.reason}`;
      if (isProd) {
        console.error(msg);
        reasons.push(`${endpoint}: ${result.reason}`);
      } else {
        console.warn(msg + " (dev mode — continuing)");
      }
    }
  }
  if (isProd && reasons.length > 0) {
    _ambientStirDisabled = true;
    _ambientStirDisabledReasons = reasons;
    console.error(
      "ambient-runtime: AMBIENT STIR TIER DISABLED in production — " +
        `${reasons.length} endpoint(s) misconfigured. Digest cron + ` +
        "read-side continue normally. Resolve endpoint config to re-enable.",
    );
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
