/**
 * cli/role-snapshot-export.ts — the thj RoleSnapshot exporter (S3 / EXPORT-1). One-shot:
 *
 *   # 1. discover the token-gated role's snowflake (you need it for step 2)
 *   bun run role-snapshot:export --list-roles
 *
 *   # 2. build the snapshot and print it — NO network write
 *   bun run role-snapshot:export --role-ids <snowflake> --owner 0x… --dry-run
 *
 *   # 3. POST it to the LIVE shadow-audit ingestion seam
 *   bun run role-snapshot:export --role-ids <snowflake> --owner 0x…
 *
 * Forked in spirit from `cli/member-graph.ts` (the same self-contained bot-client pattern), but a
 * DIFFERENT job: member-graph renders a read-model; this PRODUCES the incumbent-role input the
 * deployed shadow-audit service consumes.
 *
 * ── VOICELESS · READ-ONLY ────────────────────────────────────────────────────
 * Reads Discord (members + roles) and identity-api. Mutates NO roles. The one write it performs is
 * the HTTP POST of the snapshot to the audit service.
 *
 * ── PII FLOOR (S3-T3) ────────────────────────────────────────────────────────
 * No raw wallet and no raw discord snowflake ever reaches the human log on STDERR — every identifier
 * there goes through redactDiscordId / redactWallet. Deliberate machine-readable payload channels are
 * the exceptions: `--list-roles` prints role ids to STDOUT for operator discovery, `--dry-run` prints
 * the snapshot BODY to STDOUT, and `--out` writes that body to a file. The ingest token is read from
 * the environment and NEVER logged.
 *
 * ── WHY --role-ids IS REQUIRED (do not add an "export everyone" default) ─────
 * The audit reads EVERY entry in the snapshot as a holder of the token-gated role and reports the
 * ones who no longer hold the tokens as STALE ACCESS. Exporting the whole guild would therefore
 * report the entire server as stale access — a confidently-wrong audit. See the long-form note in
 * `shadow/ingestion/role-snapshot-export.ts`.
 */
import { closeSync, fchmodSync, openSync, writeFileSync } from "node:fs";
import { Client, GatewayIntentBits, type Client as DiscordClient } from "discord.js";
import { MemberIdentityClient } from "../shadow/member-identity-client.ts";
import {
  listGuildRoles,
  makeGuildRoleMemberSourceLive,
} from "../shadow/ingestion/guild-role-source.live.ts";
import {
  buildRoleSnapshot,
  assertLiveSnapshotHasSignal,
  redactDiscordId,
  redactWallet,
  RoleSnapshotExportError,
  DEFAULT_FRESHNESS_THRESHOLD_SECONDS,
  type MemberWalletResolver,
} from "../shadow/ingestion/role-snapshot-export.ts";
import {
  postRoleSnapshot,
  prepareRoleSnapshotRequest,
  DEFAULT_INGEST_ENDPOINT,
} from "../shadow/ingestion/role-snapshot-client.ts";

/**
 * The THJ guild snowflake. Grounded in `apps/bot/src/world-config.ts` (SEEDED_GUILD_WORLD_MAP:
 * "THJ (0xHoneyJar main guild)"), which also maps this guild to the identity world `mibera` — hence
 * the IDENTITY_WORLD default below. Override either with a flag/env.
 */
const THJ_GUILD_ID = "1135545260538339420";
const DEFAULT_IDENTITY_WORLD = "mibera";

/** stderr = the human log (REDACTED). stdout = the payload. Never cross them. */
const log = (msg: string): void => console.error(msg);

let activeClient: DiscordClient | null = null;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    log(`✗ --${name} requires a value.`);
    usage();
  }
  return value;
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function usage(): never {
  log(`
thj RoleSnapshot exporter — enumerate the guild, resolve wallets, feed the shadow-audit.

  bun run role-snapshot:export --list-roles
  bun run role-snapshot:export --role-ids <id>[,<id>] --owner <id> [--dry-run]

Flags
  --list-roles           print the guild's roles (id · name · members) to STDOUT and exit. This is
                         a deliberate sensitive discovery channel; redirect it to a restricted file.
  --role-ids <a,b>       REQUIRED. The token-gated role snowflake(s). Only members holding one of
                         these are exported — the audit reads every entry as a role-holder, so
                         exporting the whole guild would report the server as stale access.
  --owner <id>           REQUIRED. Provenance stamp (conventionally the community owner wallet).
                         The audit does not consume it.
  --community <name>     default: thj   (must be an OPERATED community, else the service 403s)
  --collection <c/0x..>  default: 80094/0x886d...  the GATED COLLECTION (numeric chain / contract).
                         thj gates 7 collections, each behind its own role — the snapshot is keyed by
                         (community, collection), so exporting HJG1 under Honeycomb's key would make the
                         Honeycomb audit compute drift against HoneyJar1's role-holders.
  --guild <id>           default: ${THJ_GUILD_ID} (THJ)
  --freshness <seconds>  default: ${DEFAULT_FRESHNESS_THRESHOLD_SECONDS}
  --endpoint <url>       default: ${DEFAULT_INGEST_ENDPOINT}
  --dry-run              build + print the snapshot; do NOT POST.
  --out <path>           also write the snapshot JSON to a file.

Environment
  DISCORD_BOT_TOKEN             required — the bot must be in the guild w/ the GuildMembers intent.
  IDENTITY_API_URL              required — identity-api base URL (discord → wallet).
  IDENTITY_WORLD                default: ${DEFAULT_IDENTITY_WORLD} (THJ's world per world-config.ts)
  IDENTITY_SERVICE_TOKEN        optional — sent as x-service-token.
  ROLE_SNAPSHOT_INGEST_TOKEN    required unless --dry-run. NEVER logged.
`);
  process.exit(2);
}

/** Minimal, self-contained bot client (avoids the heavy bot boot) — same shape as member-graph.ts. */
function makeGetBotClient(): () => Promise<DiscordClient | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  let client: DiscordClient | null = null;
  return async () => {
    if (!token) return null;
    if (client) return client;
    const c = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    activeClient = c;
    const ready = new Promise<void>((resolve) => {
      c.once("clientReady", () => resolve()).once("ready", () => resolve());
    });
    await c.login(token);
    if (!c.isReady()) await ready;
    client = c;
    return client;
  };
}

async function destroyBotClient(): Promise<void> {
  if (!activeClient) return;
  const client = activeClient;
  activeClient = null;
  await client.destroy();
}

/** Snapshot files contain raw identity links. Restrict an existing or new file before writing. */
function writePrivateSnapshot(path: string, body: string): void {
  const fd = openSync(path, "w", 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeFileSync(fd, body, "utf8");
  } finally {
    closeSync(fd);
  }
}

/**
 * discord id → wallet, via the member-centric identity client (the module built for exactly this
 * direction: resolve/account/discord/{id} → /v1/profile → primary_wallet). Fail-soft by
 * construction: an unlinked / walletless / erroring member resolves to undefined ⇒ the builder
 * FLAGS them as unmatched rather than dropping them.
 */
function makeWalletResolver(): MemberWalletResolver {
  const baseUrl = process.env.IDENTITY_API_URL;
  if (!baseUrl) {
    log("✗ IDENTITY_API_URL is unset — cannot resolve any wallet. Every holder would be unmatched,");
    log("  which would make the audit's drift number meaningless. Refusing (fail-closed).");
    process.exit(2);
  }
  const client = new MemberIdentityClient({
    baseUrl,
    world: process.env.IDENTITY_WORLD ?? DEFAULT_IDENTITY_WORLD,
    serviceToken: process.env.IDENTITY_SERVICE_TOKEN,
  });
  return async (discordId: string): Promise<string | undefined> => {
    const identity = await client.resolveMember(discordId);
    return identity.kind === "linked" ? identity.wallet : undefined;
  };
}

async function main(): Promise<void> {
  if (has("help") || has("h")) usage();

  const guildId = flag("guild") ?? THJ_GUILD_ID;
  const getBotClient = makeGetBotClient();

  if (!process.env.DISCORD_BOT_TOKEN) {
    log("✗ DISCORD_BOT_TOKEN is unset — cannot read the guild.");
    process.exit(2);
  }

  // ── --list-roles: the discovery path for --role-ids ───────────────────────
  if (has("list-roles")) {
    const roles = await listGuildRoles(getBotClient, guildId);
    log(`▸ guild ${redactDiscordId(guildId)} · ${roles.length} roles (most-held first)\n`);
    console.log(["role_id", "members", "name"].join("\t"));
    for (const r of roles) console.log([r.id, r.members, r.name].join("\t"));
    log("\n▸ pick the TOKEN-GATED role and pass its id to --role-ids.");
    await destroyBotClient();
    process.exit(0);
  }

  // ── inputs (fail-closed) ──────────────────────────────────────────────────
  const roleIdsRaw = flag("role-ids") ?? process.env.ROLE_SNAPSHOT_GATED_ROLE_IDS;
  if (!roleIdsRaw) {
    log("✗ --role-ids is REQUIRED (the token-gated role snowflake[s]).");
    log("  Run with --list-roles to find it. There is deliberately no 'export everyone' default:");
    log("  the audit reads every entry as a role-holder, so exporting the whole guild would report");
    log("  the entire server as stale access — a confidently-wrong audit.");
    process.exit(2);
  }
  const gatedRoleIds = roleIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const owner = flag("owner") ?? process.env.ROLE_SNAPSHOT_OWNER;
  if (!owner) {
    log("✗ --owner is REQUIRED (provenance; conventionally the community owner wallet).");
    process.exit(2);
  }

  const community = flag("community") ?? "thj";

  // The GATED COLLECTION this role-set is for (S5-T1). Default: Honeycomb on berachain — the ONE
  // operator-CONFIRMED gate edge (HC -> Honeycomb). Any deployment of a collection addresses it; the
  // service canonicalizes across the union, so berachain and ethereum Honeycomb are the same key.
  const collectionRaw = flag("collection") ?? "80094/0x886d2176d899796cd1affa07eff07b9b2b80f1be";
  const [colChain, colContract] = collectionRaw.split("/");
  if (!colChain || !/^[0-9]+$/.test(colChain) || !colContract || !/^0x[0-9a-fA-F]{40}$/.test(colContract)) {
    log(`\u2717 --collection must be <numeric-chain-id>/<0x-contract>, e.g. 80094/0x886d...  (got '${collectionRaw}')`);
    log("  A chain SLUG is rejected: it would be stored under a key the registry can never match, and the");
    log("  snapshot would ingest happily and then be invisible to every audit.");
    process.exit(2);
  }
  const collection = { chain: colChain, contract: colContract };
  const dryRun = has("dry-run");
  const endpoint = flag("endpoint") ?? DEFAULT_INGEST_ENDPOINT;
  const freshnessRaw = flag("freshness") ?? String(DEFAULT_FRESHNESS_THRESHOLD_SECONDS);
  const freshness = Number(freshnessRaw);
  if (!Number.isInteger(freshness) || freshness <= 0) {
    log(`✗ --freshness must be a positive integer number of seconds (got '${freshnessRaw}').`);
    process.exit(2);
  }
  const outPath = flag("out");

  const ingestToken = process.env.ROLE_SNAPSHOT_INGEST_TOKEN;
  if (!dryRun && !ingestToken) {
    log("✗ ROLE_SNAPSHOT_INGEST_TOKEN is unset — cannot POST. Use --dry-run to build without it.");
    process.exit(2);
  }

  const resolveWallet = makeWalletResolver();

  // ── read the guild ────────────────────────────────────────────────────────
  log(
    `▸ guild ${redactDiscordId(guildId)} · community '${community}' · gated roles: ` +
      gatedRoleIds.map(redactDiscordId).join(", "),
  );
  const members = await makeGuildRoleMemberSourceLive(getBotClient)(guildId);
  log(`▸ read ${members.length} guild members`);

  // ── resolve + build ───────────────────────────────────────────────────────
  log("▸ resolving discord → wallet via identity-api …");

  let built;
  try {
    built = await buildRoleSnapshot({
      guildId,
      community,
      collection,
      owner,
      gatedRoleIds,
      members,
      resolveWallet,
      capturedAt: new Date().toISOString(),
      freshnessThresholdSeconds: freshness,
    });
  } catch (e) {
    if (e instanceof RoleSnapshotExportError) {
      log(`✗ refusing to export: ${e.message}`);
      await destroyBotClient();
      process.exit(1);
    }
    throw e;
  }

  const { snapshot, stats } = built;
  log(
    `▸ ${stats.gated_members} gated-role holders of ${stats.guild_members} members · ` +
      `🔗 ${stats.resolved} resolved · ⚠️ ${stats.unmatched} UNMATCHED (flagged, not dropped)`,
  );
  // Sample the cohort with REDACTED identifiers so the operator can sanity-check without PII.
  for (const e of snapshot.entries.slice(0, 5)) {
    log(
      `  · ${redactDiscordId(e.discord_user_id)} → ${e.wallet ? redactWallet(e.wallet) : "(unmatched)"}`,
    );
  }
  if (snapshot.entries.length > 5) log(`  · … and ${snapshot.entries.length - 5} more`);

  if (stats.gated_members > 0 && stats.resolved === 0) {
    log("⚠ ZERO wallets resolved. The audit would see no role-holders and its drift number would be");
    log("  meaningless. Check IDENTITY_API_URL / IDENTITY_WORLD before trusting this snapshot.");
  }

  const prepared = prepareRoleSnapshotRequest(snapshot, endpoint);
  if (outPath) {
    writePrivateSnapshot(outPath, prepared.body);
    log(`▸ wrote ${prepared.bytes} bytes → restricted output file (mode 0600)`);
  }

  // ── dry-run: print exactly what WOULD be POSTed ───────────────────────────
  if (dryRun) {
    log(`\n▸ DRY RUN — would POST ${prepared.bytes} bytes to ${prepared.url}`);
    log(`  X-Snapshot-Sha256: ${prepared.sha256}`);
    log(`  X-Ingest-Token:    <ROLE_SNAPSHOT_INGEST_TOKEN> (not read in dry-run)`);
    console.log(prepared.body); // stdout = the payload (pipe it to a file if you want it)
    await destroyBotClient();
    process.exit(0);
  }

  // ── the live POST ─────────────────────────────────────────────────────────
  try {
    assertLiveSnapshotHasSignal(stats);
  } catch (e) {
    if (e instanceof RoleSnapshotExportError) {
      log(`✗ refusing to POST: ${e.message}`);
      await destroyBotClient();
      process.exit(1);
    }
    throw e;
  }
  log(`\n▸ POST ${prepared.bytes} bytes → ${prepared.url}`);
  const result = await postRoleSnapshot(snapshot, { token: ingestToken!, endpoint });

  await destroyBotClient();

  if (result.kind === "accepted") {
    const r = result.receipt;
    // stored:false is a SUCCESSFUL no-op (the store is monotonic on captured_at) — not an error.
    log(
      `✓ 200 · stored=${r.stored}${r.stored ? "" : " (replay / not newer — a successful NO-OP)"} · ` +
        `community=${r.community} · captured_at=${r.captured_at} · entries=${r.entries}`,
    );
    process.exit(0);
  }
  if (result.kind === "accepted_unverified") {
    log(`⚠ 200 · ${result.reason}`);
    log("  Treat the write as possibly committed; inspect the held snapshot before any retry.");
    process.exit(1);
  }
  if (result.kind === "refused") {
    log(`✗ ${result.status} · ${result.reason}`);
    log("  The service refuses rather than guesses — read the cause above; do not retry blindly.");
    process.exit(1);
  }
  log(`✗ transport error: ${result.reason} (safe to retry — ingestion is at-least-once)`);
  process.exit(1);
}

main().catch(async (err) => {
  await destroyBotClient().catch(() => undefined);
  log(`role-snapshot-export failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
