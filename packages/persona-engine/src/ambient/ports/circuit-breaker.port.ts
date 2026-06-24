/**
 * CircuitBreaker port — persistent circuit-breaker state for MCP dependencies.
 *
 * Per Flatline SDD SKP-002 (750): in-memory circuit-breaker state was lost
 * across restarts. Persisted to `.run/circuit-breaker.jsonl` with flock
 * (NFR-22) so counter + cooldown timer resume correctly.
 *
 * State machine:
 *   - closed     normal operation
 *   - half_open  in recovery probe (after cooldown elapsed)
 *   - open       short-circuit; reject requests until cooldown
 *
 * Per NFR-9: 5 consecutive failures → open. 30-minute cooldown then probe.
 */

import { Context, Effect } from "effect";

export type CircuitState = "closed" | "half_open" | "open";

export interface CircuitStatus {
  readonly key: string; // "score-mcp" | "codex-mcp" | "freeside-auth-mcp"
  readonly state: CircuitState;
  readonly consecutive_failures: number;
  readonly opened_at: string | null;
  readonly cooldown_until: string | null;
}

export interface CircuitBreakerError {
  readonly _tag: "CircuitBreakerError";
  readonly message: string;
}

export class CircuitBreaker extends Context.Tag("ambient/CircuitBreaker")<
  CircuitBreaker,
  {
    readonly status: (
      key: string,
    ) => Effect.Effect<CircuitStatus, CircuitBreakerError>;

    readonly recordSuccess: (
      key: string,
    ) => Effect.Effect<void, CircuitBreakerError>;

    readonly recordFailure: (
      key: string,
    ) => Effect.Effect<void, CircuitBreakerError>;

    /** Returns true if the circuit is OPEN and not yet ready to probe. */
    readonly isShortCircuited: (
      key: string,
    ) => Effect.Effect<boolean, CircuitBreakerError>;
  }
>() {}
