/**
 * ingestion/registration.ts — community/medium bring-up (cycle-010 S4.1; SDD §4.5,
 * FR-1). The "absorb a guild" primitive: register a new community → derive its
 * `WorldRef` → emit `community.config.updated.v1`. A community then onboards by
 * CONFIG only (FR-7) — no app-code change.
 *
 * Fail-closed (Flatline): partial/invalid payloads are REFUSED with the missing
 * fields listed (no partial registration). PRIVILEGED (SKP-005/710): only a
 * caller in the world's `admin_principals` may register — reuses the existing
 * shadow admin-allowlist pattern. Persistence is a RUNTIME JSON registry
 * (`.run/shadow/communities/<id>.json`, SKP-002/860) — never a `.ts` mutation.
 *
 * VOICELESS: config I/O + an event. No persona, no role mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { WorldRef } from "./source-producer.ts";

/** The minimal registration payload (PRD FR-1 enumeration). */
export interface RegistrationPayload {
  readonly community_id: string;
  readonly world_slug: string;
  readonly discord_guild_id: string;
  readonly namespace_prefix: string;
  readonly collection_contracts: ReadonlyArray<string>;
  readonly score_community_slug: string;
  readonly identity_authority: string;
  readonly incumbent_bot_ids?: ReadonlyArray<string>;
}

const REQUIRED: ReadonlyArray<keyof RegistrationPayload> = [
  "community_id",
  "world_slug",
  "discord_guild_id",
  "namespace_prefix",
  "collection_contracts",
  "score_community_slug",
  "identity_authority",
];

export class RegistrationError extends Error {
  readonly _tag = "RegistrationError";
  constructor(
    readonly reason: "missing_fields" | "unauthorized",
    message: string,
    readonly missing?: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

export interface RegisterOptions {
  /** the principal attempting registration (privileged op). */
  readonly caller: string;
  /** the world's admin allowlist (reuses shadow admin_principals; SKP-005). */
  readonly admin_principals: ReadonlyArray<string>;
  /** where the runtime registry lives (default `.run/shadow/communities`). */
  readonly registryDir?: string;
  readonly observedAt?: () => string;
}

export interface RegistrationResult {
  readonly world: WorldRef;
  readonly event: ShadowEvent;
  readonly config_path: string;
}

/** Validate fail-closed: returns the list of missing required fields (empty = ok). */
export function missingFields(payload: Partial<RegistrationPayload>): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const v = payload[key];
    if (v === undefined || v === null || v === "") missing.push(key);
    else if (Array.isArray(v) && v.length === 0) missing.push(key);
  }
  return missing;
}

/**
 * Register a community. Fail-closed + privileged + persisted to runtime JSON +
 * emits `community.config.updated.v1`. Returns the derived `WorldRef`.
 */
export function registerCommunity(
  payload: Partial<RegistrationPayload>,
  opts: RegisterOptions,
): RegistrationResult {
  // 1. authz (SKP-005) — fail-closed unless caller is an admin principal.
  if (!opts.admin_principals.includes(opts.caller)) {
    throw new RegistrationError("unauthorized", `caller '${opts.caller}' is not an admin principal`);
  }
  // 2. validate — no partial registration.
  const missing = missingFields(payload);
  if (missing.length) {
    throw new RegistrationError("missing_fields", `registration missing required fields: ${missing.join(", ")}`, missing);
  }
  const p = payload as RegistrationPayload;

  // 3. derive the WorldRef the producers consume.
  const world: WorldRef = {
    community_id: p.community_id,
    world_slug: p.world_slug,
    guild_id: p.discord_guild_id,
    namespace_prefix: p.namespace_prefix,
    watched_contracts: [...p.collection_contracts],
    score_community_slug: p.score_community_slug,
  };

  // 4. persist to the runtime registry (NOT a .ts source mutation).
  const dir = opts.registryDir ?? join(".run", "shadow", "communities");
  const config_path = join(dir, `${p.community_id}.json`);
  mkdirSync(dirname(config_path), { recursive: true });
  writeFileSync(config_path, JSON.stringify({ ...p, registered_by: opts.caller }, null, 2));

  // 5. emit community.config.updated.v1.
  const at = (opts.observedAt ?? (() => new Date(0).toISOString()))();
  const event = makeEvent<Extract<ShadowEvent, { name: "community.config.updated.v1" }>>(
    "community.config.updated.v1",
    {
      watched_contracts: [...p.collection_contracts],
      ...(p.incumbent_bot_ids ? { incumbent_bot_ids: [...p.incumbent_bot_ids] } : {}),
    } as Extract<ShadowEvent, { name: "community.config.updated.v1" }>["payload"],
    { community_id: p.community_id, source: "config", truth_status: "verified", observed_at: at, emitted_at: at },
  );

  return { world, event, config_path };
}
