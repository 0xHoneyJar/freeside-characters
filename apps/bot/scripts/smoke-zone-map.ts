/**
 * Smoke test for Sprint 1 / Phase B — channel↔zone reverse map.
 *
 * Runs forward+reverse round-trip across all four codex zones, confirms
 * unknown channel IDs return undefined, and asserts metadata accessor
 * returns non-empty fields.
 *
 * Run via: bun run apps/bot/scripts/smoke-zone-map.ts
 *
 * Exit code non-zero on any failure. Suitable for CI smoke-gating.
 */

import type { Config, ZoneId } from '@freeside-characters/persona-engine';
import {
  getCodexAnchorForZone,
  getZoneForChannel,
} from '../src/lib/channel-zone-map.ts';

// minimal stub — only fields the reverse map reads. Cast via unknown is safe
// because getZoneChannelId only touches the four DISCORD_CHANNEL_* keys.
const config = {
  DISCORD_CHANNEL_STONEHENGE: 'ch-stonehenge-1000',
  DISCORD_CHANNEL_BEAR_CAVE: 'ch-bear-cave-2000',
  DISCORD_CHANNEL_EL_DORADO: 'ch-el-dorado-3000',
  DISCORD_CHANNEL_OWSLEY_LAB: 'ch-owsley-lab-4000',
} as unknown as Config;

const FIXTURES: Array<{ zone: ZoneId; channelId: string }> = [
  { zone: 'stonehenge', channelId: 'ch-stonehenge-1000' },
  { zone: 'bear-cave', channelId: 'ch-bear-cave-2000' },
  { zone: 'el-dorado', channelId: 'ch-el-dorado-3000' },
  { zone: 'owsley-lab', channelId: 'ch-owsley-lab-4000' },
];

let failures = 0;

function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

console.log('smoke: channel↔zone reverse map (Sprint 1 / Phase B)');
console.log('');

console.log('round-trip across four codex zones:');
for (const { zone, channelId } of FIXTURES) {
  const resolved = getZoneForChannel(config, channelId);
  assert(resolved === zone, `${channelId} → ${zone} (got ${String(resolved)})`);
}

console.log('');
console.log('unknown channel ID returns undefined:');
const unknown = getZoneForChannel(config, '1234567890');
assert(unknown === undefined, `unknown channel returns undefined (got ${String(unknown)})`);

console.log('');
console.log('metadata accessor returns non-empty fields:');
for (const { zone } of FIXTURES) {
  const anchor = getCodexAnchorForZone(zone);
  assert(
    anchor.name.length > 0 && anchor.dimension.length > 0 && anchor.emoji.length > 0,
    `${zone}: { name: "${anchor.name}", dimension: "${anchor.dimension}", emoji: "${anchor.emoji}" }`,
  );
}

console.log('');
if (failures === 0) {
  console.log('✓ smoke pass · 4 zones round-trip · unknown→undefined · metadata complete');
  process.exit(0);
} else {
  console.error(`✗ smoke fail · ${failures} assertion(s) failed`);
  process.exit(1);
}
