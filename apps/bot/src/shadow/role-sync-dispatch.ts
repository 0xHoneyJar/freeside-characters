/**
 * shadow/role-sync-dispatch.ts — the two-step Apply→Confirm→LIVE component bridge
 * for the voiceless `/role-sync` CM dashboard (bd-20x).
 *
 * Mirrors onboarding-dispatch.ts: an early-detect predicate
 * (`isRoleSyncComponentInteraction`) lets dispatch.ts short-circuit a
 * MESSAGE_COMPONENT (type 3) click whose custom_id is in the reserved
 * `rolesync:` namespace, AFTER the anti-spam guard + circuit breaker + auth-bridge
 * (so the apply flow inherits all three). The `rolesync:` prefix is OWNED here
 * (mirrors ONBOARD_PREFIX prefix-ownership / isForeignOnboardSquat): a foreign
 * component squatting the prefix is rejected, not silently handled.
 *
 * ── THE STATE MACHINE (a SHADOW preview NEVER one-click-writes) ───────────────
 * The dashboard's Apply button is `rolesync:apply:<world>:<mapHash12>` — content-
 * addressed by the FR-7 map hash the preview was computed against. The flow:
 *
 *   [dashboard]  --click Apply-->  [CONFIRM card]  --click Confirm-->  [LIVE]
 *        ^                              |
 *        +----------click Cancel--------+
 *
 *   • rolesync:apply:…   → NON-MUTATING. UPDATE_MESSAGE (type 7) re-renders the
 *       SAME ephemeral container as a CONFIRM card (ADD-only count + role(s), the
 *       map hash + provenance, "does not touch Keep / Unlinked / Untiered"). It
 *       recomputes the roster (no write, no gate) so the count is fresh.
 *   • rolesync:cancel:… → NON-MUTATING. UPDATE_MESSAGE back to the dashboard.
 *   • rolesync:confirm:… → the ONLY mutating path. STALE GUARD first (recompute
 *       the FR-7 map hash, compare its first 12 hex to the custom_id; a mismatch
 *       re-previews — NEVER applies a stale map). Then DEFERRED_UPDATE_MESSAGE
 *       (type 6) + a background `runRoleSyncTrigger(deps, 'LIVE')` through the
 *       EXISTING gate (apply_mode + admin_principals re-check + write-after-audit +
 *       role-writer.live.ts) + PATCH @original with the LIVE receipt.
 *
 * The ACTOR is the CLICKER (interactionInvoker(interaction).id) so authz binds to
 * whoever confirmed — the same isolated-actor resolution the slash command uses.
 *
 * ── EPHEMERAL persists ───────────────────────────────────────────────────────
 * The preview is EPHEMERAL. UPDATE_MESSAGE / DEFERRED_UPDATE_MESSAGE operate on
 * the SAME ephemeral message, so every step stays invoker-only — Discord carries
 * the ephemeral flag through the message lifecycle (set at the original deferral).
 *
 * ── VOICELESS · ZERO DIRECT MUTATIONS ────────────────────────────────────────
 * NO persona-engine import. This module builds CV2 response payloads + maps
 * outcomes; it NEVER mutates a Discord role. The LIVE write happens INSIDE
 * `runRoleSyncTrigger(deps, 'LIVE')` → the substrate gate → role-writer.live.ts
 * (the single gated adapter). The structural renders own the message shape.
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
import {
  ROLE_SYNC_PREFIX,
  memberDashboardCV2Payload,
  applyConfirmCV2Payload,
  type MemberDashboardContext,
  type ApplyConfirmContext,
} from "./member-dashboard-cv2.ts";
import { roleSyncResultCV2Payload } from "./role-sync-result-cv2.ts";
import {
  resolveRoleSyncRoster,
  runRoleSyncTrigger,
  type ActorResolver,
  type RoleSyncTriggerDeps,
} from "./role-sync-trigger.ts";
import type { RoleSyncInteractionDeps } from "./role-sync-interaction.ts";
import { actorResolverFromAuth } from "./role-sync-interaction.ts";
import type { AuthContext } from "../auth-bridge.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";

/** The known component actions in the reserved `rolesync:` namespace. */
const ROLE_SYNC_APPLY = `${ROLE_SYNC_PREFIX}apply:`;
const ROLE_SYNC_CONFIRM = `${ROLE_SYNC_PREFIX}confirm:`;
const ROLE_SYNC_CANCEL = `${ROLE_SYNC_PREFIX}cancel:`;

/** Read the click's custom_id (empty string when absent). */
function customIdOf(interaction: DiscordInteraction): string {
  if (interaction.type !== 3) return "";
  return ((interaction.data as { custom_id?: string } | undefined)?.custom_id) ?? "";
}

/** True for a MESSAGE_COMPONENT click in the reserved `rolesync:` namespace. */
export function isRoleSyncComponentInteraction(interaction: DiscordInteraction): boolean {
  return customIdOf(interaction).startsWith(ROLE_SYNC_PREFIX);
}

/**
 * A foreign component that squats the reserved `rolesync:` prefix but is NOT a
 * known apply/confirm/cancel action is rejected (not silently handled) — mirrors
 * isForeignOnboardSquat (RT-6 prefix-ownership).
 */
export function isForeignRoleSyncSquat(interaction: DiscordInteraction): boolean {
  const id = customIdOf(interaction);
  if (!id.startsWith(ROLE_SYNC_PREFIX)) return false;
  return (
    !id.startsWith(ROLE_SYNC_APPLY) &&
    !id.startsWith(ROLE_SYNC_CONFIRM) &&
    !id.startsWith(ROLE_SYNC_CANCEL)
  );
}

/** Parse a `rolesync:<action>:<world>:<mapHash12>` custom_id. */
export interface ParsedRoleSyncCustomId {
  readonly action: "apply" | "confirm" | "cancel";
  readonly world: string;
  readonly mapHash12: string;
}

export function parseRoleSyncCustomId(customId: string): ParsedRoleSyncCustomId | null {
  if (!customId.startsWith(ROLE_SYNC_PREFIX)) return null;
  const rest = customId.slice(ROLE_SYNC_PREFIX.length);
  const [action, world, mapHash12] = rest.split(":");
  if (action !== "apply" && action !== "confirm" && action !== "cancel") return null;
  if (!world || world.length === 0) return null;
  if (typeof mapHash12 !== "string" || mapHash12.length === 0) return null;
  return { action, world, mapHash12 };
}

/**
 * Resolve the CLICKER's actor. When the deploy wired the isolated factory
 * (`actorResolverFor`), resolve from the clicking Discord user id → identity-api,
 * INDEPENDENT of AUTH_BACKEND (the same isolation the slash command uses). Else
 * fall back to the per-interaction verified AuthContext.
 */
function resolveClickerActor(
  interaction: DiscordInteraction,
  auth: AuthContext | undefined,
  deps: RoleSyncInteractionDeps,
): ActorResolver {
  return deps.actorResolverFor
    ? deps.actorResolverFor(interactionInvoker(interaction).id)
    : actorResolverFromAuth(auth);
}

/**
 * The testable outcome of a `rolesync:` component click — NETWORK-FREE w.r.t.
 * discord.js (the deps' ports are injected). The dispatch maps these to an
 * immediate Discord response (+ a background LIVE run for `confirm`).
 */
export type RoleSyncComponentOutcome =
  /** apply / cancel re-render: UPDATE_MESSAGE (type 7) with this CV2 payload. */
  | {
      readonly kind: "update";
      readonly payload: { flags: number; components: unknown[]; allowed_mentions: { parse: never[] } };
    }
  /**
   * confirm: the stale guard passed → run LIVE in the background, then PATCH the
   * receipt. `coreDeps` is the trigger-core deps with the CLICKER's `resolveActor`
   * already merged (so authz binds to whoever confirmed).
   */
  | { readonly kind: "confirm-live"; readonly coreDeps: RoleSyncTriggerDeps }
  /** a plain refusal / error: UPDATE_MESSAGE with a status string (keeps the container ephemeral). */
  | { readonly kind: "status"; readonly message: string };

/**
 * Compute the outcome of a `rolesync:` component click (the testable core). PURE
 * w.r.t. discord.js — every port is injected via `deps`. Resolves the CLICKER's
 * actor (refuses non-verified), then:
 *   • apply  → recompute the roster (no write) → the CONFIRM card.
 *   • cancel → recompute the roster (no write) → the dashboard.
 *   • confirm→ STALE GUARD (recompute hash, compare); pass ⇒ confirm-live; mismatch
 *              ⇒ re-render the dashboard (NEVER apply a stale map).
 */
export async function computeRoleSyncComponentOutcome(
  interaction: DiscordInteraction,
  auth: AuthContext | undefined,
  deps: RoleSyncInteractionDeps,
): Promise<RoleSyncComponentOutcome> {
  const parsed = parseRoleSyncCustomId(customIdOf(interaction));
  if (!parsed) {
    return { kind: "status", message: "that control is not available." };
  }

  const resolveActor = resolveClickerActor(interaction, auth, deps);
  const { actorResolverFor: _drop, ...triggerDeps } = deps;
  const coreDeps = { ...triggerDeps, resolveActor };

  // For apply / cancel / the confirm STALE GUARD we resolve the gate-free roster +
  // the FRESH map hash (this also performs the verified-actor refusal before any read).
  const resolution = await resolveRoleSyncRoster(coreDeps);
  if (resolution.kind === "refused") {
    return { kind: "status", message: resolution.message };
  }
  if (resolution.kind === "error") {
    return { kind: "status", message: resolution.message };
  }

  if (parsed.action === "cancel") {
    const ctx: MemberDashboardContext = {
      world: coreDeps.world,
      mapSource: resolution.mapSource,
      apply: { mapHash12: resolution.mapHash12 },
    };
    return { kind: "update", payload: memberDashboardCV2Payload(resolution.roster, ctx) };
  }

  if (parsed.action === "apply") {
    const ctx: ApplyConfirmContext = {
      world: coreDeps.world,
      mapSource: resolution.mapSource,
      // re-content-address the confirm against the FRESH hash (not the click's),
      // so confirm binds to what the CM is actually about to grant.
      mapHash12: resolution.mapHash12,
    };
    return { kind: "update", payload: applyConfirmCV2Payload(resolution.roster, ctx) };
  }

  // parsed.action === "confirm" — the ONLY mutating path.
  // STALE GUARD: compare the click's content-address (mapHash12) to the FRESH
  // recomputed hash. A mismatch means the map changed since the preview — re-render
  // the dashboard for a fresh look; NEVER apply a stale map.
  if (parsed.mapHash12 !== resolution.mapHash12) {
    const ctx: MemberDashboardContext = {
      world: coreDeps.world,
      mapSource: resolution.mapSource,
      apply: { mapHash12: resolution.mapHash12 },
    };
    return { kind: "update", payload: memberDashboardCV2Payload(resolution.roster, ctx) };
  }

  // Stale guard passed → run LIVE in the background through the EXISTING gate.
  // `coreDeps` carries the CLICKER's resolveActor so authz binds to the confirmer.
  return { kind: "confirm-live", coreDeps };
}

/**
 * Handle a `rolesync:` MESSAGE_COMPONENT click end-to-end. Returns the immediate
 * Discord response; for `confirm` it ALSO fires the background LIVE run that
 * PATCHes @original with the receipt. EPHEMERAL persists through every step
 * (UPDATE_MESSAGE / DEFERRED_UPDATE_MESSAGE on the same ephemeral message).
 *
 * `fetchFn` is injectable for tests (the confirm PATCH @original).
 */
export async function handleRoleSyncComponentInteraction(
  interaction: DiscordInteraction,
  auth: AuthContext | undefined,
  deps: RoleSyncInteractionDeps,
  fetchFn: typeof fetch = fetch,
): Promise<DiscordInteractionResponse> {
  const outcome = await computeRoleSyncComponentOutcome(interaction, auth, deps);

  if (outcome.kind === "update") {
    // UPDATE_MESSAGE (type 7) re-renders the SAME ephemeral container. The CV2
    // payload carries IS_COMPONENTS_V2; merge EPHEMERAL so the container stays
    // invoker-only across the transition.
    const data = {
      ...outcome.payload,
      flags: outcome.payload.flags | MessageFlags.EPHEMERAL,
    } as unknown as DiscordInteractionResponse["data"];
    return { type: InteractionResponseType.UPDATE_MESSAGE, data };
  }

  if (outcome.kind === "status") {
    // A plain status (refusal / error / stale-not-applicable) — re-render the same
    // ephemeral message as a content update (still type 7, keeps it invoker-only).
    return {
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: outcome.message,
        flags: MessageFlags.EPHEMERAL,
        allowed_mentions: { parse: [] },
        // CV2 cannot mix with content; this transition drops components for a status.
        components: [],
      } as unknown as DiscordInteractionResponse["data"],
    };
  }

  // outcome.kind === "confirm-live": DEFERRED_UPDATE_MESSAGE (type 6), then run the
  // LIVE apply in the background + PATCH @original with the structural receipt.
  void runConfirmLive(interaction, outcome.coreDeps, fetchFn);
  return {
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    data: { flags: MessageFlags.EPHEMERAL },
  };
}

/**
 * Background LIVE apply for a confirmed click. Runs `runRoleSyncTrigger(deps,
 * 'LIVE')` (which goes through the substrate gate → role-writer.live.ts) and
 * PATCHes @original with the LIVE receipt (`rendered`) or a plain status
 * (`refused`/`error`). NEVER throws into the caller (it is void-ed).
 */
export async function runConfirmLive(
  interaction: DiscordInteraction,
  coreDeps: RoleSyncTriggerDeps,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    // `coreDeps` already carries the CLICKER's resolveActor (merged in
    // computeRoleSyncComponentOutcome) — authz binds to whoever confirmed.
    const outcome = await runRoleSyncTrigger(coreDeps, "LIVE");

    if (outcome.kind === "rendered") {
      await patchOriginalData(interaction, fetchFn, {
        ...(outcome.payload as unknown as Record<string, unknown>),
        flags: (outcome.payload.flags as number) | MessageFlags.EPHEMERAL,
      });
      return;
    }
    if (outcome.kind === "rendered-members") {
      // LIVE never returns the member-centric render (that path is SHADOW-only), but
      // be defensive — surface the structural payload either way.
      await patchOriginalData(interaction, fetchFn, {
        ...(outcome.payload as unknown as Record<string, unknown>),
        flags: (outcome.payload.flags as number) | MessageFlags.EPHEMERAL,
      });
      return;
    }
    // refused / error → a plain ephemeral status (drop components).
    await patchOriginalContent(interaction, fetchFn, outcome.message);
  } catch (err) {
    console.error("role-sync: confirm LIVE run failed:", err);
    await patchOriginalContent(interaction, fetchFn, "role-sync apply failed — see logs.").catch(
      () => {},
    );
  }
}

// ─── PATCH @original helpers (local · injectable fetch for tests) ─────────────

/** PATCH @original with an arbitrary CV2 data payload (the LIVE receipt). */
async function patchOriginalData(
  interaction: DiscordInteraction,
  fetchFn: typeof fetch,
  data: Record<string, unknown>,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const res = await fetchFn(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`role-sync: confirm PATCH @original (data) failed status=${res.status}`);
  }
}

/** PATCH @original with a plain ephemeral status string (drops components). */
async function patchOriginalContent(
  interaction: DiscordInteraction,
  fetchFn: typeof fetch,
  content: string,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const res = await fetchFn(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      flags: MessageFlags.EPHEMERAL,
      components: [],
      allowed_mentions: { parse: [] },
    }),
  });
  if (!res.ok) {
    throw new Error(`role-sync: confirm PATCH @original (content) failed status=${res.status}`);
  }
}
