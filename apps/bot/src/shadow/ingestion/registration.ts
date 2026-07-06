/**
 * ingestion/registration.ts — community/medium bring-up (cycle-010 S4.1; SDD §4.5,
 * FR-1). The "absorb a guild" primitive: activate a community from its world
 * manifest → derive its `WorldRef` → emit `community.config.updated.v1`.
 *
 * SINGLE SOURCE OF TRUTH (operator feedback 2026-06-29 "configs in too many
 * places"): the config IS the vendored world manifest `apps/bot/worlds/<slug>.yaml`
 * — the SAME file admin-allowlist.live.ts + role-sync read. Registration READS it;
 * it does NOT persist a parallel `.run/*.json` (that redundancy was removed).
 * "Registering" = validate the manifest is complete + authz + emit the event;
 * the operator authors the manifest (yaml), the bot activates it.
 *
 * Fail-closed: incomplete manifest → REFUSED (missing fields listed). PRIVILEGED
 * (SKP-005): only a caller in the manifest's `shadow_onboarding.admin_principals`
 * may activate (empty = deny-all, fail-safe). VOICELESS.
 */
import { readFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";
import type { WorldRef } from "./source-producer.ts";

/** The `shadow_onboarding` block of a world manifest — the canonical config. */
export interface ShadowOnboardingConfig {
  readonly guild_id?: string;
  readonly namespace_prefix?: string;
  readonly watched_contracts?: ReadonlyArray<string>;
  readonly score_community_slug?: string;
  readonly identity_authority?: string;
  readonly incumbent_bot_ids?: ReadonlyArray<string>;
  readonly admin_principals?: ReadonlyArray<string>;
}

const REQUIRED: ReadonlyArray<keyof ShadowOnboardingConfig> = [
  "guild_id",
  "namespace_prefix",
  "watched_contracts",
  "score_community_slug",
  "identity_authority",
];

export class RegistrationError extends Error {
  readonly _tag = "RegistrationError";
  constructor(
    readonly reason: "missing_fields" | "unauthorized" | "manifest_unreadable",
    message: string,
    readonly missing?: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

/** Vendored world-manifest directory — the SAME convention role-sync uses. */
export const WORLDS_DIR = pathResolve(
  new URL("../../../worlds", import.meta.url).pathname,
);
export const manifestPathForWorld = (slug: string): string =>
  pathResolve(WORLDS_DIR, `${slug}.yaml`);

/** Parse the `shadow_onboarding` block out of a manifest's YAML text. */
export function parseShadowOnboarding(yamlText: string): ShadowOnboardingConfig {
  const doc = parseYaml(yamlText) as { shadow_onboarding?: ShadowOnboardingConfig } | undefined;
  return doc?.shadow_onboarding ?? {};
}

/** Fields still missing / placeholder in the manifest (empty = complete). */
export function missingFields(cfg: ShadowOnboardingConfig): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const v = cfg[key];
    if (v === undefined || v === null || v === "") missing.push(key);
    else if (Array.isArray(v) && v.length === 0) missing.push(key);
    else if (typeof v === "string" && /^TODO/i.test(v)) missing.push(key); // placeholder
  }
  return missing;
}

export interface RegisterOptions {
  /** the principal attempting activation (privileged op). */
  readonly caller: string;
  /** injectable manifest reader (tests); defaults to reading the vendored yaml. */
  readonly readManifest?: (slug: string) => string;
  readonly observedAt?: () => string;
}

export interface RegistrationResult {
  readonly world: WorldRef;
  readonly event: ShadowEvent;
  readonly admin_principals: ReadonlyArray<string>;
}

/**
 * Activate a community from its world manifest. Fail-closed + privileged + emits
 * `community.config.updated.v1`. The manifest is the SINGLE config source — no
 * parallel persistence. Returns the derived `WorldRef`.
 */
export function registerCommunity(slug: string, opts: RegisterOptions): RegistrationResult {
  // 1. load the canonical manifest (the one config place).
  let cfg: ShadowOnboardingConfig;
  try {
    const read = opts.readManifest ?? ((s: string) => readFileSync(manifestPathForWorld(s), "utf8"));
    cfg = parseShadowOnboarding(read(slug));
  } catch (err) {
    throw new RegistrationError("manifest_unreadable", `cannot read world manifest for '${slug}': ${String(err)}`);
  }

  // 2. authz (SKP-005) — fail-closed; empty admin_principals = deny-all.
  const admin_principals = cfg.admin_principals ?? [];
  if (!admin_principals.includes(opts.caller)) {
    throw new RegistrationError("unauthorized", `caller '${opts.caller}' is not an admin principal for '${slug}'`);
  }

  // 3. validate the manifest is complete — no partial activation.
  const missing = missingFields(cfg);
  if (missing.length) {
    throw new RegistrationError("missing_fields", `manifest '${slug}' incomplete: ${missing.join(", ")}`, missing);
  }

  // 4. derive the WorldRef the producers consume (from the manifest, not a copy).
  const world: WorldRef = {
    community_id: slug,
    world_slug: slug,
    guild_id: cfg.guild_id!,
    namespace_prefix: cfg.namespace_prefix!,
    watched_contracts: [...cfg.watched_contracts!],
    score_community_slug: cfg.score_community_slug!,
  };

  // 5. emit community.config.updated.v1.
  const at = (opts.observedAt ?? (() => new Date(0).toISOString()))();
  const event = makeEvent<Extract<ShadowEvent, { name: "community.config.updated.v1" }>>(
    "community.config.updated.v1",
    {
      watched_contracts: [...cfg.watched_contracts!],
      ...(cfg.incumbent_bot_ids ? { incumbent_bot_ids: [...cfg.incumbent_bot_ids] } : {}),
    } as Extract<ShadowEvent, { name: "community.config.updated.v1" }>["payload"],
    { community_id: slug, source: "config", truth_status: "verified", observed_at: at, emitted_at: at },
  );

  return { world, event, admin_principals };
}
