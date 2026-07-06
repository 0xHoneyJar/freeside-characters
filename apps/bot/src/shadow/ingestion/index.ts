/**
 * @freeside-characters/member-ingestion (barrel) — cycle-010 S1.1 (SDD §4.1, BR-3).
 *
 * The single import surface for the multi-angle member-graph ingestion layer.
 * Physically in apps/bot/src/shadow/ingestion/ for now; extraction to the future
 * `freeside-onboarding` building is a package move, not an N-caller refactor
 * (it imports NO persona-engine voice — lint-enforced). VOICELESS.
 */
export * from "./shadow-mode-contract.ts";
export * from "./source-producer.ts";
export { canonicalJSON, computeEventId, makeEvent, type MakeEventMeta } from "./event.ts";
export {
  InMemoryLedgerStore,
  ShadowLedger,
  ProjectionReader,
} from "./ledger-host.ts";
export {
  IngestionOrchestrator,
  type IngestionRunSummary,
  type SourceOutcome,
  type OrchestratorOptions,
} from "./orchestrator.ts";
export {
  makeDiscordRosterProducer,
  type DiscordRosterProducerDeps,
  type RosterReader,
} from "./discord-roster-producer.ts";
export {
  makeOnChainHolderProducer,
  type OnChainHolderProducerDeps,
} from "./onchain-holder-producer.ts";
export {
  fetchSonarHolders,
  type SonarHolder,
  type SonarHoldersClientConfig,
} from "./sonar-holders-client.ts";
export {
  makeIdentityLinkProducer,
  type IdentityLink,
  type IdentityLinkReader,
  type IdentityLinkProducerDeps,
} from "./identity-link-producer.ts";
export {
  makeIdentityLinkReaderLive,
  type WalletLinkResolver,
  type ResolvedWalletLink,
  type IdentityLinkReaderLiveDeps,
} from "./identity-link.live.ts";
export {
  ConflictQuarantine,
  detectConflict,
  type ConflictQuarantineEntry,
} from "./quarantine.ts";
export {
  renderMemberGraphCV2,
  memberGraphCV2Payload,
  summarizeGraph,
  degradedBanner,
  enrichDisplayNames,
  KIND_DISPLAY,
  type ContainerComponent,
  type MemberGraphSummaryCounts,
  type MemberGraphRenderOptions,
} from "./member-graph-view.ts";
export {
  interactionMediumBinding,
  assertCapability,
  DISCORD_INTERACTION_DESCRIPTOR,
  DISCORD_WEBHOOK_DESCRIPTOR,
  type IMediumBinding,
  type MediumDescriptor,
  type MediumKind,
} from "./medium-binding.ts";
export {
  registerCommunity,
  missingFields,
  parseShadowOnboarding,
  manifestPathForWorld,
  RegistrationError,
  type ShadowOnboardingConfig,
  type RegisterOptions,
  type RegistrationResult,
} from "./registration.ts";
