// onboarding-runtime.ts — T5.3 · build the onboarding + verify runtimes from env (cycle-009 · sprint-5).
//
// Mirrors the quest-runtime wiring pattern: a single builder reads env and returns the two
// runtimes (the C2 dispatch runtime + the C4 verify-web runtime), or null when the required
// secrets are absent — in which case onboarding stays OFF (no-op dispatch · 404 verify routes),
// exactly like the DISCORD_PUBLIC_KEY gate on the interactions endpoint. The live THJ deploy stays
// gated on DEP-A (identity-api resolveByDiscord); set ONBOARDING_IDEMPOTENT_MODE=resolve-by-wallet
// to ship before DEP-A lands (degraded idempotency · IMP-002).

import {
  makeFreesideAuthClient,
  grantVerifiedRole,
} from '@freeside-characters/persona-engine/onboarding';
import { interactionInvoker } from './discord-interactions/types.ts';
import type { OnboardingRuntime } from './discord-interactions/onboarding-dispatch.ts';
import type { VerifyRuntime } from './verify/verify-routes.ts';

const DEFAULT_IDENTITY_API = 'https://identity.0xhoneyjar.xyz';
const DEFAULT_CHAIN_ID = 80094; // berachain mainnet
const DEFAULT_STATEMENT = 'link your wallet to your discord to unlock the verified role.';

export interface OnboardingWiring {
  onboarding: OnboardingRuntime;
  verify: VerifyRuntime;
}

/** Build both runtimes from env, or null if onboarding is not fully configured (→ stays off). */
export function buildOnboardingWiringFromEnv(env: NodeJS.ProcessEnv = process.env): OnboardingWiring | null {
  const origin = env.VERIFY_ORIGIN?.trim();
  const clientId = env.DISCORD_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.DISCORD_OAUTH_CLIENT_SECRET?.trim();
  const serviceToken = env.IDENTITY_SERVICE_TOKEN?.trim();
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  const roleId = env.ONBOARDING_VERIFIED_ROLE_ID?.trim();
  const stateSecret = env.ONBOARDING_STATE_SECRET?.trim();

  // require the full set — any missing piece keeps onboarding off (fail-safe, not fail-broken).
  if (!origin || !clientId || !clientSecret || !serviceToken || !botToken || !roleId || !stateSecret) {
    return null;
  }

  let domain: string;
  try {
    domain = new URL(origin).host;
  } catch {
    return null; // a malformed VERIFY_ORIGIN disables onboarding rather than misconfiguring SIWE
  }

  const identityUrl = env.IDENTITY_API_URL?.trim() || DEFAULT_IDENTITY_API;
  const chainId = Number(env.ONBOARDING_CHAIN_ID?.trim() || DEFAULT_CHAIN_ID);
  const statement = env.ONBOARDING_STATEMENT?.trim() || DEFAULT_STATEMENT;
  const redirectUri = env.DISCORD_OAUTH_REDIRECT_URI?.trim() || `${origin.replace(/\/+$/, '')}/verify/oauth/callback`;
  const idempotentMode =
    env.ONBOARDING_IDEMPOTENT_MODE?.trim() === 'resolve-by-wallet' ? 'resolve-by-wallet' : 'resolve-by-discord';

  const authClient = makeFreesideAuthClient({ baseUrl: identityUrl, serviceToken });
  const grant = (discordId: string, guildId: string) =>
    grantVerifiedRole(discordId, guildId, { botToken, roleId });

  const verify: VerifyRuntime = {
    enabled: true,
    domain,
    origin: origin.replace(/\/+$/, ''),
    chainId,
    statement,
    oauth: { clientId, clientSecret, redirectUri },
    authClient,
    grantRole: grant,
  };

  const onboarding: OnboardingRuntime = {
    authClient,
    verifyBaseUrl: origin.replace(/\/+$/, ''),
    idempotentMode,
    regrantRole: async (interaction) => {
      const invoker = interactionInvoker(interaction);
      if (interaction.guild_id) await grant(invoker.id, interaction.guild_id);
    },
    noRuntime: false,
  };

  return { onboarding, verify };
}
