// cycle-008 S9 (g30) · shared billboard column alignment.
//
// The U+2007 FIGURE SPACE technique the prod billboard uses (discord-render.live.ts:55):
// digit-width spacing so the value column stays aligned inside bold (not a code block),
// surviving Discord's proportional gg sans via tabular figures. Both the code variants
// (billboard-variants.ts) and the declarative template interpreter (billboard-templates.ts)
// import from here so alignment is identical everywhere — and to break the import cycle.

import { metricsForMedium, DISCORD_WEBHOOK_DESCRIPTOR } from '../../deliver/medium-extensions.ts';

/** The digit-width FIGURE SPACE (U+2007) — same source the prod billboard uses. */
export const FIGURE_SPACE = metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR).digitWidthSpaceChar;

/** Pad each label to a common width with FIGURE SPACE, then append the value. */
export function alignLabelValue(rows: ReadonlyArray<readonly [string, string]>): string[] {
  if (rows.length === 0) return [];
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(labelWidth + 2, FIGURE_SPACE)}${value}`);
}
