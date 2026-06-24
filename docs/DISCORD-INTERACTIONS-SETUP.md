# Discord Interactions Setup (V0.7-A.0)

The slash-command surface for the freeside-characters bot. After V0.6's
write-side substrate (Pattern B per-character webhook digest delivery),
V0.7-A.0 adds the **read-side primitive**: explicit `/ruggy <prompt>`
and `/satoshi <prompt>` invocations that route a user's message to the
target character and reply with the LLM's voice in-channel.

This doc walks through Discord developer portal setup, env vars, and
slash-command registration. The bot's digest cron is unaffected by any
of this; the interactions endpoint is additive.

> Before running this, confirm V0.6 is healthy: `digest:once` fires post,
> bot user is connected, per-zone channels mapped. The interactions path
> doesn't touch those, but a broken V0.6 makes V0.7 confusion harder to debug.

## What you'll set up

1. A public-internet HTTPS endpoint Discord can POST to
2. The Ed25519 public key from your Discord application
3. Two slash commands: `/ruggy` and `/satoshi`

After setup, an authorized user can invoke `/satoshi prompt:hey` in any
channel where the bot is present, and Satoshi will reply in-character
within ~10 seconds.

## Env vars

Add to your Railway service (or local `.env` for dev):

```dotenv
# Required to start the interactions HTTP server
DISCORD_PUBLIC_KEY=<copy from Discord developer portal · General Information tab>

# Optional · port resolution order:
#   1. INTERACTIONS_PORT (this var, operator-pinned)
#   2. PORT (Railway / Heroku / Fly auto-inject)
#   3. 3001 (local dev default)
INTERACTIONS_PORT=
```

On Railway, leave `INTERACTIONS_PORT` unset and the bot will bind to
whatever `PORT` Railway injects — the edge proxy maps public 443 → that
internal port automatically. Pin `INTERACTIONS_PORT` only if you want
local-dev parity with prod (e.g., 3001).

The existing `DISCORD_BOT_TOKEN` is reused for command registration.
Slash command **invocations** use the interaction token Discord embeds
in each request — no bot token in the request path.

### Railway networking

V0.6 ran outbound-only — the existing Railway service may not have a
public domain. To enable inbound HTTPS for V0.7-A.0:

1. Railway → bot service → **Networking** → **Generate Domain** (yields
   `<service>.up.railway.app`)
2. The platform reverse proxy will route public 443 → the `PORT` env it
   injects. The bot's interactions server picks `PORT` up automatically
   (see env table above).
3. Use the generated domain as your Discord Interactions Endpoint URL:
   `https://<service>.up.railway.app/webhooks/discord`

## Step-by-step

### 1. Pick the deploy mode

Two modes for slash command registration:

| Mode    | Propagation  | When to use                            |
|---------|--------------|----------------------------------------|
| guild   | immediate    | development · staging · single-server  |
| global  | up to 1 hour | production cutover · multi-server bots |

Always start guild-only. Promote to global only after the staging shape
is confirmed.

### 2. Configure the Discord application

In the Discord developer portal:

1. Navigate to **Applications → freeside-characters → General Information**
2. Set **Interactions Endpoint URL** to your public HTTPS host:
   - prod: `https://<your-railway-host>/webhooks/discord`
   - staging: `https://<your-staging-host>/webhooks/discord`
3. Copy the **Public Key** field. Set it as `DISCORD_PUBLIC_KEY` on the
   Railway service that runs the bot.
4. **Save Changes.** Discord will POST a PING to the endpoint to verify
   the signing handshake. If your endpoint is reachable and the public key
   is correct, the save succeeds. Otherwise see Troubleshoot below.

### 3. Register the slash commands

```bash
# Guild-only (dev / staging)
DISCORD_BOT_TOKEN=<bot token> \
DISCORD_APPLICATION_ID=<application id> \
DISCORD_GUILD_ID=<guild id> \
  bun run apps/bot/scripts/publish-commands.ts

# Global (prod cutover)
DISCORD_BOT_TOKEN=<bot token> \
DISCORD_APPLICATION_ID=<application id> \
  bun run apps/bot/scripts/publish-commands.ts
```

`DISCORD_APPLICATION_ID` is in the developer portal under
**General Information → Application ID**. The script will fall back to
`GET /applications/@me` if the env var is unset.

The script auto-loads characters via the standard `character-loader.ts`
mechanism, so it registers `/<id>` for each. `CHARACTERS=ruggy,satoshi`
yields `/ruggy` and `/satoshi`.

### 4. Smoke-test in a private channel

Invoke `/satoshi prompt:say hi in voice` in a guild channel. Expect:

1. Discord shows "freeside-characters is thinking..." immediately (the
   deferred ACK).
2. Within ~10 seconds the deferred message updates to the reply prefixed
   with `**Satoshi**`.
3. The reply preserves Satoshi's locked register (dense block, no honey-
   bear emoji).

Try `/ruggy prompt:report on stonehenge` — expect chunked-beats voice.

Try `/satoshi prompt:test ephemeral:true` — only the invoker sees the reply.

## Required Discord permissions

The bot's OAuth invite link must include the `applications.commands`
scope. If the bot was invited via the standard URL Discord generates
under **OAuth2 → URL Generator → Scopes**, this is already included.

If `/ruggy` shows up but Discord says "the application did not respond
in time," see Troubleshoot below.

## Troubleshoot

### Discord rejects "Save" on Interactions Endpoint URL

Discord posts a PING to verify the endpoint when you save. Common causes
of failure:

- `DISCORD_PUBLIC_KEY` env var doesn't match the Public Key in the portal
- The endpoint isn't actually reachable from the public internet (Railway
  preview URL · localhost · firewall)
- The endpoint isn't replying with `{ "type": 1 }` to PING. Check:
  ```bash
  curl https://<host>/health
  # → {"status":"ok","service":"freeside-characters-interactions","characters":[...]}
  ```
- The PING/PONG handshake takes more than 3 seconds (cold-start bot,
  startup probe failing)

### Endpoint validates but slash commands don't appear

Slash command propagation:

- Guild-only: appears within seconds. If not, run `publish-commands.ts`
  again and check the output for command IDs.
- Global: up to 1 hour. Use guild-only during dev to dodge this.

If the script returns `401 Unauthorized` — bot token is wrong.
If `403 Forbidden` — the bot OAuth invite doesn't include
`applications.commands` scope. Re-invite with the correct URL.

### Slash invokes but Discord shows "the application did not respond in time"

- Bot didn't ACK within Discord's 3-second initial-response window.
  Check `interactions:` log output — the deferred ACK should fire
  within ~10ms of receiving the POST.
- Service crashed mid-dispatch and PATCH @original never fired. Check
  bot logs for unhandled errors during composeReply.
- Interaction token expired (15-min hard limit · LLM took too long).
  V0.7-A.0 wraps composeReply in a 14m30s timeout · the user sees a
  timeout-apology in this case · should be rare for slash commands.

### "Application is thinking..." never updates

- `DISCORD_PUBLIC_KEY` is correct but the PATCH endpoint is unreachable
  from the bot. Confirm outbound HTTPS works to discord.com from Railway.
- Circuit breaker tripped on this channel (3 consecutive 403s on PATCH
  attempts). Check logs for `circuit breaker tripped for channel`.
  Restart the bot to clear the in-process state.

### Local dev signature reject (expected)

The interactions server rejects signatures it can't verify. To smoke-test
locally without the Discord round-trip:

```bash
# Health check
curl http://localhost:3001/health

# Forged PING — expect 401 Invalid signature
curl -X POST http://localhost:3001/webhooks/discord \
  -H "X-Signature-Ed25519: dummy" \
  -H "X-Signature-Timestamp: $(date +%s)" \
  -d '{"type":1}'
```

Real PING/PONG validation only happens once Discord can reach the
endpoint with a valid signature.

## What V0.7-A.0 doesn't do

These are intentionally out of scope (V0.7-A.1 onward):

- **messageCreate handler** — the bot doesn't observe arbitrary channel
  messages. Only explicit `/ruggy` or `/satoshi` invocations trigger replies.
- **Reply-to-bot continuation** — replying natively to a character's
  message in Discord won't route to that character. Use `/character` again.
- **Cross-character chaining** — `@ruggy @satoshi` in plain text doesn't
  trigger both. (When V0.7-A.3 lands, explicit `@USER` mentions will.)
- **Persistent memory** — the per-channel ledger is in-process. Restart
  loses it. V0.7+ daemon-stage adds durable per-character memory.

See `~/bonfire/grimoires/bonfire/specs/listener-router-substrate.md` for
the full V0.7-A → V0.7-B roadmap.
