/**
 * shadow/role-sync-interaction.ts — the Discord-interaction ADAPTER for the
 * voiceless tier→role sync trigger (bd-71y).
 *
 * Maps a Discord `APPLICATION_COMMAND` interaction (`/role-sync`) onto the
 * testable trigger CORE (`role-sync-trigger.ts::runRoleSyncTrigger`):
 *   • reads the `mode` option (SHADOW preview default | LIVE apply) — SAFE-BY-
 *     DEFAULT via `parseRoleSyncMode`;
 *   • resolves the CM's actor from the VERIFIED AuthContext the auth-bridge
 *     attached (`claims.sub` = identity-api user_id) — a non-verified invocation
 *     is refused by the core before any read;
 *   • runs the trigger and maps the structured outcome → a Discord response.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * This adapter has NO persona-engine import and emits NO persona voice. On a
 * `rendered` outcome it sends the STRUCTURAL CV2 payload verbatim (flags +
 * components from `role-sync-result-cv2`); on `refused`/`error` it sends a plain
 * ephemeral status string. The structural render owns the message shape.
 *
 * ── IMPORT-BOUNDARY ──────────────────────────────────────────────────────────
 * This module performs NO discord.js role mutation — it only reads the
 * interaction + builds a response payload. All role writes happen INSIDE the
 * INJECTED `OrchestrationInvoker` (runTierRoleGoLive → the substrate gate →
 * `role-writer.live.ts`, the single gated adapter).
 */
import type {
  DiscordInteraction,
  DiscordInteractionResponse,
} from "../discord-interactions/types.ts";
import {
  InteractionResponseType,
  MessageFlags,
  interactionInvoker,
} from "../discord-interactions/types.ts";
import type { AuthContext } from "../auth-bridge.ts";
import {
  runRoleSyncTrigger,
  parseRoleSyncMode,
  ROLE_SYNC_MODE_OPTION,
  type RoleSyncTriggerDeps,
  type ActorResolver,
  type RoleSyncOutcome,
} from "./role-sync-trigger.ts";

/**
 * Build an {@link ActorResolver} from the bot's existing per-interaction
 * AuthContext. ONLY a `verified` context yields an actor (its `claims.sub` is the
 * identity-api user_id). anon / anon-fallback ⇒ null ⇒ the core refuses. This is
 * the existing identity path the bot uses for verify — NOT a new surface.
 */
export function actorResolverFromAuth(auth: AuthContext | undefined): ActorResolver {
  return () => {
    if (!auth || auth.kind !== "verified") return null;
    const sub = auth.claims.sub;
    if (typeof sub !== "string" || sub.length === 0) return null;
    return { actor: sub };
  };
}

/** Read the `mode` string option from the interaction (SHADOW/LIVE; default SHADOW). */
function readModeOption(interaction: DiscordInteraction): string | undefined {
  const opt = interaction.data?.options?.find((o) => o.name === ROLE_SYNC_MODE_OPTION);
  if (!opt || typeof opt.value !== "string") return undefined;
  return opt.value;
}

/**
 * The deps the interaction adapter needs beyond the per-interaction AuthContext:
 * the trigger-core deps WITHOUT `resolveActor` (the adapter supplies that) —
 * everything else (world, role-map reader, orchestration invoker, world-config,
 * token metadata, transition version, clock) is deploy-provided.
 *
 * ── ISOLATED ACTOR RESOLUTION (bd-atm, OPTIONAL) ─────────────────────────────
 * `actorResolverFor` — when the deploy wires it — makes `/role-sync` resolve the
 * invoking CM's actor ITSELF (invoking Discord user id → identity-api
 * `GET /v1/resolve/account/discord/{id}` → user_id), INDEPENDENT of the global
 * `AUTH_BACKEND`. The onboarding/role-dispenser is a separable, voiceless
 * building (onboarding-as-voiceless-building brief) — it MUST NOT infer its
 * identity system from the persona daemon's auth backend.
 *
 * When `actorResolverFor` is ABSENT, the adapter falls back to the legacy
 * `actorResolverFromAuth(auth)` (the per-interaction verified AuthContext). The
 * boot composition (role-sync-boot.ts) supplies the isolated factory; the legacy
 * path remains for tests / deployments that already run the freeside-jwt backend.
 */
export type RoleSyncInteractionDeps = Omit<RoleSyncTriggerDeps, "resolveActor"> & {
  /**
   * OPTIONAL isolated actor-resolver factory keyed on the invoking Discord user
   * id. The adapter reads the id from the interaction and calls this; the
   * returned thunk performs the identity-api lookup (fail-closed → null ⇒ refuse).
   * Independent of AUTH_BACKEND. When omitted, the adapter uses the AuthContext.
   */
  readonly actorResolverFor?: (discordId: string | undefined) => ActorResolver;
};

/**
 * Handle a `/role-sync` APPLICATION_COMMAND interaction. Resolves the actor from
 * `auth`, parses the mode (SAFE-BY-DEFAULT SHADOW), runs the trigger core, and
 * maps the outcome → a Discord response (ephemeral — a CM admin action is
 * invoker-only). PURE w.r.t. discord.js: builds a response payload, never writes.
 */
export async function handleRoleSyncInteraction(
  interaction: DiscordInteraction,
  auth: AuthContext | undefined,
  deps: RoleSyncInteractionDeps,
): Promise<DiscordInteractionResponse> {
  const mode = parseRoleSyncMode(readModeOption(interaction));

  // ── ISOLATED actor resolution (bd-atm) takes precedence when the deploy wired
  //    `actorResolverFor`: resolve the invoking CM's actor from the invoking
  //    Discord user id → identity-api, INDEPENDENT of AUTH_BACKEND. The legacy
  //    AuthContext path is the fallback (deployments already on freeside-jwt).
  const { actorResolverFor, ...triggerDeps } = deps;
  const resolveActor: ActorResolver = actorResolverFor
    ? actorResolverFor(interactionInvoker(interaction).id)
    : actorResolverFromAuth(auth);

  const outcome: RoleSyncOutcome = await runRoleSyncTrigger(
    { ...triggerDeps, resolveActor },
    mode,
  );

  return roleSyncOutcomeToResponse(outcome);
}

/**
 * Map a {@link RoleSyncOutcome} → a Discord interaction response. EPHEMERAL on
 * every path (a CM admin action is invoker-only). `rendered` sends the structural
 * CV2 payload (merging the EPHEMERAL flag with the CV2 IS_COMPONENTS_V2 flag);
 * `refused`/`error` send a plain voiceless status string.
 */
export function roleSyncOutcomeToResponse(outcome: RoleSyncOutcome): DiscordInteractionResponse {
  if (outcome.kind === "rendered") {
    // CV2 payloads MUST NOT carry content/embeds. Merge the EPHEMERAL flag into
    // the CV2 flags (IS_COMPONENTS_V2 | EPHEMERAL) so the admin preview is
    // invoker-only AND renders as components.
    const data = {
      ...outcome.payload,
      flags: outcome.payload.flags | MessageFlags.EPHEMERAL,
    } as unknown as DiscordInteractionResponse["data"];
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data,
    };
  }

  const message = outcome.kind === "refused" ? outcome.message : outcome.message;
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
      flags: MessageFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    },
  };
}
