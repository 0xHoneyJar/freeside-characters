#!/usr/bin/env bun
/**
 * smoke-mint-announce.ts — offline visual smoke for the shadow-mint announcement.
 *
 * Drives ONE synthetic Mibera Shadow (MST) mint through the real DEP-2 pipeline
 * — announceMint() -> enrichment fail-soft -> buildEnrichedMintAnnouncement ->
 * captured Discord send — and PRINTS the Components-V2 payload + plain-text
 * fallback to stdout. No NATS, no JWKS, no live creds: every external surface
 * is supplied via announceMint's public test seams (metadataFetchFn, fetchFn,
 * discordWebhookSendFn).
 *
 * Why this exists: the go-live brief (cluster-events-pillar-v1, 2026-05-28)
 * flagged that there was NO standalone way to eyeball a rendered mint
 * announcement before wiring Railway. This closes that gap for repeatable
 * voice/format iteration — the FEEL surface for the canary.
 *
 * It renders BOTH variants so the contrast is visible in one run:
 *   1. ENRICHED  — nym + image + traits (the TARGET state once inventory-api
 *      is deployed and inventoryApiBaseUrl is configured; see brief §3 Gap #3).
 *   2. FAIL-SOFT — shortAddress + NO image + NO traits (what the canary posts
 *      when inventoryApiBaseUrl is unset / inventory-api is unreachable).
 *
 * Read-only. Additive dev harness (mirrors apps/bot/scripts/verify-score-events.ts).
 *
 * Run:        bun run apps/bot/scripts/smoke-mint-announce.ts
 * Token id:   bun run apps/bot/scripts/smoke-mint-announce.ts 1337
 * One variant: SMOKE_VARIANT=enriched|failsoft bun run apps/bot/scripts/smoke-mint-announce.ts
 */

import {
  announceMint,
  type DiscordMessagePayload,
} from '@freeside-characters/persona-engine/events/announce-mint';
import type { MintEventSubscriberLogger } from '@freeside-characters/persona-engine/events/mint-event-subscriber';

// Mibera Shadow (MST) canonical contract — matches announce-mint.ts MST_CONTRACT.
const MST_CONTRACT = '0x048327a187b944ddac61c6e202bfccd20d17c008';

// Structural shape of the events package's NftMintDetected (type-only import in
// the lib is erased at runtime, so we build the object structurally here to keep
// the harness independent of the @0xhoneyjar/events dist being present).
interface SyntheticMint {
  chain_id: number;
  contract: string;
  token_id: string;
  minter: string;
  block_number: number;
  transaction_hash: string;
  timestamp: string;
}

const tokenId = (process.argv[2] ?? '234').replace(/[^\d]/g, '') || '234';
const variantFilter = process.env.SMOKE_VARIANT?.trim().toLowerCase();

const PAYLOAD: SyntheticMint = {
  chain_id: 80094, // Berachain mainnet
  contract: MST_CONTRACT,
  token_id: tokenId,
  minter: '0x000000000000000000000000000000000000abcd',
  block_number: 12_345_678,
  transaction_hash: '0x' + 'ab'.repeat(32),
  timestamp: '2026-05-28T18:30:00Z',
};

// Quiet logger — the harness prints its own structured output. Flip VERBOSE=1 to
// see the lib's fail-soft warnings (useful when debugging enrichment timeouts).
const verbose = process.env.VERBOSE === '1';
const logger: MintEventSubscriberLogger = {
  info: (obj, msg) => verbose && console.error('  · info', msg ?? '', obj),
  warn: (obj, msg) => verbose && console.error('  · warn', msg ?? '', obj),
  error: (obj, msg) => console.error('  · error', msg ?? '', obj),
};

/** identity-api stub. nym!=null → enriched display; null → simulate the live 400 (fail-soft to shortAddress). */
function makeIdentityFetch(nym: string | null): typeof fetch {
  return (async () => {
    if (nym == null) {
      return new Response('phase-2-not-built', { status: 400 });
    }
    return new Response(
      JSON.stringify({ identity: { world_identities: [{ world_slug: 'mibera', nym }] } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

/**
 * inventory-api stub — fakes the HTTP route GET /nfts/{contract}/{tokenId}.
 * inventory-api is a deployed Hyper service consumed over the wire; this stub
 * stands in for it so the smoke runs fully offline (no network, no deploy).
 *   withImage=true  → 200 with a representative MST metadata document.
 *   withImage=false → 404 (unknown token) → client fail-softs to no image.
 */
function makeInventoryFetch(withImage: boolean): typeof fetch {
  return (async (url: string | URL) => {
    if (!withImage) {
      return new Response(JSON.stringify({ error: { status: 404, message: 'not found' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    // tokenId is the last path segment of /nfts/{contract}/{tokenId}
    const tid = String(url).split('/').pop() ?? tokenId;
    return new Response(
      JSON.stringify({
        name: `Mibera Shadow #${tid}`,
        description: 'a shadow',
        // representative MST asset URL shape (metadata.0xhoneyjar.xyz per recon).
        image: `https://metadata.0xhoneyjar.xyz/mibera-shadow/${tid}.png`,
        attributes: [
          { trait_type: 'Element', value: 'Shadow' },
          { trait_type: 'Archetype', value: 'Wanderer' },
          { trait_type: 'Era', value: 'Owsley' },
          { trait_type: 'Swag', value: 'A' },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

async function renderVariant(
  label: string,
  desc: string,
  opts: { nym: string | null; withImage: boolean },
): Promise<void> {
  const captured: DiscordMessagePayload[] = [];
  const result = await announceMint({
    payload: PAYLOAD as never, // structural match to NftMintDetected
    identityApiBaseUrl: 'https://identity.0xhoneyjar.xyz',
    inventoryApiBaseUrl: 'https://inventory.0xhoneyjar.xyz',
    discordWebhookSendFn: async (msg) => {
      captured.push(msg);
    },
    channelId: 'C_SMOKE_TEST',
    logger,
    fetchFn: makeIdentityFetch(opts.nym),
    metadataFetchFn: makeInventoryFetch(opts.withImage),
  });

  console.log(`\n${'━'.repeat(72)}`);
  console.log(`  ${label}`);
  console.log(`  ${desc}`);
  console.log('━'.repeat(72));
  console.log(`  posted=${result.posted}${result.reason ? ` reason=${result.reason}` : ''}`);

  const msg = captured[0];
  if (!msg) {
    console.log('  (no payload captured)');
    return;
  }
  console.log('\n  ── plain-text fallback (embeds-disabled clients) ──');
  console.log(
    (msg.contentFallback ?? '(none)')
      .split('\n')
      .map((l) => `  │ ${l}`)
      .join('\n'),
  );
  console.log('\n  ── Components V2 payload (IS_COMPONENTS_V2 flag) ──');
  console.log(
    JSON.stringify(msg.components, null, 2)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
  );
}

async function main(): Promise<void> {
  console.log(`\n🌒 shadow-mint announcement smoke · MST #${tokenId} · Berachain`);
  console.log('   (offline — all enrichment via announceMint test seams, no NATS/JWKS/network)');

  const variants: Array<[string, string, { nym: string | null; withImage: boolean }]> = [
    [
      '1 · ENRICHED  (target state — once inventory-api is deployed + configured, brief §3)',
      'nym + image (full-bleed MediaGallery) + traits',
      { nym: 'velvetfang', withImage: true },
    ],
    [
      '2 · FAIL-SOFT (what the canary posts when inventoryApiBaseUrl is unset / unreachable)',
      'shortAddress + NO image + NO traits',
      { nym: null, withImage: false },
    ],
  ];

  for (const [label, desc, opts] of variants) {
    if (variantFilter === 'enriched' && !label.startsWith('1')) continue;
    if (variantFilter === 'failsoft' && !label.startsWith('2')) continue;
    await renderVariant(label, desc, opts);
  }

  console.log(`\n${'━'.repeat(72)}`);
  console.log('  what this proves: the DEP-2 render + fail-soft contract is sound.');
  console.log('  what it does NOT prove: live image resolution (blocked — see brief Gap #3),');
  console.log('  signature verification (Gap #1 JWKS), or sonar emission (Gap #2).');
  console.log('━'.repeat(72) + '\n');
}

main().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
