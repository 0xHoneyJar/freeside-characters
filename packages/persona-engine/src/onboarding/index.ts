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
  ONBOARD_PREFIX,
  ONBOARD_VERIFY_CUSTOM_ID,
  type VerifyCardOpts,
} from './verify-card.ts';
