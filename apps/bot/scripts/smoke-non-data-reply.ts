/**
 * Smoke: negative case for the DATA-SHAPED QUESTIONS rule.
 *
 * Confirms that NON-data-shaped questions still get the 1-3 paragraph
 * conversational default, NOT the blockquote+emoji-bullet visual shape.
 * The rule should only activate when the question is analytics-shaped.
 *
 * Run: bun run apps/bot/scripts/smoke-non-data-reply.ts
 */

import { buildReplyPromptPair } from '../../../packages/persona-engine/src/persona/loader.ts';

const character = {
  id: 'ruggy' as const,
  displayName: 'ruggy',
  personaPath: './apps/character-ruggy/persona.md',
  mcps: ['score', 'codex', 'emojis', 'rosenzu', 'freeside_auth'] as string[],
};

const cases = [
  { prompt: 'how you doin today bear?', label: 'vibes / casual chat' },
  { prompt: 'tell me about freetekno', label: 'lore / archetype question' },
  { prompt: 'what do you think about the new mibera drop', label: 'opinion / character' },
];

async function ask(prompt: string): Promise<string> {
  const { systemPrompt, userMessage } = buildReplyPromptPair({
    character,
    prompt,
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
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
  const response: { content: Array<{ type: string; text?: string }> } = await r.json();
  return response.content.filter((b) => b.type === 'text').map((b) => b.text!).join('\n');
}

async function main() {
  console.log('━'.repeat(70));
  console.log('smoke: NON-data-shaped replies should stay conversational');
  console.log('━'.repeat(70));
  let failures = 0;

  for (const c of cases) {
    console.log('');
    console.log(`▸ "${c.prompt}"  [${c.label}]`);
    const text = await ask(c.prompt);
    console.log('  ────────');
    text.split('\n').forEach((l) => console.log('  ' + l));
    console.log('  ────────');

    const isAnalyticsShaped = /^>\s/m.test(text) && /^(🪩|🌊|👀|🚨|🟢)\s/m.test(text);
    if (isAnalyticsShaped) {
      console.log('  ✗ FAILED: applied analytics shape to non-data question');
      failures++;
    } else {
      console.log('  ✓ stayed conversational (no blockquote + emoji-handle scaffold)');
    }
  }

  console.log('');
  console.log(failures === 0
    ? '✅ heuristic works: data-shape only activates for analytics questions'
    : `⚠️  ${failures} false-positive(s) — the rule is too aggressive`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke error:', err);
  process.exit(2);
});
