#!/usr/bin/env bun
/**
 * rlhf-preview — cycle-008 S9 (g30) · Discord-native RLHF iteration surface (hexagonal).
 *
 * Discord IS the surface: candidates are posted to a TEST channel (100% real-client fidelity),
 * the operator rates by reacting 1️⃣–5️⃣ + replying a why, and `collect` reads it back into the
 * preference corpus. The terminal is a thin dev-aid adapter over the same core loop.
 *
 *   preview   generate-N → print billboards to the terminal (dry inspection · terminal adapter)
 *   discord   generate-N → post to the test channel + attach 1-5 reactions (Discord adapter · present)
 *   collect   read reactions (scores) + replies (whys) → rlhf-preference-v1 (Discord adapter · capture)
 *   promote   promote a winner → evals/snapshots/<id>.md
 *
 * Discord needs: --webhook <url> (or RLHF_TEST_WEBHOOK_URL) for posting · DISCORD_BOT_TOKEN
 * (from .env) for reactions + reading. Bot must be in the server + Message Content intent ON
 * to read reply "why"s. See grimoires/loa/a2a/sprint-30/reviewer.md.
 *
 * Exit codes: 0 success · 1 bad args · 2 runtime (missing batch/config).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import type { ZoneId } from '@freeside-characters/persona-engine/score/types';
import {
  buildSnapshot,
  caseById,
  CANONICAL_CASES,
  BILLBOARD_VARIANTS,
  resolveAllVariants,
  allVariants,
  renderBatch,
  captureAndRecord,
  promoteToEvals,
  createDiscordAdapter,
  createTerminalAdapter,
  POST_TYPE_GALLERY,
  PREFERENCE_LOG_PATH,
  EVALS_SNAPSHOTS_DIR,
  type RenderBatch,
  type PresentedBatch,
  type VoiceAugment,
} from '@freeside-characters/persona-engine/preview';

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'grimoires')) && existsSync(join(dir, 'packages'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const RUN_DIR = join(REPO_ROOT, '.run', 'rlhf-preview');
const TEMPLATES_PATH = join(RUN_DIR, 'templates.json');
const VALID_ZONES: ReadonlyArray<ZoneId> = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

interface BatchState {
  batch: RenderBatch;
  presented?: PresentedBatch;
}

function fail(message: string, code = 1): never {
  console.error(`rlhf-preview: ${message}`);
  process.exit(code);
}

function parseFlags(argv: ReadonlyArray<string>): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const str = (flags: Record<string, string | boolean>, key: string): string | undefined =>
  typeof flags[key] === 'string' ? (flags[key] as string) : undefined;

function parseVoice(raw: string | undefined, fallback: VoiceAugment): VoiceAugment {
  if (!raw) return fallback;
  const [header, outro = ''] = raw.split('|');
  return { header: header ?? '', outro };
}

const statePath = (batchId: string) => join(RUN_DIR, `${batchId}.json`);

function loadState(batchId: string): BatchState {
  const path = statePath(batchId);
  if (!existsSync(path)) fail(`no batch state at ${path} — run \`rlhf-preview discord …\` first`, 2);
  return JSON.parse(readFileSync(path, 'utf8')) as BatchState;
}

function saveState(state: BatchState): void {
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(statePath(state.batch.batchId), JSON.stringify(state, null, 2), 'utf8');
}

/** Resolve snapshot + voice + variant spec from flags (shared by preview/discord). */
function resolveInitial(flags: Record<string, string | boolean>): {
  snapshot: ReturnType<typeof buildSnapshot>;
  voice: VoiceAugment;
  variantSpec: { ids?: string[]; fireN?: number };
} {
  let snapshot;
  let defaultVoice: VoiceAugment = { header: '', outro: '' };
  const caseId = str(flags, 'case');
  if (caseId) {
    const c = caseById(caseId);
    if (!c) fail(`unknown --case "${caseId}" — known: ${CANONICAL_CASES.map((x) => x.id).join(', ')}`);
    snapshot = c.build();
    defaultVoice = c.defaultVoice;
  } else {
    const zone = (str(flags, 'zone') ?? 'owsley-lab') as ZoneId;
    if (!VALID_ZONES.includes(zone)) fail(`invalid --zone "${zone}" — one of ${VALID_ZONES.join(', ')}`);
    const totalEvents = Number(str(flags, 'total-events') ?? '352');
    if (!Number.isFinite(totalEvents)) fail('--total-events must be a number');
    const aw = str(flags, 'active-wallets');
    const dp = str(flags, 'delta-pct');
    const win = str(flags, 'window');
    snapshot = buildSnapshot({
      zone,
      totalEvents,
      activeWallets: aw !== undefined ? Number(aw) : undefined,
      deltaPct: dp !== undefined ? Number(dp) : null,
      windowDays: win !== undefined ? (Number(win) as 7 | 30 | 90) : 30,
    });
  }
  const ids = str(flags, 'variants');
  const fn = str(flags, 'fire-n');
  return {
    snapshot,
    voice: parseVoice(str(flags, 'voice'), defaultVoice),
    variantSpec: { ids: ids ? ids.split(',').map((s) => s.trim()) : undefined, fireN: fn !== undefined ? Number(fn) : undefined },
  };
}

function buildBatch(flags: Record<string, string | boolean>): RenderBatch {
  const init = resolveInitial(flags);
  try {
    return renderBatch(init.snapshot, init.voice, resolveAllVariants(init.variantSpec, TEMPLATES_PATH), str(flags, 'batch'));
  } catch (e) {
    fail((e as Error).message);
  }
}

function requireWebhook(flags: Record<string, string | boolean>): string {
  const webhook = str(flags, 'webhook') ?? process.env.RLHF_TEST_WEBHOOK_URL;
  if (!webhook) {
    fail(
      'discord requires a TEST webhook — --webhook <url> or RLHF_TEST_WEBHOOK_URL.\n' +
        '  test server → channel → Integrations → Webhooks → New → Copy URL. NEVER a prod community channel.',
    );
  }
  try {
    new URL(webhook);
  } catch {
    fail('--webhook is not a valid URL');
  }
  return webhook;
}

// ── preview (terminal adapter · dry inspection) ───────────────────────────────
async function cmdPreview(flags: Record<string, string | boolean>): Promise<void> {
  const batch = buildBatch(flags);
  await createTerminalAdapter().present(batch);
  saveState({ batch });
  console.log(`(dry · terminal) batch ${batch.batchId} · ${batch.candidates.length} candidates`);
  console.log(`post to Discord: rlhf-preview discord --batch ${batch.batchId} --webhook <url>\n`);
}

// ── discord (present · post + reactions) ──────────────────────────────────────
async function cmdDiscord(flags: Record<string, string | boolean>): Promise<void> {
  const webhook = requireWebhook(flags);
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const batchId = str(flags, 'batch');
  const batch = batchId && existsSync(statePath(batchId)) ? loadState(batchId).batch : buildBatch(flags);

  const adapter = createDiscordAdapter({ webhookUrl: webhook, botToken });
  console.log(`\nposting ${batch.candidates.length} candidates (${batch.candidates.map((c) => c.variantId).join(', ')}) → ${new URL(webhook).host}`);
  if (!botToken) console.log('note: DISCORD_BOT_TOKEN unset — skipping auto 1-5 reactions; add them yourself in Discord.');
  const presented = await adapter.present(batch);
  saveState({ batch, presented });
  console.log(`posted. anchors: ${presented.presented.length} · channel ${presented.meta?.channelId ?? '?'}`);
  console.log(`\nrate in Discord (react 1️⃣–5️⃣ on each "━━ <id> ━━" message · reply your why), then:`);
  console.log(`  rlhf-preview collect --batch ${batch.batchId}\n`);
}

// ── collect (capture · reactions + replies → preference-v1) ────────────────────
async function cmdCollect(flags: Record<string, string | boolean>): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) fail('collect requires DISCORD_BOT_TOKEN (the bot reads your reactions/replies via REST)', 2);
  const batchId = str(flags, 'batch');
  if (!batchId) fail('collect requires --batch <id>');
  const state = loadState(batchId);
  if (!state.presented) fail(`batch ${batchId} was never presented to Discord — run \`rlhf-preview discord\` first`, 2);

  const adapter = createDiscordAdapter({
    webhookUrl: '',
    botToken,
    channelId: state.presented.meta?.channelId as string | undefined,
    operatorUserId: str(flags, 'operator'),
  });
  const { record, recordPath } = await captureAndRecord(adapter, state.batch, state.presented, {
    preferenceLogPath: join(REPO_ROOT, PREFERENCE_LOG_PATH),
  });
  if (!record.ratings || record.ratings.length === 0) {
    console.log('\nno ratings found yet — react 1️⃣–5️⃣ on the candidate anchors in Discord, then re-run collect.');
    return;
  }
  console.log(`\ncollected ${record.ratings.length} ratings → ${recordPath}`);
  for (const r of record.ratings) {
    const s = r.score !== undefined ? `${r.score}/5` : 'why-only';
    console.log(`  ${r.variant}: ${s}${r.why ? ` · "${r.why}"` : ''}`);
  }
  console.log(`\nwinner: ${record.chosen}. promote it: rlhf-preview promote --batch ${batchId} --variant ${record.chosen}`);
  console.log(`(this rlhf-preference-v1 record is the cycle-009 judge's calibration signal · agent breeds next gen from it.)\n`);
}

// ── gallery (experiment: every post type in Components V2 · rateable) ──────────
async function cmdGallery(flags: Record<string, string | boolean>): Promise<void> {
  const webhook = requireWebhook(flags);
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const snapshot = resolveInitial(flags).snapshot;
  const only = str(flags, 'only');
  const items = only ? POST_TYPE_GALLERY.filter((i) => i.postType === only) : POST_TYPE_GALLERY;
  if (items.length === 0) fail(`no gallery item "${only}" — known: ${POST_TYPE_GALLERY.map((i) => i.postType).join(', ')}`);

  // Each post-type layout becomes a rateable candidate (carries its own Components V2 via
  // componentsV2Override) so it rides the SAME present → react → collect loop as the billboard.
  const batch: RenderBatch = {
    batchId: `rlhf-gallery-${Date.now().toString(36)}`,
    zone: snapshot.zone,
    zoneDisplay: snapshot.displayName,
    snapshot,
    voice: { header: '', outro: '' },
    candidates: items.map((item) => {
      const r = item.build(snapshot);
      if (r.text !== undefined) {
        // voice item (micro) — a plain text message in ruggy's voice, not a component.
        return {
          variantId: item.postType,
          variantLabel: item.label,
          variantNote: '',
          surface: 'bold-text' as const,
          voiceContent: '',
          billboard: r.text,
          billboardLines: [item.label],
          payload: { content: '', embeds: [], secondary: { content: r.text, embeds: [] } },
        };
      }
      return {
        variantId: item.postType,
        variantLabel: item.label,
        variantNote: '',
        surface: 'components-v2' as const,
        voiceContent: '',
        billboard: '',
        billboardLines: [item.label],
        payload: { content: '', embeds: [] },
        componentsV2Override: r.components ?? [],
      };
    }),
  };

  const adapter = createDiscordAdapter({ webhookUrl: webhook, botToken });
  console.log(`\nposting ${items.length} post-type layout(s) (Components V2) → ${new URL(webhook).host}`);
  if (!botToken) console.log('note: DISCORD_BOT_TOKEN unset — no 1-5 reactions; add them yourself to rate.');
  const presented = await adapter.present(batch);
  saveState({ batch, presented });
  console.log(`posted ${presented.presented.length} post-type layouts · channel ${presented.meta?.channelId ?? '?'}`);
  console.log(`\nrate each post-type anchor (react 1️⃣–5️⃣ · reply your why), then:`);
  console.log(`  rlhf-preview collect --batch ${batch.batchId}\n`);
}

// ── promote (backpressure → eval set) ─────────────────────────────────────────
function cmdPromote(flags: Record<string, string | boolean>): void {
  const batchId = str(flags, 'batch');
  const variant = str(flags, 'variant');
  if (!batchId) fail('promote requires --batch <id>');
  if (!variant) fail('promote requires --variant <id>');
  const { batch } = loadState(batchId);
  const candidate = batch.candidates.find((c) => c.variantId === variant);
  if (!candidate) fail(`variant "${variant}" not in batch ${batchId} — candidates: ${batch.candidates.map((c) => c.variantId).join(', ')}`, 2);
  const path = promoteToEvals({ batch, candidate, annotation: str(flags, 'why'), dir: join(REPO_ROOT, EVALS_SNAPSHOTS_DIR) });
  console.log(`\npromoted "${variant}" → ${path}\n`);
}

function printHelp(): void {
  console.log(`rlhf-preview — Discord-native RLHF iteration surface (cycle-008 S9 · hexagonal)

commands:
  preview    generate-N → print to terminal (dry inspection · terminal adapter)
  discord    generate-N → post to test channel + 1-5 reactions (Discord adapter · present)
  collect    read reactions(scores)+replies(whys) → rlhf-preference-v1 (Discord adapter · capture)
  promote    promote a winner → evals/snapshots/<id>.md

snapshot flags (preview + discord):
  --case <id>            ${CANONICAL_CASES.map((c) => c.id).join(' | ')}
  --zone --total-events --active-wallets --delta-pct --window   (if no --case)
  --variants a,b,c | --fire-n N | --voice "header|outro" | --batch <id>

discord/collect:
  --webhook <url>        TEST channel webhook (or RLHF_TEST_WEBHOOK_URL) · NEVER prod community
  --operator <user-id>   attribute reactions to this Discord user (default: any non-bot reactor)
  (DISCORD_BOT_TOKEN from .env · bot must be in the server · Message Content intent ON for replies)

variants: ${allVariants(TEMPLATES_PATH).map((v) => v.id).join(', ')}
registered (code): ${BILLBOARD_VARIANTS.map((v) => v.id).join(', ')}
preference log: ${PREFERENCE_LOG_PATH}
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'help';
  const flags = parseFlags(argv);
  if (flags.help || command === 'help') return printHelp();
  switch (command) {
    case 'preview':
      await cmdPreview(flags);
      break;
    case 'discord':
      await cmdDiscord(flags);
      break;
    case 'collect':
      await cmdCollect(flags);
      break;
    case 'gallery':
      await cmdGallery(flags);
      break;
    case 'promote':
      cmdPromote(flags);
      break;
    default:
      fail(`unknown command "${command}" — one of: preview, discord, collect, gallery, promote (or --help)`);
  }
}

main();
