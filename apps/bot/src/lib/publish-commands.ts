/**
 * publishCommands — register slash commands with Discord.
 *
 * Two consumers (2026-05-04):
 *   1. Bot startup auto-publish (`apps/bot/src/index.ts`) — every deploy
 *      auto-syncs commands so merge=Discord push.
 *   2. CLI tool (`apps/bot/scripts/publish-commands.ts`) — ad-hoc
 *      registration during local dev.
 *
 * Discord PUT replaces the full set per (application, guild) so calls are
 * idempotent — duplicate calls don't leak.
 *
 * Propagation gotcha (Gemini DR 2026-04-30): GLOBAL command sync can take
 * up to 1 HOUR to propagate · users may invoke OLD CACHED schemas during
 * the window, sending malformed payloads to the new backend. For breaking
 * changes, prefer guild-only registration during dev and stage carefully
 * for prod cutover.
 */

import type { CharacterConfig } from '@freeside-characters/persona-engine';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Discord application command option types (PARTIAL · only what we use).
const SUB_COMMAND_OPTION_TYPE = 1;
const STRING_OPTION_TYPE = 3;
const BOOLEAN_OPTION_TYPE = 5;

interface CommandOption {
  name: string;
  description: string;
  /** Discord application command option type. STRING=3, BOOLEAN=5, SUB_COMMAND=1. */
  type: number;
  required?: boolean;
}

export interface CommandSchema {
  name: string;
  description: string;
  options: CommandOption[];
}

// =====================================================================
// Public API
// =====================================================================

export interface PublishCommandsOptions {
  readonly botToken: string;
  /** If absent, derived from `/applications/@me`. */
  readonly applicationId?: string;
  /** undefined = global registration (~1hr propagation). */
  readonly guildId?: string;
  readonly characters: readonly CharacterConfig[];
}

export interface PublishCommandsResult {
  readonly registered: number;
  readonly commands: ReadonlyArray<{ name: string; id: string }>;
  readonly scope: 'guild' | 'global';
  readonly guildId?: string;
}

/**
 * Register slash commands with Discord. Idempotent — Discord PUT replaces
 * the full set per (application, guild) so duplicate calls don't leak.
 *
 * Per-character guild routing (V0.7 · 2026-05-12): if any character has
 * `publishGuilds` set, characters are grouped by their target guilds and
 * each guild receives only its allowed characters. Characters without
 * `publishGuilds` fall back to `opts.guildId` (which may be undefined for
 * global publish — backward-compat with V0.6 single-guild model).
 *
 * **Breaking change from V0.6**: return type is now PublishCommandsResult[]
 * (one entry per guild published) instead of a single PublishCommandsResult.
 * Callers MUST update to iterate the array. There is no single-result
 * compat shim — the multi-guild routing model requires the per-guild
 * outcome shape. Both in-tree callers (auto-publish in `apps/bot/src/index.ts`
 * and the CLI script in `apps/bot/scripts/publish-commands.ts`) were
 * updated in the same commit.
 *
 * Partial-failure semantics (BB-59 closure): each guild publish is wrapped
 * in try/catch. Failures are collected and logged per-guild as they happen,
 * then the function throws AT END with an aggregate message listing
 * succeeded/failed guilds + the first failure's message. The thrown error
 * carries observability of partial-success state vs. the prior throw-mid-loop
 * which abandoned remaining guilds silently.
 *
 * @throws Error if any guild publish failed. Succeeded guilds' results are
 *         logged to console.error before the throw; check logs for which
 *         guilds landed. Throw aggregate message names succeeded/failed sets.
 */
export async function publishCommands(
  opts: PublishCommandsOptions,
): Promise<PublishCommandsResult[]> {
  if (!opts.botToken) {
    throw new Error('publishCommands: botToken is required');
  }

  const applicationId =
    opts.applicationId ?? (await fetchApplicationId(opts.botToken));
  if (!applicationId) {
    throw new Error(
      'publishCommands: applicationId not provided and could not be derived from /applications/@me',
    );
  }

  if (opts.characters.length === 0) {
    throw new Error('publishCommands: no characters provided');
  }

  // Mixed-config footgun guard (BB-59 global-fallback-when-mixed): if
  // some chars have publishGuilds + some don't + opts.guildId is
  // undefined, the chars without publishGuilds would silently publish
  // globally. Warn loudly so operator catches an unset DISCORD_GUILD_ID
  // before 1-hour global propagation makes it visible everywhere.
  const charsWithGuilds = opts.characters.filter(
    (c) => c.publishGuilds && c.publishGuilds.length > 0,
  );
  const charsWithoutGuilds = opts.characters.filter(
    (c) => !c.publishGuilds || c.publishGuilds.length === 0,
  );
  if (
    charsWithGuilds.length > 0 &&
    charsWithoutGuilds.length > 0 &&
    opts.guildId === undefined
  ) {
    console.warn(
      `publishCommands: MIXED CONFIG — ${charsWithGuilds.length} chars have publishGuilds, ${charsWithoutGuilds.length} lack it, opts.guildId is undefined. ` +
        `Chars without publishGuilds will publish GLOBALLY (1-hour propagation, visible in EVERY guild the bot is in). ` +
        `This is likely unintended. Set publishGuilds on: [${charsWithoutGuilds.map((c) => c.id).join(', ')}] OR provide opts.guildId as fallback.`,
    );
  }

  // Group characters by target guild. Characters with publishGuilds set
  // route per-guild; characters without it (or with empty array) fall
  // back to opts.guildId (which may be undefined = global publish).
  // BB-59 duplicate-guild-ids-dedup: dedupe via Set in case operator
  // typo'd publishGuilds: ['G1', 'G1'] — would otherwise duplicate the
  // character in G1's command set.
  const byGuild = new Map<string | undefined, CharacterConfig[]>();
  for (const char of opts.characters) {
    const targets =
      char.publishGuilds && char.publishGuilds.length > 0
        ? Array.from(new Set(char.publishGuilds))
        : [opts.guildId];
    for (const guild of targets) {
      const existing = byGuild.get(guild);
      if (existing) {
        existing.push(char);
      } else {
        byGuild.set(guild, [char]);
      }
    }
  }

  // BB-59 partial-failure-atomicity: iterate guilds, collect per-guild
  // outcomes, log each. If any failed, throw AFTER the loop with an
  // aggregate message — preserves observability of which guilds landed
  // vs. which didn't (vs. the prior throw-mid-loop which abandoned
  // remaining guilds silently).
  const results: PublishCommandsResult[] = [];
  const failures: Array<{ guildId: string | undefined; error: Error }> = [];

  for (const [guildId, characters] of byGuild) {
    try {
      const commands = buildCommandSet(characters);
      const url = guildId
        ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${guildId}/commands`
        : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${opts.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '<unreadable>');
        throw new Error(
          `Discord PUT failed for guild=${guildId ?? '(global)'} status=${response.status} body=${txt}`,
        );
      }

      const result = (await response.json()) as Array<{ id: string; name: string }>;
      results.push({
        registered: result.length,
        commands: result.map((r) => ({ name: r.name, id: r.id })),
        scope: guildId ? 'guild' : 'global',
        guildId,
      });
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      failures.push({ guildId, error: wrapped });
      console.error(
        `publishCommands: guild=${guildId ?? '(global)'} FAILED: ${wrapped.message}`,
      );
    }
  }

  if (failures.length > 0) {
    const succeeded = results
      .map((r) => r.guildId ?? '(global)')
      .join(', ') || 'none';
    const failed = failures
      .map((f) => f.guildId ?? '(global)')
      .join(', ');
    throw new Error(
      `publishCommands: ${failures.length}/${byGuild.size} guild publishes failed; ${results.length} succeeded. ` +
        `succeeded=[${succeeded}] failed=[${failed}]. ` +
        `First failure: guild=${failures[0].guildId ?? '(global)'} ${failures[0].error.message}`,
    );
  }

  return results;
}

/**
 * Build the full command set for the loaded characters. Pure function —
 * no I/O, deterministic given the same characters input.
 *
 * Exported so the CLI can preview the set before submitting.
 */
export function buildCommandSet(
  characters: readonly CharacterConfig[],
): CommandSchema[] {
  const commands: CommandSchema[] = characters.map((c) =>
    buildCommand(c.id, c.displayName ?? c.id),
  );

  if (characters.some((c) => c.id === 'satoshi')) {
    commands.push({
      name: 'satoshi-image',
      description: 'Ask Satoshi to generate an image',
      options: [
        {
          name: 'prompt',
          description: 'Describe the image you want Satoshi to generate',
          type: STRING_OPTION_TYPE,
          required: true,
        },
        {
          name: 'ephemeral',
          description: 'only you see the reply',
          type: BOOLEAN_OPTION_TYPE,
          required: false,
        },
      ],
    });
  }

  // V0.7-A.5 / cycle-Q · sprint-3 Q3.5: /quest slash command tree.
  // 4 subcommands per SDD §5.4: browse · accept <quest_id> · submit <quest_id> · status.
  // Routed by apps/bot/src/discord-interactions/dispatch.ts via the
  // `quest` command name → @0xhoneyjar/quests-discord-renderer dispatchQuestInteraction.
  //
  // SYSTEM_COMMANDS extension per Q3.5 task spec — registered alongside
  // per-character commands; NOT bound to a single character (cross-NPC).
  commands.push({
    name: 'quest',
    description: 'browse · accept · submit · check the path',
    options: [
      {
        name: 'browse',
        description: 'see the quests on offer',
        type: SUB_COMMAND_OPTION_TYPE,
      } as unknown as CommandOption,
      {
        name: 'accept',
        description: 'mark a quest as accepted',
        type: SUB_COMMAND_OPTION_TYPE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          options: [
            {
              name: 'quest_id',
              description: 'the quest to accept',
              type: STRING_OPTION_TYPE,
              required: true,
            },
          ],
        } as any),
      } as unknown as CommandOption,
      {
        name: 'submit',
        description: 'submit your offering for an accepted quest',
        type: SUB_COMMAND_OPTION_TYPE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          options: [
            {
              name: 'quest_id',
              description: 'the quest you are submitting for',
              type: STRING_OPTION_TYPE,
              required: true,
            },
          ],
        } as any),
      } as unknown as CommandOption,
      {
        name: 'status',
        description: 'see your marks',
        type: SUB_COMMAND_OPTION_TYPE,
      } as unknown as CommandOption,
    ],
  });

  return commands;
}

function buildCommand(id: string, displayName: string): CommandSchema {
  const lower = displayName.toLowerCase();
  return {
    name: id,
    description: `talk to ${lower}`,
    options: [
      { name: 'prompt', description: `what to say to ${lower}`, type: STRING_OPTION_TYPE, required: true },
      { name: 'ephemeral', description: 'only you see the reply', type: BOOLEAN_OPTION_TYPE, required: false },
    ],
  };
}

export async function fetchApplicationId(botToken: string): Promise<string | undefined> {
  const response = await fetch(`${DISCORD_API_BASE}/applications/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    console.warn(`publish-commands: could not fetch /applications/@me (status ${response.status})`);
    return undefined;
  }
  const data = (await response.json()) as { id?: string };
  return data.id;
}
