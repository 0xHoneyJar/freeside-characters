#!/usr/bin/env bun
/**
 * S0/T0.2 — Discord Android typography spike (auto-delete on cycle close)
 *
 * Validates the U+2007 (FIGURE SPACE) padding assumption empirically against Discord Android render.
 * Per Flatline SKP-003 (Phase 2) + operator-attested OP-Q6 decision (Phase 1).
 *
 * **HARD precondition step 0** (Phase 6 SKP-001/HIGH · operator memory `feedback_env_channel_world_mismatch`):
 * Calls Discord API GET /channels/{id} BEFORE posting. Asserts guild_id matches TEST_GUILD_ID_ALLOWLIST.
 * Refuses to post on mismatch. Closes the env/channel-mismatch class confirmed 2026-05-16.
 *
 * Generates 5 padding variants:
 *   1. ASCII space (U+0020) — control / current behavior
 *   2. FIGURE SPACE (U+2007) — primary candidate
 *   3. PUNCTUATION SPACE (U+2008) — alt
 *   4. NO-BREAK SPACE (U+00A0) — alt
 *   5. Code-block alternative (triple-backtick wrap)
 *
 * Posts each variant to Discord test channel. Operator captures Android screenshots.
 * Appends structured decision-capture block (JSON-schema-validated) to sprint-0-COMPLETED.md.
 *
 * Delete this file at sprint-0 close.
 *
 * Env vars:
 *   DISCORD_WEBHOOK_TEST_URL          — required · webhook URL for posting
 *   DISCORD_CHANNEL_TEST_ID           — required · channel ID for API verification
 *   DISCORD_BOT_TOKEN_TEST            — required · bot token for GET /channels/{id} call
 *   TEST_GUILD_ID_ALLOWLIST           — required · comma-separated guild_id allowlist
 *   LOA_OPERATOR_UNAVAILABLE=1        — optional · skip Discord POST · local PNG fixtures only (mechanical proxy)
 */

import { $ } from 'bun';

interface PaddingVariant {
  id: string;
  charName: string;
  charEscape: string;
  char: string;
  description: string;
}

const VARIANTS: PaddingVariant[] = [
  { id: 'ascii-space', charName: 'ASCII SPACE', charEscape: '\\u0020', char: ' ', description: 'control / current behavior' },
  { id: 'figure-space', charName: 'FIGURE SPACE', charEscape: '\\u2007', char: ' ', description: 'primary candidate · digit-width-invariant per OpenType tabular figures' },
  { id: 'punctuation-space', charName: 'PUNCTUATION SPACE', charEscape: '\\u2008', char: ' ', description: 'alt · narrower than figure space' },
  { id: 'no-break-space', charName: 'NO-BREAK SPACE', charEscape: '\\u00A0', char: ' ', description: 'alt · prevents line break' },
  { id: 'code-block-wrap', charName: 'CODE BLOCK', charEscape: 'N/A', char: ' ', description: 'triple-backtick wrap with font-hint · structural alternative' },
];

const SAMPLE_DATA = [
  { label: 'el-dorado', value: '1247' },
  { label: 'bear-cave', value: '83' },
  { label: 'lounge', value: '12' },
  { label: 'castle', value: '5' },
];

function renderVariant(v: PaddingVariant): string {
  const isCodeBlock = v.id === 'code-block-wrap';
  const padding = v.char;
  const lines: string[] = [];

  if (isCodeBlock) lines.push('```ansi');

  for (const { label, value } of SAMPLE_DATA) {
    // Right-align value at column 15 using the variant's padding char
    const labelPadded = label.padEnd(10, padding);
    const valuePadded = value.padStart(5, padding);
    lines.push(`${labelPadded}${valuePadded}`);
  }

  if (isCodeBlock) lines.push('```');

  return lines.join('\n');
}

async function verifyChannel(channelId: string, allowlist: string[]): Promise<{ ok: boolean; guildId?: string; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN_TEST;
  if (!token) return { ok: false, error: 'DISCORD_BOT_TOKEN_TEST not set' };

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return { ok: false, error: `Discord API returned ${res.status}: ${await res.text()}` };
    const data: any = await res.json();
    const guildId = data.guild_id;
    if (!guildId) return { ok: false, error: 'channel response missing guild_id (DM channel?)' };
    if (!allowlist.includes(guildId)) {
      return { ok: false, guildId, error: `guild_id ${guildId} not in TEST_GUILD_ID_ALLOWLIST (${allowlist.join(', ')})` };
    }
    return { ok: true, guildId };
  } catch (e) {
    return { ok: false, error: `fetch failed: ${(e as Error).message}` };
  }
}

async function postVariant(webhookUrl: string, v: PaddingVariant): Promise<{ ok: boolean; error?: string }> {
  const content = `**${v.charName}** (${v.charEscape}) — ${v.description}\n${renderVariant(v)}`;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return { ok: false, error: `webhook returned ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `fetch failed: ${(e as Error).message}` };
  }
}

function generateLocalFixtures(outDir: string) {
  // Mechanical-proxy fallback when LOA_OPERATOR_UNAVAILABLE=1 — generate text fixtures (PNG capture deferred to V2 or operator)
  for (const v of VARIANTS) {
    const content = renderVariant(v);
    Bun.write(`${outDir}/${v.id}.txt`, content);
  }
  console.log(`[mechanical proxy] Local text fixtures written to ${outDir}/*.txt — operator may render to PNG manually if needed.`);
}

async function main() {
  const operatorUnavailable = process.env.LOA_OPERATOR_UNAVAILABLE === '1';
  const completedPath = 'grimoires/loa/cycles/cycle-007-agent-debuggability/sprint-0-COMPLETED.md';
  const fixturesDir = '.run/cycle-007-s0-t02-typography';

  await $`mkdir -p ${fixturesDir}`.quiet();

  const out: string[] = [];
  out.push('\n## S0/T0.2 — Discord Android typography spike\n');
  out.push(`Generated: ${new Date().toISOString()}\n`);

  if (operatorUnavailable) {
    out.push('**Mode**: mechanical proxy (LOA_OPERATOR_UNAVAILABLE=1 · no Discord POST · local text fixtures only)\n');
    generateLocalFixtures(fixturesDir);
    out.push('### Decision (mechanical default)');
    out.push('');
    out.push('```yaml');
    out.push('chosen_padding_char: "\\u2007"  # U+2007 FIGURE SPACE');
    out.push(`evidence_paths: ["${fixturesDir}/*.txt"]`);
    out.push('rationale: "mechanical default · operator unavailable for Android attestation · S3 acceptance gate degrades to byte-snapshot only"');
    out.push('fallback_chain: ["\\u2008", "\\u00A0", "code-block-wrap"]');
    out.push('```');
    out.push('');
  } else {
    // Phase 6 SKP-001/HIGH: verify channel guild before posting
    const channelId = process.env.DISCORD_CHANNEL_TEST_ID;
    const allowlistStr = process.env.TEST_GUILD_ID_ALLOWLIST;
    const webhookUrl = process.env.DISCORD_WEBHOOK_TEST_URL;

    if (!channelId || !allowlistStr || !webhookUrl) {
      console.error('Missing env vars: DISCORD_CHANNEL_TEST_ID, TEST_GUILD_ID_ALLOWLIST, DISCORD_WEBHOOK_TEST_URL');
      console.error('Set LOA_OPERATOR_UNAVAILABLE=1 to skip Discord and use mechanical proxy.');
      process.exit(1);
    }

    const allowlist = allowlistStr.split(',').map(s => s.trim());
    console.log(`[step 0] Verifying channel ${channelId} guild_id against allowlist [${allowlist.join(', ')}]...`);
    const verifyResult = await verifyChannel(channelId, allowlist);
    if (!verifyResult.ok) {
      console.error(`T0.2 ABORTED: ${verifyResult.error}`);
      out.push(`**ABORTED**: channel verification failed — ${verifyResult.error}`);
      await Bun.write(completedPath, (await Bun.file(completedPath).text()) + out.join('\n'));
      process.exit(2);
    }
    console.log(`[step 0] ✅ guild_id ${verifyResult.guildId} in allowlist`);
    out.push(`**Channel verification**: ✅ guild_id ${verifyResult.guildId} in TEST_GUILD_ID_ALLOWLIST\n`);

    console.log(`[step 1] Posting ${VARIANTS.length} padding variants to test channel...`);
    out.push('### Variants posted to Discord\n');
    out.push('| variant | charEscape | description | status |');
    out.push('|---|---|---|---|');
    for (const v of VARIANTS) {
      const result = await postVariant(webhookUrl, v);
      const status = result.ok ? '✅ posted' : `❌ ${result.error}`;
      console.log(`  ${v.id} (${v.charName}): ${status}`);
      out.push(`| ${v.id} | \`${v.charEscape}\` | ${v.description} | ${status} |`);
      await new Promise(r => setTimeout(r, 500)); // Discord rate-limit politeness
    }
    out.push('');

    out.push('### Operator action required (PP-1 · SOFT gate)');
    out.push('');
    out.push('1. Open Discord Android client · navigate to test channel · capture screenshot of each variant');
    out.push(`2. Save screenshots to \`${fixturesDir}/<variant-id>.png\``);
    out.push('3. Visually compare alignment: which variant renders aligned digit columns under `gg sans` proportional fallback?');
    out.push('4. Fill in the decision block below:');
    out.push('');
    out.push('```yaml');
    out.push('# T0.2 Discord Android typography spike — operator decision');
    out.push('chosen_padding_char: "\\u2007"  # OPERATOR: replace with chosen escape (U+2007 / U+2008 / U+00A0 / code-block-wrap)');
    out.push(`evidence_paths: ["${fixturesDir}/figure-space.png", "${fixturesDir}/punctuation-space.png", ...]`);
    out.push('rationale: "<operator free-text rationale>"');
    out.push('fallback_chain: ["\\u2008", "\\u00A0", "code-block-wrap"]  # OPERATOR: reorder by preference');
    out.push('```');
    out.push('');
  }

  out.push('---');
  out.push('S3 reads this decision block · refuses to start if missing/invalid (per Flatline IMP-014 + SDD §2.8).');

  const existing = await Bun.file(completedPath).text();
  await Bun.write(completedPath, existing + out.join('\n'));

  console.log(`\nWritten to: ${completedPath}`);
  console.log('\nNext: PP-1 operator pair-point — capture Android screenshots and fill decision block.');
  console.log('Resume with: /run-resume (after decision block populated)');
}

main().catch((e) => {
  console.error('spike-discord-android-typography failed:', e);
  process.exit(1);
});
