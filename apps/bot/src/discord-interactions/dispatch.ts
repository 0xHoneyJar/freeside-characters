/**
 * Slash command dispatch (V0.7-A.0).
 *
 * Discord sends an APPLICATION_COMMAND interaction (POST to our endpoint).
 * We:
 *   1. Apply the anti-spam invariant guard (bot-author skip).
 *   2. Resolve which character the command targets (`/ruggy` → ruggy, etc).
 *   3. ACK the interaction with a deferred "Application is thinking..." response.
 *   4. Kick off composeReply in the background.
 *   5. PATCH the original deferred message with the LLM reply when ready
 *      (or with a friendly error on timeout/failure).
 *
 * The hard rules:
 *   - 14m30s timeout (Discord interaction token expires at exactly 15:00;
 *     PATCH after that = 404 + silent UI freeze).
 *   - 5 req / 2 sec rate limit on follow-ups (per Gemini DR 2026-04-30).
 *     Multi-chunk replies throttle at 1.5s between sends.
 *   - Circuit breaker: 3 consecutive 403s on a channel → blacklist ID
 *     in-process · halt processing until restart (prevents 10K invalid req
 *     / 10 min Cloudflare global ban from cascading orphaned PATCHes).
 *
 * Anti-spam invariant (operator-named load-bearing 2026-04-30):
 *   characters NEVER respond to bot-authored invocations · NEVER respond
 *   to webhook invocations · ONLY respond to explicit user invocations.
 */

import {
  appendToLedger,
  composeReply,
  getBotClient,
  getOrCreateChannelWebhook,
  invalidateWebhookCache,
  sendChatReplyViaWebhook,
  sendImageReplyViaWebhook,
  splitForDiscord,
  type CharacterConfig,
  type Config,
  type LedgerEntry,
  type SlashCommandHandler,
} from '@freeside-characters/persona-engine';
import { invokeStability } from '@freeside-characters/persona-engine/orchestrator/imagegen';
import type { ToolUseEvent } from '@freeside-characters/persona-engine';
import { resolveSlashCommands, resolveSlashCommandTarget, selectedCharacterIds } from '../character-loader.ts';
import { getZoneForChannel } from '../lib/channel-zone-map.ts';
import { toolVerb } from './tool-verb.ts';
import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  interactionInvoker,
  readBooleanOption,
  readStringOption,
  type DiscordInteraction,
  type DiscordInteractionResponse,
} from './types.ts';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_CHAR_LIMIT = 2000;
const FOLLOW_UP_THROTTLE_MS = 1_500; // ≥1.5s between follow-ups (5 req / 2 sec ceiling)
const TOKEN_LIFETIME_MS = 14 * 60 * 1000 + 30 * 1000; // 14m30s safety margin under 15-min hard expiry
const CIRCUIT_BREAKER_THRESHOLD = 3;

// Per-channel circuit breaker state. Keyed by channel_id (or interaction.id
// fallback for DMs). A channel is blacklisted after N consecutive 403s on
// PATCH/POST attempts; subsequent dispatches in that channel short-circuit
// until process restart.
interface CircuitState {
  consecutive403s: number;
  blacklisted: boolean;
}
const circuitStates = new Map<string, CircuitState>();

function getCircuitState(channelId: string): CircuitState {
  let s = circuitStates.get(channelId);
  if (!s) {
    s = { consecutive403s: 0, blacklisted: false };
    circuitStates.set(channelId, s);
  }
  return s;
}

function recordPatchOutcome(channelId: string, status: number): void {
  const s = getCircuitState(channelId);
  if (status === 403) {
    s.consecutive403s += 1;
    if (s.consecutive403s >= CIRCUIT_BREAKER_THRESHOLD) {
      s.blacklisted = true;
      console.error(
        `interactions: circuit breaker tripped for channel ${channelId} ` +
          `(${s.consecutive403s} consecutive 403s) — blacklisted until restart`,
      );
    }
  } else {
    s.consecutive403s = 0;
  }
}

/**
 * Main entry — handles APPLICATION_COMMAND interactions.
 *
 * Returns the immediate Discord response (deferred ACK or error). Side
 * effects: when the command is valid, kicks off `doReplyAsync` to PATCH
 * the deferred message later.
 */
export async function dispatchSlashCommand(
  interaction: DiscordInteraction,
  config: Config,
  characters: CharacterConfig[],
): Promise<DiscordInteractionResponse> {
  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return ephemeralReply(`unsupported interaction type ${interaction.type}`);
  }

  // ─── Anti-spam invariant guard ─────────────────────────────────────
  // Operator-named load-bearing: characters NEVER respond to bots.
  // The webhook-author check is a defense-in-depth on top of `bot:true`
  // since some Discord API versions don't reliably set the bot flag on
  // webhook-authored invocations (Gemini DR 2026-04-30).
  const invoker = interactionInvoker(interaction);
  if (!invoker) {
    console.warn(`interactions: dropped command with no invoker (id=${interaction.id})`);
    return ephemeralReply('could not resolve invoker — skipping.');
  }
  if (invoker.bot === true) {
    console.warn(
      `interactions: ANTI-SPAM SKIP · bot invocation rejected ` +
        `(invoker=${invoker.username}/${invoker.id})`,
    );
    return ephemeralReply('characters do not respond to bot invocations.');
  }

  // ─── Circuit breaker pre-check ─────────────────────────────────────
  const channelId = interaction.channel_id ?? `dm:${invoker.id}`;
  const circuit = getCircuitState(channelId);
  if (circuit.blacklisted) {
    console.warn(
      `interactions: circuit breaker active · skipping channel ${channelId}`,
    );
    return ephemeralReply(
      'this channel is temporarily unavailable for character replies. try again after the next restart.',
    );
  }

// —— Resolve target command + handler ————————————————————————
// V0.7-A.1: characters may declare divergent commands (e.g. /satoshi-image alongside /satoshi).
const commandName = interaction.data?.name;
if (!commandName) {
  return ephemeralReply('no command name in interaction.');
}

const target = resolveSlashCommandTarget(commandName, characters);
if (!target) {
  const available = characters
    .flatMap((c) => resolveSlashCommands(c).map((s) => `/${s.name}`))
    .join(', ');
  return ephemeralReply(
    `unknown command: \`${commandName}\`. available: ${available || '(none loaded)'}`,
  );
}

const { character, spec } = target;
const handler = spec.handler;

  // ─── Read options ──────────────────────────────────────────────────
  const prompt = readStringOption(interaction, 'prompt');
  if (!prompt || prompt.trim().length === 0) {
    return ephemeralReply('prompt is required.');
  }
  const ephemeral = readBooleanOption(interaction, 'ephemeral') ?? false;

  // ─── Defer + kick off async work ───────────────────────────────────
  // The deferred response opens a 15-min token window. We must PATCH
  // /messages/@original before that window expires or the UI freezes.
  void doReplyAsync({
    interaction,
    config,
    character,
    handler,
    prompt: prompt.trim(),
    ephemeral,
    channelId,
    invoker,
  }).catch((err) => {
    // doReplyAsync handles its own errors, but a top-level catch here
    // prevents an unhandled rejection from crashing the bot.
    console.error(`interactions: doReplyAsync top-level error:`, err);
  });

  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: ephemeral ? { flags: MessageFlags.EPHEMERAL } : {},
  };
}

// ──────────────────────────────────────────────────────────────────────
// Async reply worker
// ──────────────────────────────────────────────────────────────────────

interface AsyncWorkerArgs {
  interaction: DiscordInteraction;
  config: Config;
  character: CharacterConfig;
  handler: SlashCommandHandler;
  prompt: string;
  ephemeral: boolean;
  channelId: string;
  invoker: { id: string; username: string };
}

/**
 * V0.7-A.1: handler-aware async dispatch. Each handler shares the same
 * delivery primitives (deliverViaWebhook / deliverViaInteraction, the
 * 14m30s timeout, the circuit breaker) but produces its own reply chunks.
 * New handlers register here as additional cases — `chat` and `imagegen`
 * land first.
 */
async function doReplyAsync(args: AsyncWorkerArgs): Promise<void> {
  switch (args.handler) {
    case 'chat':
      return doReplyChat(args);
    case 'imagegen':
      return doReplyImagegen(args);
  }
}

async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
  const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
  const t0 = Date.now();

  console.log(
    `interactions: ${character.id}/chat dispatch · invoker=${invoker.username} ` +
      `channel=${channelId} ephemeral=${ephemeral} prompt="${truncate(prompt, 80)}"`,
  );

  try {
    // V0.7-A.1 Phase D: resolve channelId → zone before invoking the
    // composer so the substrate's environment-context block can ground the
    // LLM in WHERE it is. Zone is undefined for DMs and non-codex-mapped
    // channels — composeReply degrades gracefully.
    const zone = getZoneForChannel(config, channelId);
    const otherCharactersHere = selectedCharacterIds().filter((id) => id !== character.id);

    // V0.7-A.1 progressive UX (pattern: ruggy-v2 onToolUse): when the
    // orchestrator surfaces a tool_use block mid-stream, PATCH the deferred
    // interaction message with a status line ("🔧 pulling zone digest…").
    // The dispatcher's existing flow handles the final delivery: ephemeral=true
    // PATCHes again with the response; ephemeral=false delivers via Pattern B
    // webhook and then DELETEs the deferred placeholder. So progressive
    // status is naturally replaced by the final artifact in either case.
    //
    // Fire-and-forget: PATCH errors are logged but don't block the round-trip.
    // We coalesce by tool ID (SDK re-emits guard) AND by minimum interval
    // (bridgebuilder F4 PR #8 — rapid tool chains spamming PATCHes).
    // 500ms gate skips middle updates in rapid bursts; the LAST tool in
    // a burst still gets a PATCH because composeReply's resolution always
    // PATCHes the final reply (or webhook + DELETE), so the skipped
    // intermediate is replaced naturally.
    const seenToolIds = new Set<string>();
    const seenToolNames: string[] = [];
    const MIN_TOOL_PATCH_INTERVAL_MS = 500;
    let lastToolPatchMs = 0;
    const onToolUse = (event: ToolUseEvent): void => {
      if (seenToolIds.has(event.id)) return;
      seenToolIds.add(event.id);
      seenToolNames.push(event.name);
      const status = toolVerb(event.name);
      console.log(
        `interactions: ${character.id}/chat tool_use · ${event.name} · status="${status}"`,
      );
      const now = Date.now();
      if (now - lastToolPatchMs < MIN_TOOL_PATCH_INTERVAL_MS) {
        // Recent PATCH within the gate — skip this update; the next
        // distinct tool (or the final reply) will take its place.
        return;
      }
      lastToolPatchMs = now;
      patchOriginal(interaction, ephemeral, status).catch((err) => {
        console.warn(
          `interactions: ${character.id}/chat onToolUse PATCH failed (best-effort):`,
          err,
        );
      });
    };

    // Wrap composeReply in a 14m30s timeout so we never PATCH against an
    // expired interaction token (404 → silent freeze in Discord UI).
    const result = await Promise.race([
      composeReply({
        config,
        character,
        prompt,
        channelId,
        zone,
        otherCharactersHere,
        onToolUse,
        authorId: invoker.id,
        authorUsername: invoker.username,
      }),
      timeoutAfter(TOKEN_LIFETIME_MS),
    ]);

    if (result === TIMEOUT_SENTINEL) {
      console.error(
        `interactions: ${character.id}/chat TIMEOUT after ${Date.now() - t0}ms · channel=${channelId}`,
      );
      await patchOriginal(interaction, ephemeral, formatErrorReply(character, 'timeout'));
      return;
    }

    if (!result) {
      console.warn(
        `interactions: ${character.id}/chat composeReply returned null · channel=${channelId}`,
      );
      await patchOriginal(interaction, ephemeral, formatErrorReply(character, 'empty'));
      return;
    }

    // V0.10.2 telemetry (session-09 codex-rescue): post-compose log
    // surfaces tool_uses count + names per chat reply. Pairs with
    // [chat-route] log to confirm orchestrator path actually fired tools.
    // Together they distinguish H1 (SDK denying) vs H2 (naive path
    // active) vs H3 (persona contamination) vs H4 (server registration).
    console.log(
      `interactions: ${character.id}/chat tool_uses=${seenToolIds.size} ` +
        `names=[${seenToolNames.join(',')}] ` +
        `text_len=${result.content.length} ` +
        `channel=${channelId}`,
    );

    // Delivery routing:
    //   - ephemeral=true   → interaction PATCH (webhooks can't be ephemeral ·
    //                        invoker chose this · accepts shell identity)
    //   - ephemeral=false  → Pattern B webhook (per-character avatar + username)
    //                        with the user's prompt quote-prepended for channel
    //                        context · PATCH fallback if webhook delivery fails
    if (ephemeral) {
      await deliverViaInteraction(interaction, character, result.chunks, true);
    } else {
      try {
        await deliverViaWebhook(
          interaction,
          config,
          character,
          channelId,
          result.chunks,
          prompt,
          invoker.username,
        );
      } catch (webhookErr) {
        console.warn(
          `interactions: ${character.id}/chat webhook delivery failed · falling back to PATCH:`,
          webhookErr,
        );
        invalidateWebhookCache(channelId);
        await deliverViaInteraction(interaction, character, result.chunks, false);
      }
    }

    console.log(
      `interactions: ${character.id}/chat delivered · ` +
        `channel=${channelId} chunks=${result.chunks.length} ` +
        `compose_ms=${result.contextUsed.durationMs} ` +
        `total_ms=${Date.now() - t0} ` +
        `ledger=${result.contextUsed.ledgerSize} ` +
        `via=${ephemeral ? 'patch' : 'webhook'}`,
    );
  } catch (err) {
    console.error(
      `interactions: ${character.id}/chat dispatch failed · channel=${channelId}`,
      err,
    );
    try {
      await patchOriginal(interaction, ephemeral, formatErrorReply(character, 'error'));
    } catch (patchErr) {
      // Already-failed PATCH attempt feeds the circuit breaker via
      // recordPatchOutcome inside patchOriginal. No further recovery.
      console.error(`interactions: PATCH-original after error also failed:`, patchErr);
    }
  }
}

/**
 * V0.7-A.1 imagegen handler. Calls invokeStability directly (no LLM
 * intermediation) — the slash arg `prompt:` IS the image prompt. The
 * autoprompt-driven path (where the LLM decides to imagegen mid-reply)
 * is V0.7-A.x persona-iteration territory and uses the imagegen MCP
 * through the digest pipeline; this handler is the manual surface
 * (Eileen: "manual /satoshi-image prompt:..." per kickoff §unblocks).
 */
async function doReplyImagegen(args: AsyncWorkerArgs): Promise<void> {
  const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
  const t0 = Date.now();

  console.log(
    `interactions: ${character.id}/imagegen dispatch · invoker=${invoker.username} ` +
      `channel=${channelId} ephemeral=${ephemeral} prompt="${truncate(prompt, 80)}"`,
  );

  try {
    const result = await Promise.race([
      invokeStability(config, { prompt }),
      timeoutAfter(TOKEN_LIFETIME_MS),
    ]);

    if (result === TIMEOUT_SENTINEL) {
      console.error(
        `interactions: ${character.id}/imagegen TIMEOUT after ${Date.now() - t0}ms · channel=${channelId}`,
      );
      await patchOriginal(interaction, ephemeral, formatErrorReply(character, 'timeout'));
      return;
    }

    const reply = formatImagegenReply(character, result);
    const chunks = splitForDiscord(reply, DISCORD_CHAR_LIMIT);

    // Ledger discipline (V0.7-A.1 imagegen): append a SINGLE character
    // marker entry — no user-prompt entry (image prompts aren't chat
    // utterances) and no URL in content (the URL is delivery metadata,
    // not utterance text · letting it leak into chat-mode prompt context
    // pollutes the LLM's view of the conversation). The marker keeps the
    // prompt summary so subsequent chat invocations have continuity
    // ("what scene did you generate?") without LLM-quoteable URLs.
    const characterEntry: LedgerEntry = {
      role: 'character',
      content: `[generated an image · prompt: "${truncate(prompt, 80)}"]`,
      characterId: character.id,
      authorId: character.id,
      authorUsername: character.displayName ?? character.id,
      timestamp: new Date().toISOString(),
    };
    appendToLedger(channelId, characterEntry);

    // V0.11.3 (issue #14): when Bedrock returns real image bytes, deliver
    // them as an actual webhook attachment so Discord renders the image.
    // Pre-fix: the "image" was just an `attachment://...` pseudo-URL in
    // text content, which Discord can't resolve without a multipart file
    // part. Now we attach the bytes via discord.js AttachmentBuilder.
    //
    // Placeholder mode (Eileen's PR not landed yet) keeps the legacy
    // text-with-URL path because there are no bytes to attach.
    const hasImageBytes = !result.placeholder && result.imageBase64 && result.filename;
    if (ephemeral) {
      // Ephemeral imagegen via interaction PATCH doesn't support file
      // attachments today. Falls back to text-with-URL; image won't render
      // for ephemeral=true in scaffold mode either. Out-of-scope follow-up.
      await deliverViaInteraction(interaction, character, chunks, true);
    } else if (hasImageBytes) {
      try {
        const client = await getBotClient(config);
        if (!client) throw new Error('imagegen attachment path: bot client unavailable');
        const webhook = await getOrCreateChannelWebhook(client, channelId);

        // V0.11.3 (codex review): pre-decode size + base64 sanity check.
        // If `Buffer.from(..., 'base64')` produces 0 bytes (malformed input),
        // throw EARLY so the catch surfaces an in-character error rather
        // than letting Discord reject and falling to the broken-URL path.
        const imageBytes = Buffer.from(result.imageBase64!, 'base64');
        if (imageBytes.byteLength === 0) {
          throw new Error('image-decode-failed: base64 decoded to zero bytes');
        }
        // Discord webhook attachment limit: 8 MB on free tier (25 MB Nitro).
        // We ship at 8 MB conservatively — Bedrock Stability ultra outputs
        // are typically 1-3 MB, so this is a safety floor not a normal cap.
        const DISCORD_WEBHOOK_ATTACHMENT_LIMIT = 8 * 1024 * 1024;
        if (imageBytes.byteLength > DISCORD_WEBHOOK_ATTACHMENT_LIMIT) {
          throw new Error(
            `image-too-large: ${imageBytes.byteLength} bytes > ${DISCORD_WEBHOOK_ATTACHMENT_LIMIT}`,
          );
        }

        const caption = `${character.displayName ?? character.id} in Freeside`;

        await sendImageReplyViaWebhook(webhook, character, {
          content: caption,
          imageBytes,
          filename: result.filename!,
        });
        // Clean up the deferred "thinking" placeholder (Pattern B convention).
        void deleteOriginal(interaction).catch((err) => {
          console.warn(
            `interactions: ${character.id}/imagegen deleteOriginal best-effort failed:`,
            err,
          );
        });
      } catch (webhookErr) {
        // V0.11.3 (codex review): the prior catch fell back to delivering
        // `chunks` (which contains the `attachment://...` pseudo-URL as
        // text) — that's the broken-looking message we're trying to fix.
        // Surface an in-character error instead. The image bytes weren't
        // delivered; Discord shouldn't see a fake URL.
        const errMsg = String(webhookErr);
        const errKind = errMsg.includes('image-too-large')
          ? 'image-too-large'
          : 'image-delivery-failed';
        console.warn(
          `interactions: ${character.id}/imagegen attachment delivery failed · kind=${errKind} ·`,
          webhookErr,
        );
        invalidateWebhookCache(channelId);
        try {
          await patchOriginal(interaction, ephemeral, formatErrorReply(character, errKind));
        } catch (patchErr) {
          console.error(
            `interactions: ${character.id}/imagegen error PATCH also failed:`,
            patchErr,
          );
        }
      }
    } else {
      // Placeholder mode (no real bytes): fall back to text-only via the
      // existing chat-reply webhook path. Operator sees the scaffold notice
      // + synthetic placehold.co URL until Eileen's Stability invoke lands.
      try {
        await deliverViaWebhook(
          interaction,
          config,
          character,
          channelId,
          chunks,
          prompt,
          invoker.username,
        );
      } catch (webhookErr) {
        console.warn(
          `interactions: ${character.id}/imagegen webhook delivery failed · falling back to PATCH:`,
          webhookErr,
        );
        invalidateWebhookCache(channelId);
        await deliverViaInteraction(interaction, character, chunks, false);
      }
    }

    console.log(
      `interactions: ${character.id}/imagegen delivered · ` +
        `channel=${channelId} model=${result.model} seed=${result.seed} ` +
        `placeholder=${result.placeholder} attached=${hasImageBytes} ` +
        `total_ms=${Date.now() - t0} via=${ephemeral ? 'patch' : 'webhook'}`,
    );
  } catch (err) {
    console.error(
      `interactions: ${character.id}/imagegen dispatch failed · channel=${channelId}`,
      err,
    );
    try {
      await patchOriginal(interaction, ephemeral, formatErrorReply(character, 'error'));
    } catch (patchErr) {
      console.error(`interactions: PATCH-original after imagegen error also failed:`, patchErr);
    }
  }
}

/**
 * Format the imagegen reply for Discord delivery. When the substrate is
 * in scaffold mode (Eileen's Bedrock Stability invoke not yet landed),
 * the result.placeholder flag is true and we annotate so collaborators
 * see the URL is synthetic rather than burning time wondering why
 * placehold.co looks broken.
 */
function formatImagegenReply(
  character: CharacterConfig,
  result: { url: string; model: string; seed: number; placeholder: boolean },
): string {
  const displayName = character.displayName ?? character.id;
  if (result.placeholder) {
    return (
      `**${displayName}** · imagegen scaffold\n\n` +
      `${result.url}\n` +
      `_model=${result.model} · seed=${result.seed} · placeholder=true · awaiting Eileen's Stability invoke PR_`
    );
  }
  return `${result.url}\n_${displayName} · model=${result.model} · seed=${result.seed}_`;
}

/**
 * V0.11.3 (issue #14): caption shown above the attached image. Discord
 * renders the file inline below the content; the caption carries
 * metadata (model + seed) and the user's prompt as a quote so others
 * in the channel see the request that produced the image.
 *
 * No URL in the caption — Discord shows the attachment natively, and
 * leaking a substrate-side URL into the visible message would confuse
 * the reader (the URL is now meaningless metadata, not a link).
 */
function formatImagegenCaption(
  character: CharacterConfig,
  result: { model: string; seed: number },
  prompt: string,
  authorUsername: string,
): string {
  const displayName = character.displayName ?? character.id;
  const quote = `> @${authorUsername}: ${truncate(prompt, 200)}\n`;
  return `${quote}_${displayName} · model=${result.model} · seed=${result.seed}_`;
}

// ──────────────────────────────────────────────────────────────────────
// Delivery paths — webhook (Pattern B) vs interaction PATCH (ephemeral)
// ──────────────────────────────────────────────────────────────────────

/**
 * Pattern B delivery via channel webhook. Slash reply renders with the
 * character's avatar + username (per-message override on the shell
 * webhook). The deferred "thinking" PATCH placeholder is DELETEd once
 * the first chunk lands, leaving a clean Pattern B-shaped channel timeline.
 *
 * The user's prompt is quote-prepended to the first chunk so other channel
 * members see what was asked (slash-command argument values aren't shown
 * in Discord's invocation header). Bridge until V0.7-A.3 lands @-mention
 * routing where the user's message is a regular Discord post everyone sees.
 *
 * Throws on any webhook failure so the caller can fall back to PATCH.
 */
async function deliverViaWebhook(
  interaction: DiscordInteraction,
  config: Config,
  character: CharacterConfig,
  channelId: string,
  chunks: string[],
  prompt: string,
  authorUsername: string,
): Promise<void> {
  const client = await getBotClient(config);
  if (!client) {
    throw new Error('webhook path: bot client unavailable');
  }
  const webhook = await getOrCreateChannelWebhook(client, channelId);

  // Prepend the user's prompt as a Discord blockquote on the first chunk so
  // others in the channel see context. allowedMentions:[] (set in
  // sendChatReplyViaWebhook) prevents the @ from triggering a ping.
  const quote = buildQuotePrefix(authorUsername, prompt);
  const firstWithQuote = quote + chunks[0]!;
  const allChunks =
    firstWithQuote.length <= DISCORD_CHAR_LIMIT
      ? [firstWithQuote, ...chunks.slice(1)]
      : [...splitForDiscord(firstWithQuote, DISCORD_CHAR_LIMIT), ...chunks.slice(1)];

  for (let i = 0; i < allChunks.length; i++) {
    if (i > 0) await sleep(FOLLOW_UP_THROTTLE_MS);
    await sendChatReplyViaWebhook(webhook, character, allChunks[i]!);
    if (i === 0) {
      // Delete the deferred "thinking..." placeholder once the first
      // webhook chunk is up. Best-effort — if it fails (e.g., expired
      // token, race), the placeholder lingers but delivery is unaffected.
      void deleteOriginal(interaction).catch((err) => {
        console.warn(
          `interactions: deleteOriginal best-effort failed (placeholder may linger):`,
          err,
        );
      });
    }
  }
}

const QUOTE_PROMPT_MAX_LEN = 240;

/**
 * Build a single-line Discord blockquote of the user's prompt. The `@` is
 * decorative (no ping fires because allowedMentions is empty). Multi-line
 * prompts collapse to one line so the blockquote renders as one visual
 * unit · long prompts truncate with an ellipsis (full text remains in the
 * conversation ledger for LLM context on subsequent invocations).
 */
function buildQuotePrefix(authorUsername: string, prompt: string): string {
  let body = prompt.trim().replace(/\s+/g, ' ');
  if (body.length > QUOTE_PROMPT_MAX_LEN) {
    body = body.slice(0, QUOTE_PROMPT_MAX_LEN - 1) + '…';
  }
  return `> @${authorUsername} asked: ${body}\n\n`;
}

/**
 * Interaction PATCH delivery — used for ephemeral replies and as a
 * fallback when webhook delivery fails. Bold-prefix attribution because
 * the shell-bot identity is the one Discord renders.
 */
async function deliverViaInteraction(
  interaction: DiscordInteraction,
  character: CharacterConfig,
  rawChunks: string[],
  ephemeral: boolean,
): Promise<void> {
  const { chunks } = formatReply(character, rawChunks);
  await patchOriginal(interaction, ephemeral, chunks[0] ?? '');
  for (let i = 1; i < chunks.length; i++) {
    await sleep(FOLLOW_UP_THROTTLE_MS);
    await postFollowUp(interaction, ephemeral, chunks[i]!);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Reply rendering — bold-prefix attribution
// ──────────────────────────────────────────────────────────────────────

/**
 * Format the reply with character attribution prefix on the FIRST chunk
 * only. Subsequent chunks render bare so the prefix doesn't repeat awkwardly.
 *
 * The bold-prefix exists because slash command responses come from the
 * SHELL bot identity (no per-message webhook override is available on
 * interaction patches per Gemini DR 2026-04-30). It's the unobtrusive
 * disambiguation when multiple characters share one shell-bot identity.
 */
function formatReply(
  character: CharacterConfig,
  rawChunks: string[],
): { chunks: string[] } {
  if (rawChunks.length === 0) {
    return { chunks: [`**${character.displayName ?? character.id}**\n\n(empty reply — try again?)`] };
  }
  const displayName = character.displayName ?? character.id;
  const prefix = `**${displayName}**\n\n`;
  const first = prefix + rawChunks[0]!;

  // If prefix push first chunk over Discord's 2000-char limit, re-split.
  const chunks: string[] = [];
  if (first.length <= DISCORD_CHAR_LIMIT) {
    chunks.push(first);
    for (let i = 1; i < rawChunks.length; i++) {
      chunks.push(rawChunks[i]!);
    }
  } else {
    const reSplit = splitForDiscord(first, DISCORD_CHAR_LIMIT);
    chunks.push(...reSplit);
    for (let i = 1; i < rawChunks.length; i++) {
      chunks.push(rawChunks[i]!);
    }
  }
  return { chunks };
}

function formatErrorReply(
  character: CharacterConfig,
  kind: 'timeout' | 'empty' | 'error' | 'image-too-large' | 'image-delivery-failed',
): string {
  const displayName = character.displayName ?? character.id;
  switch (kind) {
    case 'timeout':
      return `**${displayName}**\n\nthat took longer than i had time for. mind trying again?`;
    case 'empty':
      return `**${displayName}**\n\ncables got crossed — nothing came back. try again?`;
    case 'error':
      return `**${displayName}**\n\nsomething broke. try again?`;
    case 'image-too-large':
      return `**${displayName}**\n\nthe image came back bigger than discord lets a webhook deliver. try a different prompt or aspect ratio?`;
    case 'image-delivery-failed':
      return `**${displayName}**\n\nthe image generated but delivery hiccuped. try again — same seed should reproduce.`;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Discord REST helpers — PATCH original + POST follow-up
// ──────────────────────────────────────────────────────────────────────

/**
 * PATCH the deferred response with the actual reply content.
 * Endpoint: PATCH /webhooks/{application_id}/{interaction_token}/messages/@original
 * Note: interaction token in URL · NO Authorization header needed.
 */
async function patchOriginal(
  interaction: DiscordInteraction,
  ephemeral: boolean,
  content: string,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const body: { content: string; flags?: number } = { content };
  if (ephemeral) body.flags = MessageFlags.EPHEMERAL;

  const channelId = interaction.channel_id ?? `dm:${interactionInvoker(interaction)?.id ?? 'unknown'}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  recordPatchOutcome(channelId, response.status);

  if (!response.ok) {
    const txt = await response.text().catch(() => '<unreadable body>');
    throw new Error(
      `interactions: PATCH @original failed status=${response.status} body=${txt.slice(0, 200)}`,
    );
  }
}

/**
 * POST a follow-up message (used for chunks 2..N when reply > 2000 chars).
 * Endpoint: POST /webhooks/{application_id}/{interaction_token}
 */
async function postFollowUp(
  interaction: DiscordInteraction,
  ephemeral: boolean,
  content: string,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}`;
  const body: { content: string; flags?: number } = { content };
  if (ephemeral) body.flags = MessageFlags.EPHEMERAL;

  const channelId = interaction.channel_id ?? `dm:${interactionInvoker(interaction)?.id ?? 'unknown'}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  recordPatchOutcome(channelId, response.status);

  if (!response.ok) {
    const txt = await response.text().catch(() => '<unreadable body>');
    throw new Error(
      `interactions: follow-up POST failed status=${response.status} body=${txt.slice(0, 200)}`,
    );
  }
}

/**
 * DELETE the deferred response. Used after Pattern B webhook delivery to
 * clean up the "Application is thinking..." placeholder. 404 is acceptable
 * (already deleted or token expired).
 * Endpoint: DELETE /webhooks/{application_id}/{interaction_token}/messages/@original
 */
async function deleteOriginal(interaction: DiscordInteraction): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    const txt = await response.text().catch(() => '<unreadable body>');
    throw new Error(
      `interactions: DELETE @original failed status=${response.status} body=${txt.slice(0, 200)}`,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Util
// ──────────────────────────────────────────────────────────────────────

const TIMEOUT_SENTINEL = Symbol('timeout');
type TimeoutSentinel = typeof TIMEOUT_SENTINEL;

function timeoutAfter(ms: number): Promise<TimeoutSentinel> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(TIMEOUT_SENTINEL), ms);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ephemeralReply(content: string): DiscordInteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: MessageFlags.EPHEMERAL },
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
