/**
 * ingestion/orchestrator.ts — the two-phase IngestionOrchestrator (cycle-010
 * S1.4; SDD §4.3). Resolves the parallel-vs-ordering contradiction Flatline
 * caught (SKP-001/870 + IMP-003/917):
 *
 *   Phase A (parallel): discord + on-chain producers → ingest ALL their events
 *                       → AWAIT every commit.
 *   Phase B (serial):   THEN identity producers — their conflict pre-check
 *                       (Sprint 2, SDD §4.4) sees the committed Phase-A subjects,
 *                       so a stitch collision cannot be silently missed.
 *
 * Fail-isolation + degraded posture (SKP-002/780): a producer error drops ITS
 * events; the run is `degraded` if any `criticality:'required'` producer failed
 * or timed out. A degraded run's projections must NOT drive enforcement / go-live
 * (the render layer reads `degraded`). Per-producer + whole-run timeouts bound
 * a hung upstream (SKP-005/730).
 *
 * VOICELESS: orchestration only; emits no Discord output.
 */
import type { ShadowLedger } from "./ledger-host.ts";
import type { ShadowEvent, SourceKind } from "./shadow-mode-contract.ts";
import { ProducerError, type SourceProducer, type WorldRef } from "./source-producer.ts";

export interface SourceOutcome {
  readonly kind: SourceKind;
  readonly criticality: "required" | "optional";
  readonly status: "ok" | "error" | "timeout";
  readonly event_count: number;
  readonly error?: string;
}

export interface IngestionRunSummary {
  readonly community_id: string;
  readonly degraded: boolean;
  readonly timed_out: boolean;
  readonly ingested: number;
  readonly duplicates: number;
  readonly sources: ReadonlyArray<SourceOutcome>;
  /** per-source freshness, for the render banner (SKP-002/780 + S3.2). */
  readonly source_freshness: Readonly<Record<string, "ok" | "stale">>;
}

export interface OrchestratorOptions {
  /** per-producer timeout, ms (SKP-005). */
  readonly perProducerTimeoutMs?: number;
  /** whole-run timeout, ms (SKP-005). */
  readonly maxRunMs?: number;
  /** clock injection for deterministic tests. */
  readonly now?: () => number;
}

const DEFAULT_PER_PRODUCER_MS = 30_000;
const DEFAULT_MAX_RUN_MS = 120_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("__producer_timeout__")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export class IngestionOrchestrator {
  constructor(
    private readonly ledger: ShadowLedger,
    private readonly producers: ReadonlyArray<SourceProducer>,
    private readonly opts: OrchestratorOptions = {},
  ) {}

  async run(world: WorldRef): Promise<IngestionRunSummary> {
    const perMs = this.opts.perProducerTimeoutMs ?? DEFAULT_PER_PRODUCER_MS;
    const phaseA = this.producers.filter((p) => p.phase === "A");
    const phaseB = this.producers.filter((p) => p.phase === "B");

    const outcomes: SourceOutcome[] = [];
    let ingested = 0;
    let duplicates = 0;

    const ingestAll = (events: ReadonlyArray<ShadowEvent>) => {
      for (const e of events) {
        const r = this.ledger.ingest(e);
        if (r.status === "ingested") ingested++;
        else duplicates++;
      }
    };

    // ── Phase A: parallel, then a hard barrier (await all commits) ─────────────
    const aResults = await Promise.all(
      phaseA.map((p) => this.runProducer(p, world, perMs)),
    );
    for (const { outcome, events } of aResults) {
      outcomes.push(outcome);
      ingestAll(events); // commit BEFORE phase B starts (the ordering invariant)
    }

    // ── Phase B: serial — runs only after every Phase-A subject is committed ───
    for (const p of phaseB) {
      const { outcome, events } = await this.runProducer(p, world, perMs);
      outcomes.push(outcome);
      ingestAll(events);
    }

    const degraded = outcomes.some(
      (o) => o.criticality === "required" && o.status !== "ok",
    );
    const timed_out = outcomes.some((o) => o.status === "timeout");
    const source_freshness: Record<string, "ok" | "stale"> = {};
    for (const o of outcomes) source_freshness[o.kind] = o.status === "ok" ? "ok" : "stale";

    return {
      community_id: world.community_id,
      degraded,
      timed_out,
      ingested,
      duplicates,
      sources: outcomes,
      source_freshness,
    };
  }

  private async runProducer(
    p: SourceProducer,
    world: WorldRef,
    perMs: number,
  ): Promise<{ outcome: SourceOutcome; events: ReadonlyArray<ShadowEvent> }> {
    try {
      const events = await withTimeout(p.produce(world), perMs);
      return {
        events,
        outcome: {
          kind: p.kind,
          criticality: p.criticality,
          status: "ok",
          event_count: events.length,
        },
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "__producer_timeout__";
      const msg = err instanceof ProducerError ? err.message : String(err);
      return {
        events: [],
        outcome: {
          kind: p.kind,
          criticality: p.criticality,
          status: isTimeout ? "timeout" : "error",
          event_count: 0,
          error: isTimeout ? "producer timed out" : msg,
        },
      };
    }
  }
}
