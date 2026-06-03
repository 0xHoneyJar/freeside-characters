/**
 * shadow/role-writer.mock.ts — the MOCK `RoleWriter` Layer (Sprint 405 / Task
 * 405.2, SDD §4.5). Captures WRITE-INTENT only — performs ZERO Discord calls.
 *
 * This is the shadow/visualize half of the mock↔live switch: shadow-preview
 * runs on this writer so a preview NEVER mutates a real guild. A test reads the
 * captured intents to assert "the loop produced N intents but zero real writes".
 *
 * The mock is still CHECK-THEN-CREATE-faithful: a `createRole` for a `role_key`
 * already captured in THIS layer returns the prior synthetic id (idempotent), so
 * the gate's idempotent-create semantics are exercised end-to-end without I/O.
 *
 * Mirrors the persona-engine `*.mock.ts` idiom (`Layer.succeed` + module-level
 * recorder + `reset*`), like `wallet-resolver.mock.ts`.
 */
import { Effect, Layer } from "effect";
import { RoleWriter } from "./substrate.ts";
import type {
  WriteCapability,
  CreateRoleIntent,
  AssignRoleIntent,
} from "@freeside-worlds/shadow-substrate";

export interface CapturedCreate {
  readonly kind: "create_role";
  readonly role_key: string;
  readonly display_name: string;
  readonly synthetic_role_id: string;
}
export interface CapturedAssign {
  readonly kind: "assign_role";
  readonly role_key: string;
  readonly member_id: string;
}
export type CapturedWrite = CapturedCreate | CapturedAssign;

const _writes: CapturedWrite[] = [];
const _createdByKey = new Map<string, string>();
let _seq = 0;

/** Every captured write-intent (read by tests after a run). */
export function capturedWrites(): readonly CapturedWrite[] {
  return _writes;
}
/** Count of REAL Discord writes the mock performed — always 0 (invariant). */
export const REAL_DISCORD_WRITES = 0;

export function resetMockRoleWriter(): void {
  _writes.length = 0;
  _createdByKey.clear();
  _seq = 0;
}

export const RoleWriterMock: Layer.Layer<RoleWriter> = Layer.succeed(
  RoleWriter,
  RoleWriter.of({
    createRole: (_cap: WriteCapability, intent: CreateRoleIntent) =>
      Effect.sync(() => {
        const prior = _createdByKey.get(intent.role_key);
        if (prior !== undefined) {
          return prior as never; // idempotent — no second synthetic id
        }
        const id = `mock-role-${++_seq}`;
        _createdByKey.set(intent.role_key, id);
        _writes.push({
          kind: "create_role",
          role_key: intent.role_key,
          display_name: intent.display_name,
          synthetic_role_id: id,
        });
        return id as never;
      }),
    assignRole: (_cap: WriteCapability, intent: AssignRoleIntent) =>
      Effect.sync(() => {
        _writes.push({
          kind: "assign_role",
          role_key: intent.role_key,
          member_id: intent.member_id as unknown as string,
        });
      }),
  }),
);
