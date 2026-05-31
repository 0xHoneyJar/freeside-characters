// onboarding barrel — cycle-009 onboarding character substrate.
// The secure interaction→web verify flow: token handoff (C3), identity-api client (C5),
// the public verify card (C1). Consumed by apps/bot's onboarding-dispatch (C2).

export {
  mintToken,
  validateToken,
  consumeToken,
  isWallet,
  appendJsonl,
  type HandoffState,
} from './state-token.ts';

export {
  makeFreesideAuthClient,
  AuthHttpError,
  AuthNetworkError,
  AuthDecodeError,
  AuthInvalidInput,
  type AuthError,
  type FreesideAuthClient,
  type FreesideAuthConfig,
  type ResolveResult,
  type ChallengeResult,
  type VerifyResult,
  type LinkResult,
} from './freeside-auth-client.ts';

export {
  buildVerifyCard,
  buildVerifyCardForWorld,
  ONBOARD_PREFIX,
  ONBOARD_VERIFY_CUSTOM_ID,
  type VerifyCardOpts,
} from './verify-card.ts';

export { getSurfaceConfig, type SurfaceConfig } from './surface-config.ts';

export {
  buildSiweMessage,
  recoverPersonalSign,
  verifySiweSignature,
  type SiweMessageParams,
  type SiweVerifyInput,
  type SiweVerdict,
} from './siwe.ts';

export {
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordUser,
  type OAuthConfig,
  type OAuthResult,
} from './oauth.ts';

export {
  issueOAuthState,
  consumeOAuthState,
  issueSiweNonce,
  claimSiweNonce,
  type SiweNonceRecord,
} from './verify-session.ts';

export { grantVerifiedRole, type RoleGrantConfig } from './role-grant.ts';

export {
  recordVerifyEvent,
  verifyMetricsSnapshot,
  resetVerifyMetrics,
  type VerifyEvent,
} from './observability.ts';

export {
  auditLink,
  recordConflictForReview,
  type ConflictKind,
  type LinkAuditRecord,
  type ConflictReviewRecord,
} from './onboarding-records.ts';
