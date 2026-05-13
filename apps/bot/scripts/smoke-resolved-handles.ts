/**
 * Smoke: validates that ruggy uses @handles when resolve_wallets returns
 * names, and uses not-in-MiDi framings ("fresh hand" / "off the map") when
 * the resolver returns null.
 *
 * 2026-05-12 · operator goal #2: fix the handle-resolution gap that
 * surfaced in the screenshot's wall-of-prose output.
 *
 * Runs two scenarios — same question, different synthetic resolve_wallets
 * results — and checks the right vocabulary lands.
 *
 * Run: bun run apps/bot/scripts/smoke-resolved-handles.ts
 */

import { buildReplyPromptPair } from '../../../packages/persona-engine/src/persona/loader.ts';

const character = {
  id: 'ruggy' as const,
  displayName: 'ruggy',
  personaPath: './apps/character-ruggy/persona.md',
  mcps: ['score', 'codex', 'emojis', 'rosenzu', 'freeside_auth'] as string[],
};

const userPrompt = 'anything happening onchain boss?';

const sharedStatsHeader = `
[SYNTHETIC raw_stats for owsley-lab · window 2026-05-05 → 2026-05-12]
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
    rank_from: 11294
    rank_to: 3528
    factors_active: [paddle_borrower]
  - cluster: 10+ wallets each +4668 onchain rank · lockstep · batched

top_movers (rank_drops):
  - wallet: 0xc673a44b8d1e9f2a3b6c4d5e7f8a9b0c1d2e2501
    short: 0xc673...2501
    rank_delta: -10247
    note: shed 10k positions
`.trim();

const resolveResolved = `
[SYNTHETIC mcp__freeside_auth__resolve_wallets result for the two spotlight wallets:]
{
  "0xdc1c0a8b88a9c91f5d7a4e92c5e8b1d34c896e5a": {
    "found": true,
    "discord_username": "nomadbera",
    "handle": "Nomad Bera",
    "mibera_id": "miber-4827"
  },
  "0xc673a44b8d1e9f2a3b6c4d5e7f8a9b0c1d2e2501": {
    "found": true,
    "discord_username": "gumi",
    "handle": "gumi",
    "mibera_id": "miber-0011"
  }
}
`.trim();

const resolveNull = `
[SYNTHETIC mcp__freeside_auth__resolve_wallets result for the two spotlight wallets:]
{
  "0xdc1c0a8b88a9c91f5d7a4e92c5e8b1d34c896e5a": {
    "found": false,
    "fallback": "0xdc1c...6e5a"
  },
  "0xc673a44b8d1e9f2a3b6c4d5e7f8a9b0c1d2e2501": {
    "found": false,
    "fallback": "0xc673...2501"
  }
}
`.trim();

async function ask(userMessage: string, label: string): Promise<string> {
  const { systemPrompt, userMessage: base } = buildReplyPromptPair({
    character,
    prompt: userPrompt,
    authorUsername: 'soju',
    history: [],
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
      system: systemPrompt,
      messages: [{ role: 'user', content: `${base}\n\n${userMessage}` }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status} (${label}): ${await r.text()}`);
  const response: { content: Array<{ type: string; text?: string }> } = await r.json();
  return response.content.filter((b) => b.type === 'text').map((b) => b.text!).join('\n');
}

async function main() {
  console.log('━'.repeat(70));
  console.log('smoke: resolve_wallets → handles vs not-in-MiDi framings');
  console.log('━'.repeat(70));

  // ─── Scenario A: resolved handles ─────────────────────────────────────
  console.log('');
  console.log('▸ SCENARIO A · resolve_wallets returned discord_usernames');
  const textA = await ask(`${sharedStatsHeader}\n\n${resolveResolved}`, 'resolved');
  console.log('─────');
  textA.split('\n').forEach((l) => console.log('  ' + l));
  console.log('─────');

  const checksA = {
    'uses @nomadbera in prose or bullets': /@nomadbera/i.test(textA),
    'uses @gumi in prose or bullets': /@gumi/i.test(textA),
    'does NOT lead a bullet with raw 0xdc1c...': !/^🪩\s*`0xdc1c/m.test(textA),
    'does NOT lead a bullet with raw 0xc673...': !/^🌊\s*`0xc673/m.test(textA),
    'still has blockquote scanline': /^>\s/m.test(textA),
    'still has emoji-handle bullets': /^(🪩|🌊|👀|🚨|🟢)\s/m.test(textA),
  };
  for (const [label, pass] of Object.entries(checksA)) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  }
  const failuresA = Object.values(checksA).filter((p) => !p).length;

  // ─── Scenario B: zero resolution ──────────────────────────────────────
  console.log('');
  console.log('▸ SCENARIO B · resolve_wallets returned found:false for both');
  const textB = await ask(`${sharedStatsHeader}\n\n${resolveNull}`, 'unresolved');
  console.log('─────');
  textB.split('\n').forEach((l) => console.log('  ' + l));
  console.log('─────');

  const hasFraming = /\b(fresh hand|not in MiDi|off the map)\b/i.test(textB);
  const checksB = {
    'uses ONE not-in-MiDi framing (fresh hand / not in MiDi / off the map)':
      hasFraming,
    'addresses kept on bullet line (forensic anchor)': /`0x(dc1c|c673)/.test(textB),
    'still has blockquote scanline': /^>\s/m.test(textB),
    'still has emoji-handle bullets': /^(🪩|🌊|👀|🚨|🟢)\s/m.test(textB),
    'does NOT fabricate a handle': !/@[a-z][a-z0-9_]+/i.test(textB) ||
      // allow @-mention if it's NOT a wallet-derived handle (highly unlikely
      // given the synthetic data has no usernames anywhere)
      false,
  };
  for (const [label, pass] of Object.entries(checksB)) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  }
  const failuresB = Object.values(checksB).filter((p) => !p).length;

  console.log('');
  const totalFail = failuresA + failuresB;
  console.log(totalFail === 0
    ? '✅ resolve_wallets consumer-side rule works in both modes'
    : `⚠️  ${totalFail} check(s) failed across both scenarios`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke error:', err);
  process.exit(2);
});
