// Public surface for the score shim (cycle-008 capability-wiring slice 3).
//
// External consumers import the score contract from HERE, not from `./types.ts` directly,
// so the shim's single swap-point is this file: if `@score-vault/ports` ever lands (the
// maybe-never arc — operator steered away from npm), only this re-export changes, not the
// ~57 call sites. `score/types.ts` stays the hand-mirror, kept honest by `schema-drift.test.ts`.
//
// Intra-`score/` files (client.ts, schema-drift.test.ts) still import `./types.ts` directly —
// they ARE the module internals; the barrel is the boundary for everyone outside it.

export * from './types.ts';
