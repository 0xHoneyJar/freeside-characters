#!/usr/bin/env bun
/**
 * post-role-board.ts — the EXPERIMENT HARNESS for the public live role board
 * (cycle public-role-board). Builds the member roster from the LIVE role-sync
 * boot composition, renders the PUBLIC, world-themed, voiceless CV2 board, and
 * POSTs it to a target channel — or EDITs an existing message in place when a
 * MESSAGE_ID is supplied (the "live" debounced single-persistent-message model).
 *
 * ── WHAT IT DOES (thin orchestration over existing, tested seams) ─────────────
 *   1. loadConfig() + getBotClient() — the real discord.js Gateway client.
 *   2. buildRoleSyncBootDepsFromEnv(getBotClient) — the SAME composition the bot
 *      uses for /role-sync (member-source READ + identity-api reads + score tier
 *      reads + the config-service role-map reader with seed fallback). Returns
 *      null unless ROLE_SYNC_ENABLED is truthy + the world manifest is readable.
 *   3. read the role-map (config-service, else the CM-overridable seed).
 *   4. buildMemberRoster(...) — the pure SHADOW read-model (ZERO writes).
 *   5. publicRoleBoardCV2Payload(...) — the public render.
 *   6. POST (new) or PATCH (edit MESSAGE_ID) the CV2 message; print message_id.
 *
 * ── ZERO ROLE MUTATIONS ──────────────────────────────────────────────────────
 * This script READS (guild members, identity-api, score) + renders + posts ONE
 * message. It performs NO discord.js role mutation — no create/add/set/remove/
 * delete/edit on any role. The import-boundary lint confirms it. The roster
 * builder (member-roster.ts) is documented SHADOW-only zero-writes; this harness
 * adds only a message POST/PATCH (a channel write, not a role write).
 *
 * ── "LIVE" = DEBOUNCED-BY-DESIGN (rate-limit reality) ────────────────────────
 * Discord message-edit rate limits (≈5 edits / 5s per channel; tighter under
 * global limits) make literal per-role-change editing infeasible. The honest
 * "real-time" is: a single PERSISTENT message edited in place on demand (this
 * script) or on a periodic tick / after an apply. Pass the printed MESSAGE_ID
 * back on the next run to EDIT the same message rather than spamming new posts.
 * This pass does NOT wire per-event auto-update — the script is run on demand and
 * could later be cron'd. (The CV2 POST/PATCH helpers already do bounded 429
 * retry, so a burst of refreshes degrades gracefully rather than throwing.)
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * No persona-engine VOICE import. The roster build reaches the score DATA client
 * transitively through the boot composition (the documented isolation-debt seam,
 * data not voice); the render module imports no persona. This is the operating
 * surface, not a character.
 *
 * Run (post a NEW board to #verify):
 *   CHANNEL_ID=1497405192503689316 \
 *   ROLE_SYNC_ENABLED=1 \
 *   railway run bun run apps/bot/scripts/post-role-board.ts
 *
 * Run (EDIT the existing board in place — debounced "live" refresh):
 *   CHANNEL_ID=1497405192503689316 MESSAGE_ID=<printed id> \
 *   ROLE_SYNC_ENABLED=1 \
 *   railway run bun run apps/bot/scripts/post-role-board.ts
 *
 * Channel / message can also be passed as positional args:
 *   bun run apps/bot/scripts/post-role-board.ts <CHANNEL_ID> [MESSAGE_ID]
 *
 * Required env (beyond the standard bot env DISCORD_BOT_TOKEN, identity/score):
 *   CHANNEL_ID         — the target channel (or argv[2]).
 *   ROLE_SYNC_ENABLED  — must be truthy (the role-sync boot gate).
 * Optional:
 *   MESSAGE_ID         — edit this message in place (or argv[3]).
 *   ROLE_SYNC_WORLD    — defaults to "purupuru".
 *   BOARD_ACCENT       — hex (e.g. 0xe0a83d) world accent; defaults to honey-gold.
 */
import { loadConfig, getBotClient, postToChannel } from "@freeside-characters/persona-engine";
import { buildRoleSyncBootDepsFromEnv } from "../src/shadow/role-sync-boot.ts";
import { buildMemberRoster } from "../src/shadow/member-roster.ts";
import { buildPurupuruSeedRoleMap } from "../src/shadow/role-sync-seed-map.ts";
import {
  publicRoleBoardCV2Payload,
  type PublicRoleBoardContext,
} from "../src/shadow/public-role-board-cv2.ts";
import type { RoleMapConfig } from "../src/shadow/substrate.ts";

const CHANNEL_ID = (process.env.CHANNEL_ID ?? process.argv[2] ?? "").trim();
const MESSAGE_ID = (process.env.MESSAGE_ID ?? process.argv[3] ?? "").trim();
const BOARD_ACCENT = (process.env.BOARD_ACCENT ?? "").trim();

function die(msg: string): never {
  console.error(`post-role-board: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (CHANNEL_ID.length === 0) {
    die("CHANNEL_ID is required (env CHANNEL_ID or argv[2]). e.g. CHANNEL_ID=1497405192503689316");
  }
  // validate the snowflakes before any network call (defense; they feed a URL).
  if (!/^\d{17,20}$/.test(CHANNEL_ID)) die(`CHANNEL_ID '${CHANNEL_ID}' is not a valid snowflake`);
  if (MESSAGE_ID.length > 0 && !/^\d{17,20}$/.test(MESSAGE_ID)) {
    die(`MESSAGE_ID '${MESSAGE_ID}' is not a valid snowflake`);
  }

  const config = loadConfig();
  const client = await getBotClient(config);
  if (!client) die("no discord client — DISCORD_BOT_TOKEN is unset (run under `railway run`).");
  const token = client.token;
  if (!token) die("discord client has no token.");

  // The SAME composition the bot uses for /role-sync (member READ + identity +
  // score + role-map reader). Returns null unless ROLE_SYNC_ENABLED + a readable
  // world manifest. ZERO writes — the boot deps' member-centric path is SHADOW.
  const deps = buildRoleSyncBootDepsFromEnv(async () => client);
  if (!deps) {
    die(
      "role-sync boot is not configured — set ROLE_SYNC_ENABLED=1 and ensure the world " +
        "manifest (apps/bot/worlds/<world>.yaml) carries guild_id + namespace_prefix.",
    );
  }
  if (!deps.memberCentric) {
    die("role-sync boot produced no member-centric deps — the SHADOW roster cannot be built.");
  }

  console.log(`post-role-board: building roster for world '${deps.world}' …`);

  // read the CM-authored role-map; fall back to the CM-overridable seed (the same
  // fallback the trigger uses) so the ladder has lore names + ordering.
  const authored = await deps.readRoleMap(deps.world);
  const roleMap: RoleMapConfig = authored ?? buildPurupuruSeedRoleMap();
  const mapSource = authored ? "config-service" : "default-seed";

  // build the SHADOW read-model (ZERO writes). fail-soft per member.
  const roster = await buildMemberRoster({
    world: deps.world,
    roleMap,
    members: deps.memberCentric.members,
    resolveIdentity: deps.memberCentric.resolveIdentity,
    readTier: deps.memberCentric.readTier,
  });

  console.log(
    `post-role-board: roster — ${roster.summary.members} members, ${roster.summary.linked} linked ` +
      `(role-map: ${mapSource}).`,
  );

  const ctx: PublicRoleBoardContext = {
    world: deps.world,
    roleMap,
    accent: BOARD_ACCENT.length > 0 ? Number(BOARD_ACCENT) : undefined,
    generatedAt: new Date().toISOString(),
  };
  const payload = publicRoleBoardCV2Payload(roster, ctx);

  if (MESSAGE_ID.length > 0) {
    // EDIT-IN-PLACE (the debounced "live" refresh): PATCH the existing message.
    // postToChannel only POSTs; the edit path is a raw REST PATCH with the SAME
    // CV2 wire shape (?with_components=true, flags + components, inert mentions).
    const messageId = await editComponentsV2(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}?with_components=true`,
      { flags: payload.flags, components: payload.components, allowed_mentions: payload.allowed_mentions },
      `Bot ${token}`,
    );
    console.log(`post-role-board: EDITED in place. message_id=${messageId}`);
    console.log(messageId);
  } else {
    // POST a NEW persistent board. Print the message_id so the NEXT refresh can
    // EDIT it in place (pass it back as MESSAGE_ID) rather than re-posting.
    const res = await postToChannel(client, CHANNEL_ID, payload);
    console.log(`post-role-board: POSTED. message_id=${res.messageId}`);
    console.log(
      `post-role-board: to refresh in place, re-run with MESSAGE_ID=${res.messageId}`,
    );
    console.log(res.messageId);
  }
}

/**
 * PATCH a Components-V2 message (edit-in-place) with bounded 429 retry. Mirrors
 * the POST helper's retry shape (persona-engine cv2-post.ts) but for the message
 * EDIT endpoint, which postToChannel does not expose. Returns the message id.
 */
async function editComponentsV2(
  url: string,
  body: { flags?: number; components: unknown[]; allowed_mentions: { parse: never[] } },
  authorization: string,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const retry = await res
        .json()
        .then((j: { retry_after?: number }) => j.retry_after ?? 1)
        .catch(() => 1);
      await new Promise((r) => setTimeout(r, Math.ceil(retry * 1000) + 250));
      continue;
    }
    if (!res.ok) {
      throw new Error(`role-board edit failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return json.id ?? "";
  }
  throw new Error("role-board edit failed: rate-limited after 3 attempts");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("post-role-board: failed —", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
