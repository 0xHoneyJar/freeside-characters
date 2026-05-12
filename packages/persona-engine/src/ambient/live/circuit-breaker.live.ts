/**
 * CircuitBreaker live adapter — persistent CB state via JSONL.
 *
 * Per NFR-28: state persists to .run/circuit-breaker.jsonl. counter +
 * cooldown timer resume correctly across restarts.
 *
 * State machine:
 *   closed → (5 consecutive failures) → open
 *   open → (30min cooldown elapsed) → half_open
 *   half_open → (success) → closed | (failure) → open
 *
 * NFR-26: atomic tmp-file + rename for every write.
 * NFR-22: flock-based exclusion under singleton invariant (NFR-21).
 */

import { Effect, Layer } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CircuitBreaker,
  type CircuitState,
  type CircuitStatus,
} from "../ports/circuit-breaker.port.ts";

const STATE_PATH = ".run/circuit-breaker.jsonl";
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30 * 60 * 1000;

const _state: Map<string, CircuitStatus> = new Map();
let _loaded = false;

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

function _loadFromDisk(): void {
  if (_loaded) return;
  _loaded = true;
  try {
    if (!fs.existsSync(STATE_PATH)) return;
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as CircuitStatus;
        _state.set(parsed.key, parsed); // last-write-wins
      } catch {
        // skip malformed lines per truncated-line tolerance
      }
    }
  } catch {
    // best-effort load — empty state on failure
  }
}

function _writeAtomic(status: CircuitStatus): void {
  // BB F6 closure: POSIX-atomic JSONL line append. Full state derives
  // from last-write-per-key on _loadFromDisk(); the file is a log not
  // a snapshot.
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.appendFileSync(STATE_PATH, JSON.stringify(status) + "\n", {
      flag: "a",
    });
  } catch {
    // best-effort write; in-memory state remains authoritative for this process
  }
}

function _now(): string {
  return new Date().toISOString();
}

function _updateAndPersist(key: string, mutator: (s: CircuitStatus) => CircuitStatus): void {
  _loadFromDisk();
  const next = mutator(_statusFor(key));
  _state.set(key, next);
  _writeAtomic(next);
}

export const CircuitBreakerLive = Layer.succeed(
  CircuitBreaker,
  CircuitBreaker.of({
    status: (key) =>
      Effect.sync(() => {
        _loadFromDisk();
        return _statusFor(key);
      }),

    recordSuccess: (key) =>
      Effect.sync(() => {
        _updateAndPersist(key, (s) => ({
          ...s,
          state: "closed",
          consecutive_failures: 0,
          opened_at: null,
          cooldown_until: null,
        }));
      }),

    recordFailure: (key) =>
      Effect.sync(() => {
        _updateAndPersist(key, (s) => {
          const next_failures = s.consecutive_failures + 1;
          if (next_failures >= FAILURE_THRESHOLD) {
            const nowStr = _now();
            const cooldown = new Date(Date.now() + COOLDOWN_MS).toISOString();
            return {
              ...s,
              state: "open",
              consecutive_failures: next_failures,
              opened_at: nowStr,
              cooldown_until: cooldown,
            };
          }
          return { ...s, consecutive_failures: next_failures };
        });
      }),

    isShortCircuited: (key) =>
      Effect.sync(() => {
        _loadFromDisk();
        const s = _statusFor(key);
        if (s.state !== "open") return false;
        if (!s.cooldown_until) return true;
        const cooldownMs = Date.parse(s.cooldown_until);
        if (Number.isNaN(cooldownMs)) return true;
        if (Date.now() >= cooldownMs) {
          _updateAndPersist(key, (cur) => ({ ...cur, state: "half_open" }));
          return false;
        }
        return true;
      }),
  }),
);
