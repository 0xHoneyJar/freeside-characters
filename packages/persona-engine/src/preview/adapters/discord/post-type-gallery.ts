// cycle-008 S9 (g30) · the whole-medium gallery — every post type in Components V2.
//
// Operator (2026-05-23): "run through all of the other post types too in order to experiment.
// I want to see what's possible for our entire medium." Components V2 won the billboard
// (5/5); this shows its range across the persona's communication shapes (per post-types.ts):
//   digest    structured data billboard (the winner)
//   micro     casual drop-in · voice-forward, minimal data
//   weaver    cross-zone connection · multi-zone sections
//   lore_drop codex-anchored card
//   question  open invitation · a Section with a button accessory (interactivity)
//   callout   anomaly alert · red accent
//   pop-in    single notable on-chain event · spotlight card
// Layouts use the canonical owsley case + representative content; voice stays lowercase +
// stats-out-of-voice per ruggy doctrine.

import type { DigestSnapshot } from '../../../domain/digest-snapshot.ts';
import type { ZoneId } from '../../../score/index.ts';
import { ZONE_REGISTRY } from '../../../domain/zone-registry.ts';
import { buildBillboardComponentsV2, dimDisplay } from './rich-render.ts';
import { stripEmDashes } from '../../core/billboard-surface.ts';
import { RUGGY_AVATAR_URL } from './present.ts';
import { buildEnrichedMintAnnouncement } from '../../../events/mint-announcement-render.ts';
import { buildVerifyCard } from '../../../onboarding/verify-card.ts';

// Components V2 type ids
const TEXT = 10;
const CONTAINER = 17;
const SEPARATOR = 14;
const SECTION = 9;
const THUMBNAIL = 11;

const COLOR = { red: 0xed4245, purple: 0x6f4ea1, gold: 0xc9a44c, blurple: 0x5865f2, gray: 0x808890 };

const text = (content: string) => ({ type: TEXT, content: stripEmDashes(content) });
const sep = { type: SEPARATOR };
const container = (accent: number, components: unknown[]) => [{ type: CONTAINER, accent_color: accent, components }];
const sub = (s: DigestSnapshot) => `-# ${ZONE_REGISTRY[s.zone].displayName} · ${dimDisplay(s.dimension)}`;

/** digest — the data billboard (the 5/5 winner). */
export const galleryDigest = (s: DigestSnapshot): unknown[] => buildBillboardComponentsV2(s);

/** micro — casual drop-in: ruggy's VOICE (operator round-3: "let ruggy read it in his voice,
 *  no components, clean styling + emojis"). Plain text message, natural, lowercase. */
export function galleryMicroVoice(s: DigestSnapshot): string {
  const r = ZONE_REGISTRY[s.zone];
  // one emoji, natural short sentences. NB: in prod this should be LLM-generated in ruggy's
  // voice off a real interesting event (sonar-api hook → trigger), not a static line.
  return `${r.emoji} the lab's stirring this morning. a few fresh traces since dawn, nothing loud yet.`;
}

/** weaver — cross-zone view, reframed as STONEHENGE the hub (operator round-3: "weaving the
 *  zones" was too construct-referential; resonate with stonehenge). Each location carries its
 *  mover left-to-right, like the enriched layout. */
export function galleryWeaver(s: DigestSnapshot): unknown[] {
  const hub = ZONE_REGISTRY['stonehenge'];
  // descriptive with numbers (operator round-4): each location carries events + delta L→R.
  const lines: Array<readonly [ZoneId, number, number]> = [
    ['bear-cave', 240, 12],
    ['el-dorado', 58, -3],
    ['owsley-lab', 352, -13],
  ];
  return container(COLOR.gray, [
    text(`## ${hub.emoji} ${hub.displayName}\n-# the whole field, this week`),
    sep,
    ...lines.map(([z, events, delta]) => {
      const arrow = delta > 0 ? '↑' : '↓';
      return text(`${ZONE_REGISTRY[z].emoji} **${ZONE_REGISTRY[z].displayName}**   ${events} events   ${arrow}${Math.abs(delta)}%`);
    }),
  ]);
}

/** lore_drop — codex-anchored card. */
export function galleryLore(s: DigestSnapshot): unknown[] {
  return container(COLOR.gold, [
    text('## 📖 from the codex'),
    text('> the owsley strain runs hottest when the chain forgets to sleep.'),
    text(sub(s)),
  ]);
}

/** question — open invitation as a Section (text + thumbnail accessory · the side-media shape).
 *  NB: interactive (custom_id) buttons need an application, not a plain webhook — so the gallery
 *  demonstrates the Section layout with a thumbnail accessory; real buttons ride the bot path. */
export function galleryQuestion(s: DigestSnapshot): unknown[] {
  const r = ZONE_REGISTRY[s.zone];
  return container(COLOR.blurple, [
    text("## what's your read?"),
    {
      type: SECTION,
      components: [text(`${r.emoji} owsley's cooling. a breather, or is the tide going out?`)],
      accessory: { type: THUMBNAIL, media: { url: RUGGY_AVATAR_URL } },
    },
  ]);
}

/** callout — anomaly alert (red accent). */
export function galleryCallout(s: DigestSnapshot): unknown[] {
  return container(COLOR.red, [
    text('## 🚨 anomaly'),
    text('a single wallet drove most of the lab’s volume in one window.'),
    text(sub(s)),
  ]);
}

/** pop-in — single notable on-chain event, spotlit. */
export function gallerySpotlight(s: DigestSnapshot): unknown[] {
  return container(COLOR.purple, [
    text('## ⚡ spotlight'),
    text('`0xAB…cd` minted 3 mibera in a single tx.'),
    text(`${sub(s)} · just now`),
  ]);
}

/**
 * enriched — the ceiling. Grounded in ruggy's PURPOSE (narrate on-chain activity) + the
 * agent's actual TOOLS: score-mcp gives `rank_changes` (movers), `spotlight` (a notable
 * event), `most_active_wallets`; freeside_auth resolves wallet→handle; codex gives lore.
 * This stitches them into one Components V2 dashboard — header + hero + a MOVERS section + a
 * SPOTLIGHT section (with a thumbnail) + a wallets footer. (Data here is representative; the
 * real values flow when this is wired to the score-mcp tool calls on the production path.)
 */
export function galleryEnriched(s: DigestSnapshot): unknown[] {
  const r = ZONE_REGISTRY[s.zone];
  const deltaLine =
    s.deltaPct !== null && Math.abs(s.deltaPct) >= 1
      ? `${s.deltaPct > 0 ? '↑' : '↓'}${Math.abs(Math.round(s.deltaPct))}% vs prior ${s.windowDays}d`
      : 'steady';
  return container(COLOR.purple, [
    text(`## ${r.emoji} ${r.displayName}\n-# ${dimDisplay(s.dimension)}`),
    text(`# ${s.totalEvents}\nevents · last ${s.windowDays} days`),
    sep,
    text('### movers'),
    text('↑ **Liquid Backing**   ·   ↓ Cold Storage   ·   ↑ Mibera Quality'),
    sep,
    {
      type: SECTION,
      components: [text('### ⚡ spotlight\n`@degenharu` minted 3 mibera in one tx')],
      accessory: { type: THUMBNAIL, media: { url: RUGGY_AVATAR_URL } },
    },
    sep,
    text(`-# ${s.activeWallets ?? 0} wallets warm   ·   ${deltaLine}`),
  ]);
}

/** mint — the LIVE shadow-mint announcement, via the REAL `buildEnrichedMintAnnouncement`
 *  renderer (events/mint-announcement-render.ts). This production surface had NO viewing path
 *  until now (the prior 'pop-in' item was a spotlight stand-in, not the real mint card). Fixture
 *  = an enriched Mibera Shadow mint (nym + image + traits); the fail-soft prod variant ships the
 *  same Container minus the image/traits blocks. Ignores `s` — mints aren't zone-digest-shaped. */
export function galleryMint(_s: DigestSnapshot): unknown[] {
  const rendered = buildEnrichedMintAnnouncement({
    displayName: 'velvetfang',
    collection: 'Mibera Shadow',
    tokenId: '234',
    // stand-in image (resolvable) so the gallery renders the Thumbnail slot, not a broken
    // 404 — the real mibera-shadow image resolves via inventory-api (blocked, inventory-api#8).
    imageUrl: RUGGY_AVATAR_URL,
    traits: [
      { trait_type: 'Element', value: 'Shadow' },
      { trait_type: 'Archetype', value: 'Wanderer' },
      { trait_type: 'Era', value: 'Owsley' },
      { trait_type: 'Swag', value: 'A' },
    ],
    txHash: '0x' + 'ab'.repeat(32),
    chainId: 80094,
    emittedAt: '2026-05-29T12:00:00Z',
  });
  return rendered.components as unknown[];
}

/** verify — the onboarding verify card (C1 · cycle-009). A Container with a custom_id button
 *  (NOT a URL button) — the click is a MESSAGE_COMPONENT the bot receives + binds to the
 *  clicker's discord_id (C2 dispatch). Shown in the gallery so the onboarding surface is viewable
 *  alongside the scheduled/chat shapes. Ignores `s` — onboarding isn't zone-digest-shaped.
 *
 *  DB-0 (arrakis-ojm0): this PREVIEW item intentionally stays on code-constant defaults
 *  (buildVerifyCard() → {}). The gallery is an RLHF/experiment surface, not the live onboarding
 *  post — wiring a per-world DB read into a rateable preview is the wrong semantics, and the
 *  GalleryItem.build interface is synchronous (rlhf-preview.ts maps it sync), so threading the
 *  async config here would force an interface-wide refactor. The LIVE config-aware seam is
 *  buildVerifyCardForWorld(worldId) in onboarding/verify-card.ts; the live verify-card post
 *  path consumes it (that post path is not yet built in this repo — see scaffold report). */
export function galleryVerify(_s: DigestSnapshot): unknown[] {
  return buildVerifyCard();
}

/** reply — a chat-mode reply (composeReply path · single-turn, no tools), delivered as Pattern-B
 *  webhook plain text. Representative two-beat in ruggy's voice; in prod this is LLM-generated per
 *  the invoker's prompt. Shown so the gallery covers the chat surface, not just scheduled posts. */
export function galleryReplyVoice(_s: DigestSnapshot): string {
  return (
    "owsley's been quiet since the weekend, yeah. couple traces overnight but nothing that moved the needle.\n\n" +
    "if the liquid-backing crew stirs again i'll flag it."
  );
}

/** A gallery item renders EITHER a Components V2 layout OR a plain voice-text message (micro). */
export interface GalleryRender {
  readonly components?: unknown[];
  readonly text?: string;
}

export interface GalleryItem {
  readonly postType: string;
  readonly label: string;
  readonly build: (s: DigestSnapshot) => GalleryRender;
}

export const POST_TYPE_GALLERY: ReadonlyArray<GalleryItem> = [
  { postType: 'enriched', label: "enriched · hero + movers + spotlight (uses ruggy's real tools)", build: (s) => ({ components: galleryEnriched(s) }) },
  { postType: 'digest', label: 'digest · data billboard (the 5/5 winner)', build: (s) => ({ components: galleryDigest(s) }) },
  { postType: 'micro', label: "micro · ruggy's voice (plain text + emoji)", build: (s) => ({ text: galleryMicroVoice(s) }) },
  { postType: 'weaver', label: 'weaver · Stonehenge cross-zone', build: (s) => ({ components: galleryWeaver(s) }) },
  { postType: 'lore_drop', label: 'lore_drop · codex card', build: (s) => ({ components: galleryLore(s) }) },
  { postType: 'question', label: 'question · invitation + thumbnail section', build: (s) => ({ components: galleryQuestion(s) }) },
  { postType: 'callout', label: 'callout · anomaly alert', build: (s) => ({ components: galleryCallout(s) }) },
  { postType: 'pop-in', label: 'pop-in · event spotlight', build: (s) => ({ components: gallerySpotlight(s) }) },
  { postType: 'mint', label: 'mint · LIVE shadow-mint announcement (real renderer · nym+image+traits)', build: (s) => ({ components: galleryMint(s) }) },
  { postType: 'reply', label: 'reply · chat-mode (ruggy voice · plain text · Pattern B webhook)', build: (s) => ({ text: galleryReplyVoice(s) }) },
  { postType: 'verify', label: 'verify · onboarding card (C1 · custom_id button · cycle-009)', build: (s) => ({ components: galleryVerify(s) }) },
];
