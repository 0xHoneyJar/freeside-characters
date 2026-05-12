import { Effect, Layer } from "effect";
import {
  CircuitBreaker,
  type CircuitState,
  type CircuitStatus,
} from "../ports/circuit-breaker.port.ts";

const _state: Map<string, CircuitStatus> = new Map();
let _forceShortCircuit = false;

export function resetMockCircuitBreaker(): void {
  _state.clear();
  _forceShortCircuit = false;
}

export function setMockCircuitOpen(open: boolean): void {
  _forceShortCircuit = open;
}

function _statusFor(key: string): CircuitStatus {
  return (
    _state.get(key) ?? {
      key,
      state: "closed" as CircuitState,
      consecutive_failures: 0,
      opened_at: null,
      cooldown_until: null,
    }
  );
}

export const CircuitBreakerMock = Layer.succeed(
  CircuitBreaker,
  CircuitBreaker.of({
    status: (key) => Effect.sync(() => _statusFor(key)),
    recordSuccess: (key) =>
      Effect.sync(() => {
        _state.set(key, {
          ..._statusFor(key),
          state: "closed",
          consecutive_failures: 0,
          opened_at: null,
          cooldown_until: null,
        });
      }),
    recordFailure: (key) =>
      Effect.sync(() => {
        const s = _statusFor(key);
        _state.set(key, {
          ...s,
          consecutive_failures: s.consecutive_failures + 1,
        });
      }),
    isShortCircuited: (_key) => Effect.sync(() => _forceShortCircuit),
  }),
);
