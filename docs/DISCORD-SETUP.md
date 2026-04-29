# Discord setup

What the freeside-characters shell bot needs on the Discord side. Covers
fresh-app provisioning, invite-link generation, channel permissions,
intents, troubleshooting.

> 🪩 **TL;DR**: Pattern B webhook-shell needs `MANAGE_WEBHOOKS` at role or
> channel level. Without it, compose succeeds but delivery returns
> `403 Missing Permissions` (Discord error code 50013) and posts vanish.

---

## When to read this

| You are | Read |
|---|---|
| Provisioning a fresh Discord application for a new world / guild | All sections below |
| Adding a new character to an existing shell-bot deployment | Just §[Per-channel grants](#per-channel-grants) |
| Debugging silent post failures | §[Troubleshooting](#troubleshooting) |
| Authoring a new character spec | Cross-reference [`CHARACTER-AUTHORING.md`](./CHARACTER-AUTHORING.md) — character.json + persona.md sit on top of this Discord layer |

---

## §1 · Discord application provisioning

Each shell-bot deployment maps to ONE Discord application (one bot user).
Multiple characters share the SAME application via Pattern B's per-message
webhook avatar+username override. You do NOT create one app per character.

### Create the application

1. https://discord.com/developers/applications → New Application
2. Name it after the deployment: `freeside-characters-prod` /
   `freeside-characters-staging` / etc. The display name in chat is
   per-character (Pattern B override) so the app name is for operators only.
3. Bot tab → Reset Token → save securely (this is `DISCORD_BOT_TOKEN`)
4. Bot tab → uncheck `Public Bot` if you want only specific operators to
   invite the bot
5. Bot tab → enable required Privileged Intents (none for V0.6 phase 1 ·
   `MESSAGE CONTENT INTENT` needed for V0.6-D phase 2 reaction handler)

> ⚠️ **Token regen invalidates the prior token.** If you regenerate, every
> running container with the old token will lose Discord gateway on next
> reconnect. Plan: regen → update env vars on Railway → redeploy services.

### Required intents

| Intent | V0.6 phase 1 | V0.6-D phase 2 (reaction handler) |
|---|---|---|
| `Guilds` | ✓ | ✓ |
| `GuildMessages` | optional | ✓ |
| `GuildMessageReactions` | — | ✓ |
| `MessageContent` (privileged) | — | ✓ |

Intents are configured in code (`apps/bot/src/index.ts`) AND on the
Discord developer portal (Bot tab → Privileged Gateway Intents). Both must
match. See `packages/persona-engine/src/deliver/client.ts` for the current
intent list.

---

## §2 · Generate the invite link

```bash
DISCORD_BOT_TOKEN=<the-bot-token> bun run scripts/print-invite-link.ts
```

Or with `.env` already set:

```bash
bun run scripts/print-invite-link.ts
```

Outputs an OAuth URL with the permission bitmask preconfigured:

```
🔗 freeside-characters · Discord shell-bot invite

https://discord.com/api/oauth2/authorize?client_id=...&permissions=537185280&scope=bot

permissions encoded:
  ✓ View Channel              (read channel listing)
  ✓ Send Messages             (deliver via webhook + bot fallback)
  ✓ Embed Links               (rich embed for digest/weaver/callout)
  ✓ Attach Files              (avatar fetches, future image posts)
  ✓ Use External Emojis       (per-character emoji affinity refs)
  ✓ Manage Webhooks           (Pattern B critical · per-character override)
```

Open the URL in a browser, pick the target guild, click Authorize. The bot
joins with a role that has the listed permissions guild-wide.

### Permission bitmask reference

| Permission | Bit | Decimal | Why we need it |
|---|---|---|---|
| `VIEW_CHANNEL` | 1 << 10 | 1024 | List channels at boot · validate `DISCORD_CHANNEL_*` env vars resolve |
| `SEND_MESSAGES` | 1 << 11 | 2048 | Bot fallback path when webhook unavailable |
| `EMBED_LINKS` | 1 << 14 | 16384 | Rich embeds for digest/weaver/callout post types |
| `ATTACH_FILES` | 1 << 15 | 32768 | Avatar fetches when GitHub raw fails · future image posts |
| `USE_EXTERNAL_EMOJIS` | 1 << 18 | 262144 | Per-character emoji affinity refs (ruggy_smoke etc) |
| `MANAGE_WEBHOOKS` | 1 << 29 | 536870912 | **Pattern B critical** · `getOrCreateChannelWebhook` |
| `ADD_REACTIONS` | 1 << 6 | 64 | V0.6-D phase 2 future · ❓ reaction-handler |

V0.6 phase 1 total: `537185280`
V0.6-D phase 2 total: `537185344` (adds ADD_REACTIONS)

---

## §3 · Per-channel grants

If you can't grant role-level permissions (org policy / server hygiene),
grant `MANAGE_WEBHOOKS` per-channel for each character-target channel:

1. Channel settings → Permissions → Add the bot's role (or the bot user)
2. ✓ Manage Webhooks
3. (other permissions inherit from role-level grant)

You need this for every channel listed in the deployment's
`DISCORD_CHANNEL_*` env vars. For freeside-characters V0.6-D phase 1
that's 4 channels (one per zone):

```
DISCORD_CHANNEL_STONEHENGE
DISCORD_CHANNEL_BEAR_CAVE
DISCORD_CHANNEL_EL_DORADO
DISCORD_CHANNEL_OWSLEY_LAB
```

If V0.6-D phase 2 adds zones (timeline · IRL · etc), grant those channels too.

> 💡 **Operator tip**: role-level grant is faster (one click). Per-channel
> grant is more conservative (limits blast radius if the role is shared).
> Pick based on your guild's permission hygiene model.

---

## §4 · Verifying the bot is wired correctly

### After invite

```bash
# Boot the container and watch the banner:
railway up --service <service-name> --ci
railway logs --service <service-name> --deployment | tail -25
```

Healthy banner shape (matches `apps/bot/src/index.ts`):

```
─── freeside-characters bot · v0.6.0-A ──────────────────
characters:     <character names> (primary: <id>)
data:           LIVE (score-mcp)
llm:            anthropic-direct (claude-sonnet-4-6)
zones:          🗿 stonehenge · 🐻 bear-cave · ⛏️ el-dorado · 🧪 owsley-lab
digest cadence: weekly · sunday 00:00 UTC
delivery:       BOT (4/4 zones mapped)
ruggy: discord client ready as <name>#<discriminator>
discord:        bot client connected (<name>#<discriminator>)
```

The `4/4 zones mapped` line confirms the bot can SEE the channels.
If it says `0/4` or `2/4`: env var typos in `DISCORD_CHANNEL_*` OR the bot
isn't in the right guild OR the bot lacks `VIEW_CHANNEL`.

The `discord client ready` line confirms gateway is acquired.
If it's missing: `DISCORD_BOT_TOKEN` invalid / regenerated / typo'd.

### First fire validation

```bash
# Trigger one full sweep instead of waiting for cron:
railway variables --service <service-name> --set "DIGEST_CADENCE=manual"
railway redeploy --service <service-name> --yes

# After completion, restore weekly cadence:
railway variables --service <service-name> --set "DIGEST_CADENCE=weekly"
railway redeploy --service <service-name> --yes
```

The container boots, fires all configured zones via webhook-shell, exits
clean. Posts should land in Discord with per-character avatar + username.

> ⚠️ **Bot will be OFFLINE after manual fire** until you redeploy with
> weekly cadence. The container exits 0 after firing; restart policy is
> `ON_FAILURE` so exit-0 doesn't auto-restart.

---

## §5 · Troubleshooting

### `403 Missing Permissions` (code 50013) on webhook fetch

```
url: "https://discord.com/api/v10/channels/<id>/webhooks"
status: 403
error: Missing Permissions
code: 50013
```

The bot is hitting `GET /channels/{id}/webhooks` (Pattern B's
`getOrCreateChannelWebhook` call) and being denied.

**Fix**: grant `MANAGE_WEBHOOKS` at role level OR per-channel for the
specific failing channel id (see §3).

This is the single most common Discord-side bug. If compose succeeds
(LLM produced text) but no message lands: this is almost always why.

### Container can't connect to Discord gateway

```
bot client failed: error: WebSocket connection to
'wss://gateway.discord.gg/?v=10&encoding=json' failed
```

Possible causes:
1. **Token regenerated** — older token now invalid. Check
   `DISCORD_BOT_TOKEN` matches the current one in the developer portal.
2. **Same-token contention** — Discord allows ONE active gateway connection
   per bot token. If two services try to connect (e.g. staging + prod
   sharing the same token), only one wins. Solutions: scale one to 0
   replicas while the other runs, OR provision separate Discord
   applications for each environment.
3. **Network egress blocked** — rare on Railway, but possible on hardened
   network policies.

### Channel mapping shows `0/N` zones

```
delivery:       BOT (0/4 zones mapped: ...)
```

The container booted but couldn't resolve channel ids. Check:
1. `DISCORD_CHANNEL_*` env vars are set with correct IDs
2. Bot is invited to the guild containing those channels
3. Bot has `VIEW_CHANNEL` permission (it's in the V0.6 phase 1 bitmask
   so this is rare unless permissions were stripped)

### Per-character avatar not showing

Pattern B sets the avatar URL per-message via webhook override. If posts
land but show the bot's default avatar instead of the character's:

1. Check `apps/character-<id>/character.json` has `webhookAvatarUrl` set
   to a public HTTPS URL (GitHub raw works · S3 / CDN works · localhost does not)
2. Verify the URL responds 200 OK with `Content-Type: image/*`
3. Check the URL is not behind auth or rate-limited

---

## §6 · Multi-environment patterns

### staging + prod with shared bot token

⚠️ **Doesn't work in parallel.** Discord allows one gateway per token.
Options:

1. **Sequential** — scale one service to 0 replicas while the other runs.
   Prod gets the gateway; staging idles. Switch by scaling.
2. **Separate Discord apps** — one Discord application per environment
   (e.g. `freeside-characters-prod` and `freeside-characters-staging`).
   Each has its own token and operates independently. Identity differs
   (different bot user, different avatar) but the underlying `apps/character-<id>/`
   spec is the same code.
3. **Single environment + feature flags** — collapse staging into a
   subset of channels in the same prod application. Risky · contaminates
   prod analytics.

For freeside-characters, option 2 is the cleanest going forward.

### Multiple shells in one Discord guild

Multiple Discord applications in the same guild is fine. Each has its
own user account, role, and permissions. Pattern B handles the
namespacing — webhooks created by app A don't conflict with app B.

---

## §7 · References

- [Discord permissions bitmask reference](https://discord.com/developers/docs/topics/permissions)
- [Discord OAuth2 documentation](https://discord.com/developers/docs/topics/oauth2)
- [Pattern B (webhook shell) deep research](https://github.com/0xHoneyJar/freeside-characters/issues/1)
- `scripts/print-invite-link.ts` — invite-link generator
- `packages/persona-engine/src/deliver/webhook.ts` — `getOrCreateChannelWebhook` source
- `packages/persona-engine/src/deliver/post.ts` — Pattern B delivery logic
- [`DEPLOY.md`](./DEPLOY.md) — full deployment guide
- [`CHARACTER-AUTHORING.md`](./CHARACTER-AUTHORING.md) — per-character spec format
