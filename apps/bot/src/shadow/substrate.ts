/**
 * shadow/substrate.ts — the single import surface for the SHA-pinned
 * `@freeside-worlds/shadow-substrate` (Sprint 405 / S4, B7 3rd consumer).
 *
 * freeside-characters is a VOICELESS I/O actor: it supplies the substrate's I/O
 * Layers (RosterSource / RoleWriter / AcvpEmitter / AdminAllowlistSource /
 * WorldLock), renders the substrate's `Discrepancy` read-model, and fires
 * events — it holds NO onboarding logic. The onboarding GOVERNOR (the gate, the
 * pure transition, the authz decision) lives entirely in the substrate (owned by
 * freeside-worlds). We consume it pinned at the cycle-canonical SHA
 * (substrate-sha.lock) and NEVER modify it.
 *
 * Re-exporting the substrate's symbols through ONE module keeps the seam
 * explicit and gives the cross-repo import-boundary lint (405.3) a single,
 * auditable surface to reason about: the ONLY module allowed to perform
 * discord.js role-mutation is `role-writer.live.ts` (the gated adapter), and it
 * obtains a `WriteCapability`-gated write path only through the substrate's
 * `GateCheckedRoleWriter` — never a raw `guild.roles.create`/`.add` elsewhere.
 */
export {
  // ── Ports (Context.Tags the actor supplies Layers for) ──
  RosterSource,
  RoleWriter,
  ScoreSource,
  AcvpEmitter,
  WorldLock,
  AdminAllowlistSource,
  // ── The gate (the ONLY write path) ──
  GateCheckedRoleWriter,
  makeGateCheckedRoleWriter,
  makeModeControl,
  goLive,
  rollback,
  resolveAuthz,
  resolveReader,
  // ── Pure compute core ──
  roleMapVersionHash,
  computeProposed,
  diff,
  transition,
  // ── shadow.* ACVP event identifiers ──
  SHADOW_ROLE_REJECTED,
  SHADOW_ROLE_INTENT,
  SHADOW_ROLE_APPLIED,
  SHADOW_MODE_TRANSITIONED,
  SHADOW_AUTHZ_DECIDED,
  ShadowEventType,
  // ── Render-model + data schemas ──
  Discrepancy,
  ProposedRoster,
  CurrentRoster,
  BeforeRole,
  AfterRole,
  PreexistingRole,
  LatentQualified,
  RoleCountProjection,
  RoleMapConfig,
  ApplyModeConfig,
  OnboardingLifecycle,
  // ── Branded primitives + batch/authz data types ──
  Hex64,
  WorldSlug,
  RoleId,
  MemberId,
  ApplyMode,
  WriteOp,
  WriteIntentBatch,
  AuthzContext,
  GoLiveJobState,
  // ── Typed error ADT ──
  GuardFailed,
  ShadowGateRejected,
  WriteError,
  AuthzError,
  AuditError,
  RosterError,
  ScoreError,
} from "@freeside-worlds/shadow-substrate";

export type {
  WriteCapability,
  GateCheckedRoleWriterService,
  ApplyBatchResult,
  ModeControl,
  CreateRoleIntent,
  AssignRoleIntent,
  ShadowEvent,
} from "@freeside-worlds/shadow-substrate";
