#!/usr/bin/env bun
/**
 * S0/T0.1 — Zone-registry call-site audit (auto-delete on cycle close)
 *
 * Surfaces every caller of ZONE_FLAVOR or ZONE_LABEL across packages/apps/scripts.
 * Used to confirm D1 scope (per cycle-007 SDD §2.1 + sprint plan S0/T0.1).
 * If callers exist OUTSIDE packages/persona-engine/src/, D1 scope expands.
 *
 * Outputs Markdown table to sprint-0-COMPLETED.md.
 *
 * Delete this file at sprint-0 close.
 */

import { $ } from 'bun';

interface CallSite {
  file: string;
  line: number;
  variable: 'ZONE_FLAVOR' | 'ZONE_LABEL';
  context: string;
  inPersonaEngine: boolean;
}

async function main() {
  const out: string[] = [];
  out.push('## S0/T0.1 — Zone-registry call-site audit\n');
  out.push(`Generated: ${new Date().toISOString()}\n`);
  out.push('Scans `packages/`, `apps/`, `scripts/` for ZONE_FLAVOR + ZONE_LABEL usage.\n');
  out.push('');

  const sites: CallSite[] = [];

  for (const variable of ['ZONE_FLAVOR', 'ZONE_LABEL'] as const) {
    try {
      const result = await $`git grep -n ${variable} packages apps scripts`.text();
      for (const line of result.trim().split('\n')) {
        if (!line) continue;
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) continue;
        const [, file, lineStr, context] = match;
        sites.push({
          file,
          line: parseInt(lineStr, 10),
          variable,
          context: context.trim().slice(0, 100),
          inPersonaEngine: file.startsWith('packages/persona-engine/src/'),
        });
      }
    } catch (e) {
      // git grep exits non-zero when no matches — that's fine
    }
  }

  if (sites.length === 0) {
    out.push('No callers found. D1 scope is empty — registry-only work.\n');
  } else {
    out.push(`Total call sites: **${sites.length}**\n`);
    const inEngine = sites.filter(s => s.inPersonaEngine).length;
    const outsideEngine = sites.length - inEngine;
    out.push(`- Inside \`packages/persona-engine/src/\`: ${inEngine}`);
    out.push(`- **Outside (D1 scope-expansion candidates)**: ${outsideEngine}\n`);
    out.push('');
    out.push('| file:line | variable | context | scope |');
    out.push('|---|---|---|---|');
    for (const s of sites) {
      const scope = s.inPersonaEngine ? '✅ in-scope' : '🚨 **scope expansion**';
      out.push(`| \`${s.file}:${s.line}\` | \`${s.variable}\` | \`${s.context}\` | ${scope} |`);
    }
    out.push('');

    if (outsideEngine > 0) {
      out.push('### ⚠️ Scope expansion required');
      out.push('');
      out.push(`${outsideEngine} call sites exist OUTSIDE \`packages/persona-engine/src/\`. D1 migration in S1/T1.3 must include these files.`);
      out.push('');
    } else {
      out.push('### ✅ D1 scope confirmed');
      out.push('');
      out.push('All call sites are inside `packages/persona-engine/src/`. S1/T1.3 migration scope matches SDD §2.1.');
      out.push('');
    }
  }

  out.push('---');
  out.push('Operator: please confirm scope (✅ accept) or expand (🔁 add outside-engine files to S1/T1.3).');

  // Append to sprint-0-COMPLETED.md
  const completedPath = 'grimoires/loa/cycles/cycle-007-agent-debuggability/sprint-0-COMPLETED.md';
  const existing = (await Bun.file(completedPath).exists()) ? await Bun.file(completedPath).text() : '';
  const header = existing.includes('# Sprint 0 — COMPLETED') ? '' : '# Sprint 0 — COMPLETED\n\n';
  await Bun.write(completedPath, header + existing + '\n' + out.join('\n'));

  // Also stdout
  console.log(out.join('\n'));
  console.log(`\nWritten to: ${completedPath}`);
}

main().catch((e) => {
  console.error('spike-zone-registry-callers failed:', e);
  process.exit(1);
});
