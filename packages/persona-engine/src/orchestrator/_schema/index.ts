/**
 * Effect.Schema MCP contract substrate (V0.7-A.4 · session 03).
 *
 * Exports:
 *   - `McpToolContract` / `McpServerContract` types (contract.ts)
 *   - `decodeInput` / `decodeOutput` boundary helpers (runtime.ts)
 *   - `assertZodParity` type-level Effect↔Zod parity check (runtime.ts)
 *
 * Each MCP server lives in `<mcp>/{schema.ts, server.ts}`. The schema
 * module declares contracts using these primitives; the server module
 * binds contracts to runtime handlers via the SDK's `tool()` API.
 *
 * Federation alignment: the same `Schema.Schema<...>` shapes used here
 * appear in `freeside-mcp-gateway/src/tenants.ts`. When an in-bot MCP
 * promotes to a federated tenant (per docs/MCP-FEDERATION.md), the
 * contract travels with it.
 */

export type { McpToolContract, McpServerContract } from "./contract.ts";
export {
  decodeInput,
  decodeOutput,
  assertZodParity,
} from "./runtime.ts";
