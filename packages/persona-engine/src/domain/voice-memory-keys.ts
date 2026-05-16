// cycle-006 S5 T5.6 · voice-memory key factories.
// Red Team AC-RT-007 closure: chat-reply key is a (guildId, channelId, userId)
// TUPLE — NEVER channelId-alone — to prevent per-user info leakage in shared
// channels. Schema enforcement on VoiceMemoryEntry lands in S6.
//
// All key factories validate inputs against [A-Za-z0-9._:-]+ per SDD §3.7
// pathFor safety regex (defense-in-depth against path-traversal · AC-RT-001).

const KEY_COMPONENT_PATTERN = /^[A-Za-z0-9._:-]+$/;

function validateComponent(name: string, value: string): void {
  if (!KEY_COMPONENT_PATTERN.test(value)) {
    throw new Error(`voice-memory-keys: invalid ${name} "${value}"`);
  }
}

/** digest stream key — zone identifier. */
export function keyForDigest(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}

/**
 * chat-reply stream key — `(guildId, channelId, userId)` 3-tuple per
 * Red Team AC-RT-007. Prevents cross-user info leakage in shared channels.
 * Format: `<guildId>:<channelId>:<userId>` (colons are safe in pathFor).
 */
export function keyForChatReply(guildId: string, channelId: string, userId: string): string {
  validateComponent('guildId', guildId);
  validateComponent('channelId', channelId);
  validateComponent('userId', userId);
  return `${guildId}:${channelId}:${userId}`;
}

/** pop-in stream key — zone (cadence-narrative continuity). */
export function keyForPopIn(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}

/** micro / lore_drop / question / weaver / callout — zone-keyed. */
export function keyForMicro(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}
export function keyForLoreDrop(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}
export function keyForQuestion(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}
export function keyForWeaver(zone: string): string {
  validateComponent('zone', zone);
  return zone;
}

/** callout stream key — `<zone>:<triggerId>` per SDD §3.5. */
export function keyForCallout(zone: string, triggerId: string): string {
  validateComponent('zone', zone);
  validateComponent('triggerId', triggerId);
  return `${zone}:${triggerId}`;
}
