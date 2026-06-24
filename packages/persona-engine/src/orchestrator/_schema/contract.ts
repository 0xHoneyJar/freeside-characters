/**
 * MCP contract base types — Effect.Schema-typed.
 *
 * The CONTRACT for an MCP tool: name, description, typed input + output,
 * optional examples. Each in-bot MCP server (rosenzu, emojis,
 * freeside_auth, imagegen) declares its tools as `McpToolContract`
 * instances co-located in `<mcp>/schema.ts`. The server's `server.ts`
 * derives its SDK registration from these contracts — the schema is the
 * single source of truth for tool name, description, and shape.
 *
 * Why Effect.Schema (not Zod alone):
 *   - Aligns with `freeside-mcp-gateway` (effect ^3.21.2 since v0.1.0).
 *     The `gateway-as-registry` doctrine treats per-tenant schemas as the
 *     federation broadcast surface; same shape across in-bot AND federated
 *     MCPs lets in-bot MCPs promote to flavor-2 tenants without rewriting
 *     contracts.
 *   - Effect.decode/encode boundary semantics let the same contract
 *     describe wire shape (`/.well-known/mcp.json`) and in-process shape
 *     (SDK tool() registration).
 *   - Annotations carry through to the human-readable manifest.
 *
 * The SDK reality (the constraint we work around):
 *   The Anthropic Claude Agent SDK's `tool()` registration accepts a
 *   ZodRawShape for input validation — not arbitrary schemas. Effect
 *   schemas can't be handed in directly. Pattern in `<mcp>/schema.ts`:
 *   declare the Effect contract as canonical, declare the SDK-binding
 *   Zod shape alongside, and assert parity via a `z.ZodType<EffectType>`
 *   line. If they drift, compilation fails at the parity assertion.
 *
 * Reference: `freeside-mcp-organization-kickoff-2026-05-01.md` §4.1 + §5.
 */

import type { Schema } from "effect";

/**
 * Contract for a single MCP tool.
 *
 * Type parameters:
 *   - TInput: the decoded input type (what the handler receives after
 *     SDK Zod validation). Equal to `Schema.Schema.Type<typeof input>`.
 *   - TOutput: the response shape the handler returns. The orchestrator
 *     wraps this in an MCP `content[]` envelope; the contract type is
 *     the unwrapped payload.
 *
 * `examples`: optional. When present, examples are doctested by the
 * boundary contract test (§4.3a) — example.input must round-trip
 * through the input schema, and example.output must validate against
 * the output schema.
 */
export interface McpToolContract<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly input: Schema.Schema<TInput, any, never>;
  readonly output: Schema.Schema<TOutput, any, never>;
  readonly examples?: ReadonlyArray<{
    readonly description?: string;
    readonly input: TInput;
    readonly output: TOutput;
  }>;
}

/**
 * Contract for an MCP server — name + version + tools.
 *
 * The server `name` MUST match the registration key in
 * `orchestrator/index.ts` `buildMcpServers()` (e.g. `'emojis'`).
 * Cross-checked by the surface-completeness test (§4.3b) which reads
 * each server's contract and asserts its name appears in the registered
 * `mcpServers` map for any character that declares this server in
 * `character.json` `mcps[]`.
 */
export interface McpServerContract {
  readonly name: string;
  readonly version: string;
  readonly tools: ReadonlyArray<McpToolContract<any, any>>;
}
