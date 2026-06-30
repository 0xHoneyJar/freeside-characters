/**
 * ingestion/event.ts — the envelope builder + content-addressed event_id
 * (cycle-010 S1.2; SDD §4.2).
 *
 * `event_id` is ARRAY-ENCODED, not pipe-delimited (Flatline SKP-001/840: a pipe
 * preimage collides — `name='a|b',cid='c'` would equal `name='a',cid='b|c'`).
 * It is TIMESTAMP-FREE (BR-7 / SKP-002): under Z the ledger is recomputed each
 * cycle, so "the same observation" must hash identically across runs to land as
 * `status:'duplicate'`; a genuine state change alters the payload → a distinct id.
 *
 * `canonicalPayload` is a deterministic JSON canonicalization (RFC-8785/JCS
 * spirit, SKP-003/730): keys sorted recursively, `undefined` omitted, arrays
 * order-preserved, no insignificant whitespace.
 *
 * VOICELESS: pure functions, no I/O, no persona.
 */
import { createHash } from "node:crypto";
import {
  SCHEMA_VERSION,
  type EventName,
  type ShadowEvent,
  type SourceKind,
  type TruthStatus,
} from "./shadow-mode-contract.ts";

/** RFC-8785/JCS-spirit canonical JSON: recursively sorted keys, omit undefined. */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue; // omit undefined (JCS has no `undefined`)
    out[key] = canonicalize(v);
  }
  return out;
}

/**
 * Content-addressed event id. Array-encoding makes field boundaries
 * unambiguous so no two distinct (name, community_id, source, payload) tuples
 * can collide via delimiter ambiguity.
 */
export function computeEventId(
  name: EventName,
  communityId: string,
  source: SourceKind,
  payload: unknown,
): string {
  const preimage = JSON.stringify([
    name,
    communityId,
    source,
    canonicalize(payload),
  ]);
  return createHash("sha256").update(preimage).digest("hex");
}

export interface MakeEventMeta {
  readonly community_id: string;
  readonly source: SourceKind;
  readonly truth_status: TruthStatus;
  /** when the underlying fact was observed (e.g. snapshot time). */
  readonly observed_at: string;
  /** when this envelope was emitted (NOT part of event_id). */
  readonly emitted_at: string;
  readonly evidence_ref?: string;
}

/**
 * Build a fully-formed, `.strict()`-shaped `ShadowEvent`. The `event_id` is
 * derived from (name, community_id, source, payload) ONLY — never from
 * `observed_at`/`emitted_at`.
 */
export function makeEvent<E extends ShadowEvent>(
  name: E["name"],
  payload: E["payload"],
  meta: MakeEventMeta,
): E {
  return {
    event_id: computeEventId(name, meta.community_id, meta.source, payload),
    schema_version: SCHEMA_VERSION,
    community_id: meta.community_id,
    name,
    source: meta.source,
    truth_status: meta.truth_status,
    observed_at: meta.observed_at,
    emitted_at: meta.emitted_at,
    ...(meta.evidence_ref ? { evidence_ref: meta.evidence_ref } : {}),
    payload,
  } as E;
}
