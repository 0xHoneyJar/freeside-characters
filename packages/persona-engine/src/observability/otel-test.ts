/**
 * OTEL test layer (cycle-005 S5).
 *
 * In-memory span exporter for assertion-based testing. Replaces the
 * production NodeTracerProvider with one that exports synchronously
 * to an `InMemorySpanExporter`, so tests can:
 *
 *   1. `initOtelTest()` returns `{tracer, exporter}`
 *   2. exercise digest-orchestrator (or other tracer consumers)
 *   3. `exporter.getFinishedSpans()` returns the span tree for assertions
 *   4. `resetOtelTest()` clears state between tests
 *
 * Uses `SimpleSpanProcessor` (synchronous) instead of `BatchSpanProcessor`
 * so finished spans are visible immediately without awaiting flush. The
 * test environment intentionally accepts this perf trade-off for
 * deterministic assertions.
 */

import { trace, type Tracer } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const TRACER_NAME = 'freeside-characters';

let testProvider: NodeTracerProvider | null = null;
let testExporter: InMemorySpanExporter | null = null;

export interface OtelTestHandle {
  tracer: Tracer;
  exporter: InMemorySpanExporter;
  /** Drop all in-memory spans; tracer + provider stay registered. */
  reset(): void;
  /** Return all spans finished since the last reset (clone-safe). */
  getFinishedSpans(): ReadonlyArray<ReadableSpan>;
}

export function initOtelTest(): OtelTestHandle {
  if (testProvider) {
    return {
      tracer: trace.getTracer(TRACER_NAME),
      exporter: testExporter!,
      reset: () => testExporter!.reset(),
      getFinishedSpans: () => testExporter!.getFinishedSpans(),
    };
  }
  testExporter = new InMemorySpanExporter();
  testProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(testExporter)],
  });
  testProvider.register();
  return {
    tracer: trace.getTracer(TRACER_NAME),
    exporter: testExporter,
    reset: () => testExporter!.reset(),
    getFinishedSpans: () => testExporter!.getFinishedSpans(),
  };
}

export function resetOtelTest(): void {
  testProvider?.shutdown();
  testProvider = null;
  testExporter = null;
}
