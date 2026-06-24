// cycle-006 voice-memory sanitization (SDD §3.9 · Flatline SKP-004 closure).
// Strips control bytes + NFKC-normalizes + strips zero-width characters at WRITE time.
//
// Pulled into S1 (originally scheduled in S6 T6.3) because formatPriorWeekHint
// in S1 T1.5 needs this. S6 T6.3 verifies the wiring at read+write callsites.
//
// Note: full cycle-098 L6/L7 `<untrusted-content>` SURFACING wrap is provided
// separately by `format-prior-week-hint.ts` (S1 T1.5). Sanitize at WRITE is the
// first defense; surfacing-time wrap is the second. Both required per Red Team
// AC-RT-002 + FLATLINE-SKP-002/CRITICAL.

const C0_C1_CONTROL_BYTES = /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g;
// Cf-category zero-width chars: ZWSP (U+200B), ZWNJ (U+200C), ZWJ (U+200D),
// WJ (U+2060), BOM/ZWNBSP (U+FEFF).
const ZERO_WIDTH_CHARS = /[​-‍⁠﻿]/g;

export function sanitizeMemoryText(text: string): string {
  if (!text) return '';
  const stripped = text.replace(C0_C1_CONTROL_BYTES, '');
  const normalized = stripped.normalize('NFKC');
  return normalized.replace(ZERO_WIDTH_CHARS, '').trim();
}
