/**
 * OTEL layer (cycle-005 S5 · FR-6).
 *
 * `@opentelemetry/api` direct path (SOFT-4 fallback per S0 spike —
 * cycle-004 substrate not landed yet). When cycle-004 lands, this
 * module can be swapped for an `@effect/opentelemetry` Layer without
 * changing call sites (they import `getTracer` + use the OTEL API
 * directly).
 *
 * Production setup: `BatchSpanProcessor` + OTLP HTTP exporter via
 * `OTEL_EXPORTER_OTLP_ENDPOINT` env. Absent endpoint → spans buffer
 * in the BatchSpanProcessor's default-bounded queue and drop on
 * overflow; chat compose never blocks (NFR per SDD failure-modes).
 *
 * Init is idempotent: `initOtelLive()` returns the singleton provider
 * once registered with `trace.setGlobalTracerProvider`. Re-calls are
 * no-ops. Tests use `otel-test.ts` instead and reset between runs.
 */

import { trace, type Tracer } from '@opentelemetry/api';
import { Resource, defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const SERVICE_NAME = 'freeside-characters';
const SERVICE_VERSION = process.env.SERVICE_VERSION ?? '0.7.0';
const TRACER_NAME = SERVICE_NAME;

let initialized = false;
let provider: NodeTracerProvider | null = null;

/**
 * Initialize the OTEL tracer provider. Safe to call multiple times —
 * subsequent calls are no-ops (returns the existing singleton tracer).
 *
 * Reads `OTEL_EXPORTER_OTLP_ENDPOINT` for the OTLP HTTP target. When
 * unset, the provider still registers but the BatchSpanProcessor's
 * queue drains to /dev/null (drops on overflow); no error surfaces.
 */
export function initOtelLive(): Tracer {
  if (initialized) return trace.getTracer(TRACER_NAME);

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    }),
  );

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();
  initialized = true;
  return trace.getTracer(TRACER_NAME);
}

/**
 * Return the canonical tracer for the persona-engine namespace. Initializes
 * the provider if absent (idempotent). Call this from any compose stage
 * that wants to emit a span.
 */
export function getTracer(): Tracer {
  if (!initialized) initOtelLive();
  return trace.getTracer(TRACER_NAME);
}

/**
 * Test-only reset: drops the singleton + clears the init flag so that
 * `otel-test.ts` can re-register a different provider in test fixtures.
 * NEVER call from production paths.
 */
export function _resetOtelForTests(): void {
  provider?.shutdown();
  provider = null;
  initialized = false;
}
