/**
 * Smoke: validates that the voice grimoire produces VARIANCE — three
 * fires of the SAME question against the SAME data produce three
 * DISTINCT visual shapes (not three copies of the same template).
 *
 * 2026-05-12 · operator dogfood showed two consecutive `/ruggy` replies
 * in the same channel produced visually identical posts. The grimoire's
 * job: each fire draws a different card → different entry / shape /
 * splash / exit / density → different output.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * NOT FOR CI · MANUAL OPERATOR SMOKE ONLY · 3 real Anthropic API calls
 * per run · uses `temperature: 0` (variance comes from grimoire, not LLM)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Run: bun run apps/bot/scripts/smoke-voice-variance.ts
 */

import { buildReplyPromptPair } from '../../../packages/persona-engine/src/persona/loader.ts';
import {
  sampleVoiceCard,
  renderVoiceCard,
  _resetVoiceCache,
} from '../../../packages/persona-engine/src/voice/sampler.ts';
import {
  pickByMoods,
  shuffle,
} from '../../../packages/persona-engine/src/orchestrator/emojis/registry.ts';
import type { VoiceCard } from '../../../packages/persona-engine/src/voice/grimoire.ts';

const character = {
  id: 'ruggy' as const,
  displayName: 'ruggy',
  personaPath: './apps/character-ruggy/persona.md',
  mcps: ['score', 'codex', 'emojis', 'rosenzu', 'freeside_auth'] as string[],
};

const userPrompt = 'anything happening onchain boss?';

const syntheticData = `
[SYNTHETIC raw_stats for owsley-lab · same data each fire — variance must
 come from the grimoire, not the data]

zone: owsley-lab · dimension: Onchain · 7-day window
total_events: 247 · unique_actors: 38 · baseline_4w_avg: 62 events

factor_trends:
  - Paddle Borrower · 29 events vs ~7 baseline · 4.14× · 11 actors

top_movers (climbs):
  - 0xdc1c0a8b88a9c91f5d7a4e92c5e8b1d34c896e5a · 0xdc1c...6e5a
    #11294 → #3528 · on Paddle Borrower
  - cluster of 10+ wallets each picked up exactly +4668 onchain rank
    (lockstep · suggests batched move)

top_movers (drops):
  - 0xc673a44b8d1e9f2a3b6c4d5e7f8a9b0c1d2e2501 · 0xc673...2501
    rank delta -10247 · shed 10k positions

[SYNTHETIC mcp__freeside_auth__resolve_wallets result:]
  0xdc1c...6e5a → { found: true, discord_username: "nomadbera", handle: "Nomad Bera" }
  0xc673...2501 → { found: true, discord_username: "gumi", handle: "gumi" }
`.trim();

function pickWitness(card: Omit<VoiceCard, 'witness'>): string | null {
  if (card.exit !== 'custom_emoji') return null;
  let moods: string[];
  if (card.bullet_palette.includes('🚨')) moods = ['shocked', 'flex'];
  else if (card.density === 'fragment' || card.splash === 'sparse') moods = ['cool', 'dazed'];
  else if (card.splash === 'lush') moods = ['celebrate', 'cute', 'love'];
  else moods = ['cool', 'cute'];
  const candidates = pickByMoods(moods as never, 'ruggy');
  if (candidates.length === 0) return null;
  return shuffle(candidates)[0]?.name ?? null;
}

async function ask(seed: string, channelId: string): Promise<{ card: VoiceCard; text: string }> {
  const card = sampleVoiceCard({ seed, channelId, witnessPicker: pickWitness });
  const grimoire = renderVoiceCard(card);

  const { systemPrompt, userMessage } = buildReplyPromptPair({
    character,
    prompt: userPrompt,
    authorUsername: 'soju',
    history: [],
    voiceGrimoire: grimoire,
  });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: `${userMessage}\n\n${syntheticData}` }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
  const response: { content: Array<{ type: string; text?: string }> } = await r.json();
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text!).join('\n');
  return { card, text };
}

async function main() {
  _resetVoiceCache(); // start fresh
  console.log('━'.repeat(72));
  console.log('smoke: voice grimoire produces 3 distinct shapes for the same question');
  console.log('━'.repeat(72));

  const channelId = 'smoke-variance-channel';
  // Three seeded fires · we use fixed seeds so the test is reproducible.
  // In production the seed is `${channelId}:${authorId}:${Date.now()}` so each
  // fire gets a fresh draw organically.
  const fires = [
    { seed: 'variance-fire-1', label: 'fire 1' },
    { seed: 'variance-fire-2', label: 'fire 2' },
    { seed: 'variance-fire-3', label: 'fire 3' },
  ];

  const results: Array<{ card: VoiceCard; text: string; label: string }> = [];
  for (const f of fires) {
    console.log('');
    console.log(`▸ ${f.label} · seed=${f.seed}`);
    const { card, text } = await ask(f.seed, channelId);
    console.log(`  card · entry=${card.entry} shape=${card.shape} splash=${card.splash} density=${card.density} exit=${card.exit} palette=[${card.bullet_palette.join(' ')}] witness=${card.witness ?? 'none'}`);
    console.log('  ────');
    text.split('\n').forEach((l) => console.log('  ' + l));
    console.log('  ────');
    results.push({ ...{ card, text }, label: f.label });
  }

  // ─── variance assertions ────────────────────────────────────────────
  console.log('');
  console.log('━'.repeat(72));
  console.log('variance checks:');

  const distinctEntries = new Set(results.map((r) => r.card.entry)).size;
  const distinctShapes = new Set(results.map((r) => r.card.shape)).size;
  const distinctTexts = new Set(results.map((r) => r.text)).size;

  // Crude visual-shape signature for cross-text comparison.
  function sig(text: string): string {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const hasBlockquote = lines.some((l) => l.startsWith('>'));
    const bulletCount = lines.filter((l) => /^(🚨|🪩|🟢|🌊|👀|🌫)/.test(l)).length;
    const startsWith = lines[0]?.slice(0, 10).toLowerCase() ?? '';
    return `bq=${hasBlockquote ? 'y' : 'n'}·bullets=${bulletCount}·start="${startsWith}"`;
  }
  const sigs = results.map((r) => sig(r.text));
  const distinctSigs = new Set(sigs).size;

  console.log(`  cards: ${distinctEntries} distinct entries · ${distinctShapes} distinct shapes (across 3 fires)`);
  console.log(`  texts: ${distinctTexts}/3 unique · ${distinctSigs}/3 distinct shape-signatures`);
  console.log(`  signatures: ${sigs.join(' | ')}`);

  const checks = {
    'cards: at least 2 distinct entries across 3 fires': distinctEntries >= 2,
    'cards: at least 2 distinct shapes across 3 fires': distinctShapes >= 2,
    'output: 3/3 unique texts': distinctTexts === 3,
    'output: at least 2 distinct shape signatures': distinctSigs >= 2,
  };
  for (const [label, pass] of Object.entries(checks)) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  }
  const failures = Object.values(checks).filter((p) => !p).length;
  console.log('');
  console.log(failures === 0
    ? '✅ grimoire produces real variance · same data, same question, 3 distinct posts'
    : `⚠️  ${failures} check(s) failed — variance is collapsing`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke error:', err);
  process.exit(2);
});
