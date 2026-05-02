/**
 * Runtime helpers for Effect.Schema-typed MCP contracts.
 *
 * `decodeInput` / `decodeOutput` run Effect's boundary decode against a
 * tool contract. Used by:
 *   - boundary contract tests (§4.3a) to verify the schema rejects
 *     malformed input + accepts valid input,
 *   - handlers that want defense-in-depth validation (the SDK's Zod
 *     layer ALREADY validates; Effect.decode is redundant in production
 *     but proves contract parity in tests).
 *
 * `assertZodParity` is a TYPE-LEVEL helper invoked once per tool's
 * schema.ts — it accepts a Zod shape that must produce the same type
 * as the Effect schema. If the two drift, TypeScript fails at the call
 * site. No runtime cost; the function body is a no-op identity.
 */

import { Schema } from "effect";
import type { z } from "zod";
import type { McpToolContract } from "./contract.ts";

export function decodeInput<TInput, TOutput>(
  contract: McpToolContract<TInput, TOutput>,
  raw: unknown,
): TInput {
  return Schema.decodeUnknownSync(contract.input)(raw);
}

export function decodeOutput<TInput, TOutput>(
  contract: McpToolContract<TInput, TOutput>,
  raw: unknown,
): TOutput {
  return Schema.decodeUnknownSync(contract.output)(raw);
}

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
