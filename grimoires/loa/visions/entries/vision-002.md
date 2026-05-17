# Vision: Layer-tagged OTEL spans bridge local CLI to prod observability

**ID**: vision-002
**Source**: Bridge iteration 1 of design-review-simstim-20260516-6f5c6d18
**PR**: #unknown
**Date**: 2026-05-17T03:16:52Z
**Status**: Captured
**Tags**: [architecture]

## Insight

The envelope's layer + layer_op fields are semantically OTEL span attributes (service.name, operation). cycle-007 emits to JSONL files; cycle-008+ could emit to both JSONL (local CLI) AND OTEL exporter (prod). The Raindrop substrate Loa is already using elsewhere speaks OTEL. Bridging unlocks cross-cycle pattern detection at the dashboard level.

## Potential

To be explored

## Connection Points

- Bridgebuilder finding: speculation-2
- Bridge: design-review-simstim-20260516-6f5c6d18, iteration 1
