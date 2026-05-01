/**
 * Smoke test for V0.7-A.0 interactions surface.
 *
 * Boots the HTTP server with a dummy public key + empty character list,
 * hits the public routes, exercises the in-process ledger, and reports.
 *
 * Run via: bun run apps/bot/scripts/smoke-interactions.ts
 *
 * Exit code non-zero on any failure. Suitable for CI smoke-gating.
 */

import {
  appendToLedger,
  getLedgerSnapshot,
  ledgerChannelCount,
  splitForDiscord,
} from '@freeside-characters/persona-engine';
import { startInteractionServer } from '../src/discord-interactions/server.ts';
import { loadCharacters } from '../src/character-loader.ts';
// V0.7-A.1 imagegen substrate scaffold — smoke at the substrate boundary
// rather than through the SDK loop (the LLM-driven invocation is exercised
// end-to-end by the dispatch handler smoke once #2 commands land).
import {
  invokeStability,
  isImagegenConfigured,
} from '@freeside-characters/persona-engine/orchestrator/imagegen';

const PORT = Number(process.env.SMOKE_PORT ?? '34501');
const DUMMY_PUBLIC_KEY = '0'.repeat(64); // 32-byte hex, valid format · won't verify real sigs

async function main(): Promise<void> {
  let failures = 0;
  const fail = (msg: string) => {
    console.error(`✗ ${msg}`);
    failures += 1;
  };
  const ok = (msg: string) => console.log(`✓ ${msg}`);

  console.log('── V0.7-A.0 interactions smoke ──');

  // ── Ledger smoke ──────────────────────────────────────────────────
  appendToLedger('test-channel', {
    role: 'user',
    content: 'hello',
    authorId: 'u1',
    authorUsername: 'eileen',
    timestamp: new Date().toISOString(),
  });
  appendToLedger('test-channel', {
    role: 'character',
    content: 'yo',
    characterId: 'ruggy',
    authorId: 'ruggy',
    authorUsername: 'Ruggy',
    timestamp: new Date().toISOString(),
  });

  const snap = getLedgerSnapshot('test-channel', 10);
  if (snap.length !== 2) fail(`ledger snapshot length expected 2, got ${snap.length}`);
  else ok('ledger append + snapshot · 2 entries');

  // Ring buffer overflow — push 60, expect 50 cap
  for (let i = 0; i < 60; i++) {
    appendToLedger('overflow-channel', {
      role: 'user',
      content: `msg ${i}`,
      authorId: 'u1',
      authorUsername: 'eileen',
      timestamp: new Date().toISOString(),
    });
  }
  const overflow = getLedgerSnapshot('overflow-channel', 100);
  if (overflow.length !== 50) fail(`ring buffer cap broken: expected 50, got ${overflow.length}`);
  else ok('ledger ring buffer cap · 50 entries after 60 pushes');

  if (overflow[0]?.content !== 'msg 10') {
    fail(`drop-oldest broken: first entry should be "msg 10", got "${overflow[0]?.content}"`);
  } else {
    ok('ledger drop-oldest semantics · oldest entry is msg 10');
  }

  if (ledgerChannelCount() < 2) fail(`channel count expected ≥2, got ${ledgerChannelCount()}`);
  else ok(`ledger channel count · ${ledgerChannelCount()}`);

  // ── splitForDiscord smoke ─────────────────────────────────────────
  const short = splitForDiscord('hello world', 2000);
  if (short.length !== 1 || short[0] !== 'hello world') fail('split short content failed');
  else ok('split · short content stays as 1 chunk');

  const longParas = `${'a'.repeat(1500)}\n\n${'b'.repeat(800)}`;
  const longChunks = splitForDiscord(longParas, 2000);
  if (longChunks.length !== 2) fail(`split paragraph break expected 2 chunks, got ${longChunks.length}`);
  else ok('split · paragraph break preserved');

  // ── imagegen MCP scaffold smoke ───────────────────────────────────
  const emptyConfig = {} as Parameters<typeof isImagegenConfigured>[0];
  if (isImagegenConfigured(emptyConfig)) fail('imagegen env gate should be false on empty config');
  else ok('imagegen · env gate false when AWS_REGION + model id unset');

  const wiredConfig = {
    AWS_REGION: 'us-west-2',
    BEDROCK_STABILITY_MODEL_ID: 'stability.stable-image-ultra-v1:0',
    AWS_BEARER_TOKEN_BEDROCK: 'stub',
  } as Parameters<typeof invokeStability>[0];
  if (!isImagegenConfigured(wiredConfig)) fail('imagegen env gate should be true when both env set');
  else ok('imagegen · env gate true when AWS_REGION + model id set');

  const stub = await invokeStability(wiredConfig, { prompt: 'a satoshi at dusk', style: 'cinematic' });
  if (!stub.placeholder) fail('imagegen placeholder body should set placeholder=true');
  if (stub.model !== 'stability.stable-image-ultra-v1:0') fail(`imagegen model echo broken: ${stub.model}`);
  if (!stub.url.startsWith('https://placehold.co/imagegen?')) fail(`imagegen placeholder URL shape broken: ${stub.url}`);
  if (typeof stub.seed !== 'number') fail(`imagegen seed should be number, got ${typeof stub.seed}`);
  ok('imagegen · invokeStability placeholder returns valid GenerateOutput shape');

  // ── HTTP server smoke ─────────────────────────────────────────────
  process.env.DISCORD_PUBLIC_KEY = DUMMY_PUBLIC_KEY;

  // Build a stub Config — only fields the server actually reads at startup.
  // The server doesn't use any zone or LLM config; it just routes requests.
  const stubConfig = {
    LOG_LEVEL: 'info' as const,
  } as Parameters<typeof startInteractionServer>[0]['config'];

  let characters;
  try {
    characters = loadCharacters();
  } catch {
    // No CHARACTERS env / character.json missing in CI · fine for smoke
    characters = [];
  }

  const handle = startInteractionServer({
    config: stubConfig,
    characters,
    port: PORT,
  });
  ok(`server started on :${handle.port}`);

  try {
    // Health probe
    const healthResponse = await fetch(`http://localhost:${PORT}/health`);
    if (!healthResponse.ok) fail(`/health returned ${healthResponse.status}`);
    else {
      const body = (await healthResponse.json()) as { status: string; service: string };
      if (body.status === 'ok' && body.service === 'freeside-characters-interactions') {
        ok('GET /health · 200 ok');
      } else {
        fail(`/health body unexpected: ${JSON.stringify(body)}`);
      }
    }

    // Forged signature should reject
    const forged = await fetch(`http://localhost:${PORT}/webhooks/discord`, {
      method: 'POST',
      headers: {
        'X-Signature-Ed25519': 'aa'.repeat(64),
        'X-Signature-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 1 }),
    });
    if (forged.status !== 401) fail(`forged sig should yield 401, got ${forged.status}`);
    else ok('POST /webhooks/discord · 401 on forged signature');

    // Missing headers should also reject
    const noHeader = await fetch(`http://localhost:${PORT}/webhooks/discord`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (noHeader.status !== 401) fail(`missing-header should yield 401, got ${noHeader.status}`);
    else ok('POST /webhooks/discord · 401 on missing signature headers');

    // 404 for unknown route
    const notfound = await fetch(`http://localhost:${PORT}/nope`);
    if (notfound.status !== 404) fail(`unknown path should yield 404, got ${notfound.status}`);
    else ok('GET /nope · 404');
  } finally {
    handle.stop();
    ok('server stopped');
  }

  console.log('────────────────────────────────');
  if (failures > 0) {
    console.error(`smoke FAILED · ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('smoke PASSED · all checks green');
}

main().catch((err) => {
  console.error('smoke fatal:', err);
  process.exit(1);
});
