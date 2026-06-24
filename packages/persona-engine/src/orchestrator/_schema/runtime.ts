/**
 * Runtime helpers for Effect.Schema-typed MCP contracts.
 *
 * Currently exports a single primitive: `assertZodParity<T>()(shape)` —
 * a TYPE-LEVEL helper that enforces the Effect↔Zod boundary at compile
 * time (no runtime cost; function body is a no-op identity).
 *
 * Bridgebuilder F1 (PR #18 review · 2026-05-02): earlier drafts also
 * shipped `decodeInput`/`decodeOutput` boundary helpers as
 * defense-in-depth. Removed because the SDK's Zod validation already
 * runs at the JSON-RPC boundary and tests call `Schema.decodeUnknownSync`
 * directly — parallel validators create "which one was authoritative?"
 * incidents under postmortem (the AWS Smithy migration cited it). If a
 * downstream surface needs explicit Effect.decode (e.g., the v0.3
 * federation broadcast manifest), reintroduce locally rather than as a
 * shared substrate primitive.
 */

import type { z } from "zod";

/**
 * Type-level parity check: caller passes the Effect schema's decoded
 * type as the type parameter, and a Zod shape that produces the same
 * structural type. Compilation fails on drift.
 *
 * Usage:
 *   const PickByMoodInput = Schema.Struct({...});
 *   type PickByMoodInputT = Schema.Schema.Type<typeof PickByMoodInput>;
 *   export const pickByMoodInputZod = assertZodParity<PickByMoodInputT>()({
 *     mood: MoodEnumZod,
 *     kind: KindEnumZod.optional(),
 *   });
 *
 * The two-phase call pattern (`assertZodParity<T>()(shape)`) is required
 * to let TypeScript infer the shape parameter while constraining the
 * structural target type. Single-phase generics force callers to spell
 * out both, which defeats the ergonomics.
 */
export function assertZodParity<T>(): <S extends z.ZodRawShape>(
  shape: ZodRawShapeFor<T> & S,
) => S {
  return (shape) => shape;
}

/**
 * Mapped type: for each key K of T, require a Zod schema whose `_output`
 * matches T[K]. Optional keys (T[K] includes undefined) accept either a
 * `ZodOptional<...>` wrapping the value type OR a Zod schema that already
 * unions undefined.
 *
 * This is a structural check, not a nominal one — the Zod schema is free
 * to be authored independently as long as its decoded type aligns. Drift
 * surfaces as a TypeScript error at the `assertZodParity` call site.
 */
type ZodRawShapeFor<T> = {
  [K in keyof T]-?: undefined extends T[K]
    ? z.ZodType<T[K]> | z.ZodOptional<z.ZodType<NonNullable<T[K]>>>
    : z.ZodType<T[K]>;
};
