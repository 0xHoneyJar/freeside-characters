// cycle-008 S9 (g30) · billboard SURFACE — how the data beat is formatted in Discord.
//
// Bred from the operator's pick (v1-plain · "the table is very difficult to read … discord
// has different formatting options"). The bold-text surface renders in Discord's proportional
// body font, where figure-space columns go ragged. Discord's code-block + ANSI primitives use
// MONOSPACE — perfectly aligned, readable tables. This module models the three surfaces so
// both delivery (render-candidate) and any medium adapter agree.
//
//   bold-text  -> **line** per line (the prod two-beat · proportional · v0 byte-identical)
//   code-block -> triple-backtick monospace block (no color · bulletproof alignment)
//   ansi       -> triple-backtick "ansi" block (monospace + Discord SGR color/bold)

// text tier (fragile · the dig) + rich tier (Discord-native · rendered by the Discord adapter).
export type BillboardSurface = 'bold-text' | 'code-block' | 'ansi' | 'embed' | 'components-v2' | 'canvas';

export const BILLBOARD_SURFACES: ReadonlyArray<BillboardSurface> = [
  'bold-text',
  'code-block',
  'ansi',
  'embed',
  'components-v2',
  'canvas',
];

const FENCE = '```';

/**
 * Strip em/en dashes — ruggy voice rule (operator 2026-05-23: "strip out at a core level").
 * Replaced with a PERIOD (ruggy speaks in short sentences) — operator 2026-05-23: "don't
 * replace it with a comma if it's supposed to be a period." A dash joining two clauses reads
 * as two sentences in ruggy's register. Data layouts keep their intentional ` · ` separators;
 * this only rewrites prose where a dash appeared. The production path also strips dashes via
 * deliver/sanitize.ts. Best practice: author voice WITHOUT dashes; this is the safety net.
 */
export function stripEmDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, '. ');
}

/** Plain monospace code block (the most readable aligned table). */
export function toCodeBlock(lines: ReadonlyArray<string>): string {
  return `${FENCE}\n${lines.join('\n')}\n${FENCE}`;
}

// Discord ansi blocks support a subset of SGR; codes need the literal ESC byte.
const ESC = '\x1b';
const ANSI_RESET = `${ESC}[0m`;
const ANSI_HEADER = `${ESC}[1;35m`; // bold magenta (closest basic-ANSI to owsley purple)
const ANSI_VALUE = `${ESC}[1;37m`; // bold white

/** ANSI code block: header bold-magenta, data rows bold-white, monospace-aligned. */
export function toAnsiBlock(lines: ReadonlyArray<string>): string {
  const body = lines
    .map((line, i) => (i === 0 ? `${ANSI_HEADER}${line}${ANSI_RESET}` : `${ANSI_VALUE}${line}${ANSI_RESET}`))
    .join('\n');
  return `${FENCE}ansi\n${body}\n${FENCE}`;
}

/** Strip the code-fence (``` / ```ansi) for preview rendering. Returns the inner body. */
export function stripCodeFence(content: string): string {
  return content.replace(/^```[a-z]*\n?/, '').replace(/\n?```\s*$/, '');
}

// ── ANSI -> HTML (preview only) ───────────────────────────────────────────────
// Minimal SGR parser for the subset Discord supports, so the preview shows the same
// colors Discord would. Input is already HTML-escaped by the caller.
const SGR_FG: Record<number, string> = {
  30: '#4f545c',
  31: '#dc322f',
  32: '#859900',
  33: '#b58900',
  34: '#268bd2',
  35: '#d33682',
  36: '#2aa198',
  37: '#e6e6e6',
};

/** Convert ANSI SGR escapes (ESC[<codes>m) in already-escaped text to <span> styling. */
export function ansiToHtml(escapedText: string): string {
  const re = /\x1b\[([0-9;]*)m/g;
  let out = '';
  let open = false;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(escapedText)) !== null) {
    out += escapedText.slice(last, m.index);
    last = m.index + m[0].length;
    if (open) {
      out += '</span>';
      open = false;
    }
    const codes = (m[1] ?? '').split(';').filter(Boolean).map(Number);
    const styles: string[] = [];
    for (const code of codes) {
      if (code === 1) styles.push('font-weight:700');
      else if (code === 2) styles.push('opacity:0.6');
      else if (code === 4) styles.push('text-decoration:underline');
      else if (SGR_FG[code]) styles.push(`color:${SGR_FG[code]}`);
    }
    if (styles.length > 0) {
      out += `<span style="${styles.join(';')}">`;
      open = true;
    }
  }
  out += escapedText.slice(last);
  if (open) out += '</span>';
  return out.replace(/\x1b/g, ''); // strip any stray ESC
}
