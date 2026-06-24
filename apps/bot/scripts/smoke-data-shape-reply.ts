/**
 * Smoke: validates that ruggy's chat-mode reply applies the new
 * "DATA-SHAPED QUESTIONS" visual shape (blockquote scanline + emoji-handle
 * bullets) when the user asks an analytics question.
 *
 * 2026-05-12 · operator goal: analytics-as-storytelling, not number-soup.
 * Mirrors the screenshot scenario: `/ruggy anything happening onchain boss?`
 * with the same data the production reply had (Paddle Borrower 4x baseline,
 * 0xdc1c..6e5a +7766 climb, 0xc673..2501 -10k unwind, cluster +4668).
 *
 * The SDK-runtime MCP loop is bypassed — we inline synthetic raw_stats
 * into the user-half message. The point is to confirm the SHAPE the
 * persona prompt produces, not the data-fetching pipeline (which is
 * unchanged).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * NOT FOR CI · MANUAL OPERATOR SMOKE ONLY
 *
 * - Makes real Anthropic API calls (costs tokens · ~3-5k per run)
 * - Uses `temperature: 0` for determinism · but LLM output can still
 *   shift subtly across runs / model versions
 * - Run via `bun run apps/bot/scripts/smoke-data-shape-reply.ts`
 * - Do NOT wire into automated test runs · BB review F4 / cycle-2
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Requires: ANTHROPIC_API_KEY (already in env per .env.local)
 */

import { buildReplyPromptPair } from '../../../packages/persona-engine/src/persona/loader.ts';

const character = {
  id: 'ruggy' as const,
  displayName: 'ruggy',
  personaPath: './apps/character-ruggy/persona.md',
  mcps: ['score', 'codex', 'emojis', 'rosenzu', 'freeside_auth'] as string[],
};

const userPrompt = 'anything happening onchain boss?';

const syntheticRawStats = `
[SYNTHETIC raw_stats for owsley-lab · standing in for what mcp__score__get_zone_digest
 would return — voice prompt unchanged · this is just the data context the LLM
 normally pulls via the tool. Window: last 7 days · 2026-05-05 → 2026-05-12]

zone: owsley-lab
dimension: Onchain
total_events: 247
unique_actors: 38
baseline_4w_avg: 62 events

factor_trends:
  - factor: paddle_borrower
    factor_proper: Paddle Borrower
    events_this_window: 29
    baseline_avg: 7
    multiplier: 4.14
    unique_actors: 11

top_movers (rank_climbs):
  - wallet: 0xdc1c0a8b88a9c91f5d7a4e92c5e8b1d34c896e5a
    short: 0xdc1c...6e5a
    handle: null  (no midi_profiles link)
    rank_from: 11294
    rank_to: 3528
    delta: +7766
    factors_active: [paddle_borrower]
  - cluster: 10+ wallets each picked up exactly +4668 onchain rank
    note: lockstep movement · same delta · suggests batched move
    factor: paddle_borrower

top_movers (rank_drops):
  - wallet: 0xc673a44b8d1e9f2a3b6c4d5e7f8a9b0c1d2e2501
    short: 0xc673...2501
    handle: null
    rank_delta: -10247
    note: shed 10k positions
`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — smoke cannot run');
    process.exit(1);
  }

  const { systemPrompt, userMessage } = buildReplyPromptPair({
    character,
    prompt: userPrompt,
    authorUsername: 'soju',
    history: [],
  });

  const enrichedUserMessage = `${userMessage}\n\n${syntheticRawStats}`;

  console.log('━'.repeat(70));
  console.log('smoke: data-shaped reply · ruggy · "anything happening onchain boss?"');
  console.log('━'.repeat(70));
  console.log('system prompt length:', systemPrompt.length, 'chars');
  console.log('user message length:', enrichedUserMessage.length, 'chars');
  console.log('persona reply fragment includes DATA-SHAPED rule:',
    systemPrompt.includes('DATA-SHAPED QUESTIONS') ? '✓' : '✗');
  console.log('persona reply fragment includes blockquote example:',
    systemPrompt.includes('Paddle Borrower · 4× baseline (29 vs ~7)') ? '✓' : '✗');
  console.log('');
  console.log('calling claude-sonnet-4-5 (cheaper than opus for shape validation)…');
  console.log('');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: enrichedUserMessage }],
    }),
  });
  if (!r.ok) {
    console.error('API error:', r.status, await r.text());
    process.exit(1);
  }
  const response: { content: Array<{ type: string; text?: string }> } = await r.json();
  const text = response.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n');

  console.log('━'.repeat(70));
  console.log("ruggy's reply:");
  console.log('━'.repeat(70));
  console.log(text);
  console.log('━'.repeat(70));
  console.log('');

  const bannedHype = ['🚀', '💯', '🎉', '🔥', '💎', '🤑', '🙌', '💪', '⚡️', '✨', '🌟'];
  const codeBlocks = (text.match(/```[\s\S]*?```/g) ?? [])
    .flatMap((b) => b.split('\n').slice(1, -1));
  const checks = {
    'has blockquote (> ...)': /^>\s/m.test(text),
    'has emoji-handle bullet (🪩 | 🌊 | 👀 | 🚨 | 🟢)': /^(🪩|🌊|👀|🚨|🟢)\s/m.test(text),
    'addresses in backticks': /`0x[a-f0-9.]+`/.test(text),
    'mentions paddle borrower': /paddle borrower/i.test(text),
    'multi-block structure (>=3 paragraphs)': text.split('\n\n').length >= 3,
    'code blocks ≤40 chars/line (mobile wrap)': codeBlocks.every((l) => l.length <= 40),
    'voice: no analyst register ("Notable" "Activity")':
      !/\b(We're pleased|Notable:|Activity volume|exceptional growth)\b/.test(text),
    'no banned hype emoji (🚀💯🎉🔥💎...)': bannedHype.every((e) => !text.includes(e)),
    'no punitive coding (🔴 / slid / fell / tumbled)':
      !text.includes('🔴') && !/\b(slid|fell|tumbled)\b/i.test(text),
  };

  console.log('shape validation:');
  for (const [label, pass] of Object.entries(checks)) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  }

  const failures = Object.values(checks).filter((p) => !p).length;
  console.log('');
  console.log(failures === 0
    ? '✅ shape lands: blockquote scanline + emoji handles + story-thread'
    : `⚠️  ${failures} check(s) failed — iterate on persona prompt`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke error:', err);
  process.exit(2);
});
