/**
 * sanitize.test.ts — voice-discipline transforms (cmp-boundary §9 · cycle R S1).
 *
 * Verifies stripVoiceDisciplineDrift handles em-dash, en-dash, asterisk
 * roleplay, and closing signoffs while preserving:
 *   - code blocks (triple-backtick fences AND inline backticks)
 *   - bold formatting (**...**)
 *   - satoshi's performed-silence pattern (full-sentence italics with periods)
 *   - digest-type closings (digest is the only post-type that retains them)
 *
 * Refs:
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   ~/vault/wiki/concepts/discord-native-register.md (2026-05-04 amend)
 */

import { afterEach, beforeEach, describe, test, expect } from 'bun:test';
import {
  stripVoiceDisciplineDrift,
  escapeDiscordMarkdown,
  sanitizeOutboundBody,
} from './sanitize.ts';
import { composeErrorBody } from '../expression/error-register.ts';

describe('stripVoiceDisciplineDrift · em-dash transform', () => {
  test('em-dash followed by lowercase becomes comma + space', () => {
    const input = 'the bear — laid-back';
    expect(stripVoiceDisciplineDrift(input)).toBe('the bear, laid-back');
  });

  test('em-dash followed by uppercase becomes period + space', () => {
    const input = 'the bear was here — Then it left';
    expect(stripVoiceDisciplineDrift(input)).toBe(
      'the bear was here. Then it left',
    );
  });

  test('em-dash with no surrounding spaces collapses to comma', () => {
    const input = 'mibera-dimensions—activity';
    expect(stripVoiceDisciplineDrift(input)).toBe(
      'mibera-dimensions, activity',
    );
  });

  test('multiple em-dashes in same sentence all transformed', () => {
    const input = 'one — two — three — four';
    expect(stripVoiceDisciplineDrift(input)).toBe('one, two, three, four');
  });

  test('em-dash at end of text drops cleanly', () => {
    const input = 'final word — ';
    expect(stripVoiceDisciplineDrift(input)).toBe('final word');
  });
});

describe('stripVoiceDisciplineDrift · en-dash transform', () => {
  test('en-dash receives same treatment as em-dash', () => {
    const input = 'the bear – laid-back';
    expect(stripVoiceDisciplineDrift(input)).toBe('the bear, laid-back');
  });

  test('en-dash followed by uppercase → period', () => {
    const input = 'observed – Then noted';
    expect(stripVoiceDisciplineDrift(input)).toBe('observed. Then noted');
  });
});

describe('stripVoiceDisciplineDrift · asterisk roleplay strip', () => {
  test('short stage direction stripped', () => {
    const input = 'ruggy says *adjusts cabling* hi';
    expect(stripVoiceDisciplineDrift(input)).toBe('ruggy says hi');
  });

  test('multiple stage directions all stripped', () => {
    const input = '*adjusts ledger* and *peeks at chain* observed';
    expect(stripVoiceDisciplineDrift(input)).toBe('and observed');
  });

  test('PRESERVES satoshi performed-silence (full sentence with period)', () => {
    const input =
      '*satoshi observes the room and shakes his head. nothing of note to report.*';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });

  test('PRESERVES bold (**bold**) — adjacent-asterisk guard', () => {
    const input = '**important** observation **here**';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });

  test('PRESERVES italic with uppercase first char (emphasis, not roleplay)', () => {
    const input = 'see *Important* for context';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · closing-signoff strip', () => {
  test('non-digest strips trailing "stay groovy 🐻"', () => {
    const input = 'the chain has held.\nstay groovy 🐻';
    expect(stripVoiceDisciplineDrift(input)).toBe('the chain has held.');
  });

  test('digest preserves trailing closing', () => {
    const input = 'the chain has held.\nstay groovy 🐻';
    expect(stripVoiceDisciplineDrift(input, { postType: 'digest' })).toBe(
      input,
    );
  });

  test('strips bare "stay groovy" (no emoji)', () => {
    const input = 'observation made.\nstay groovy';
    expect(stripVoiceDisciplineDrift(input)).toBe('observation made.');
  });

  test('strips "stay frosty" (satoshi-region closing)', () => {
    const input = 'the ledger holds.\nstay frosty';
    expect(stripVoiceDisciplineDrift(input)).toBe('the ledger holds.');
  });

  test('preserves "stay groovy" mid-text (only end-of-text strip)', () => {
    const input = 'when ruggy says stay groovy he means it';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · code-block preservation', () => {
  test('em-dash inside triple-backtick fence preserved', () => {
    const input = ['voice line.', '```', 'code — em-dash here', '```', 'more.'].join(
      '\n',
    );
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('code — em-dash here');
    expect(result).toContain('voice line.');
    expect(result).toContain('more.');
  });

  test('em-dash inside inline backticks preserved', () => {
    const input = 'use `mibera—id` as identifier — never as prose dash';
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('`mibera—id`');
    // outside-backtick em-dash transformed
    expect(result).toContain('identifier, never');
  });

  test('asterisk inside backticks preserved', () => {
    const input = 'glob pattern `*.test.ts` — useful';
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('`*.test.ts`');
  });
});

describe('stripVoiceDisciplineDrift · idempotency', () => {
  test('running twice produces same output as running once', () => {
    const input =
      'the bear — laid-back — *adjusts cabling* — observed.\nstay groovy 🐻';
    const once = stripVoiceDisciplineDrift(input);
    const twice = stripVoiceDisciplineDrift(once);
    expect(twice).toBe(once);
  });

  test('clean input returns unchanged', () => {
    const input = 'the chain has held. mibera_acquire lifted heavy.';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · edge cases', () => {
  test('empty string returns empty', () => {
    expect(stripVoiceDisciplineDrift('')).toBe('');
  });

  test('whitespace-only returns whitespace-stripped', () => {
    expect(stripVoiceDisciplineDrift('   ')).toBe('');
  });

  test('no transforms needed → identical output', () => {
    const input = 'plain prose without any drift markers.';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('escapeDiscordMarkdown · regression smoke (existing function)', () => {
  test('underscores escaped outside backticks', () => {
    expect(escapeDiscordMarkdown('mibera_acquire')).toBe('mibera\\_acquire');
  });

  test('content inside backticks preserved', () => {
    expect(escapeDiscordMarkdown('use `mibera_acquire` here')).toBe(
      'use `mibera_acquire` here',
    );
  });

  test('custom emoji preserved', () => {
    expect(escapeDiscordMarkdown('hello <:ruggy_grin:12345>')).toBe(
      'hello <:ruggy_grin:12345>',
    );
  });
});

describe('stripVoiceDisciplineDrift · composition with escapeDiscordMarkdown', () => {
  test('voice-discipline runs before markdown escape (canonical order)', () => {
    const input = 'mibera_acquire — heavy lifting today';
    // step 1: voice discipline replaces em-dash
    const voice = stripVoiceDisciplineDrift(input);
    expect(voice).toBe('mibera_acquire, heavy lifting today');
    // step 2: markdown escape preserves the comma, escapes underscore
    const final = escapeDiscordMarkdown(voice);
    expect(final).toBe('mibera\\_acquire, heavy lifting today');
  });
});

// ─────────────────────────────────────────────────────────────────────
// sanitizeOutboundBody (FAGAN A4 · bug-20260511-b6eb97)
// ─────────────────────────────────────────────────────────────────────

// Test helper · mirrors what dispatch.ts call sites do: compute the
// in-character template once and pass it as the substitution arg.
const tmpl = (characterId: string) => composeErrorBody(characterId, 'error');

describe('sanitizeOutboundBody · raw-api-error substitution', () => {
  // Capture telemetry · restore console.warn between cases.
  let warnings: string[] = [];
  const originalWarn = console.warn;
  beforeEach(() => {
    warnings = [];
    console.warn = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  test('Anthropic API error body substitutes to in-character', () => {
    const input = 'API Error: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(out).toBe("something snapped on ruggy's end. cool to retry?");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('[outbound-sanitize]');
    expect(warnings[0]).toContain('character=ruggy');
    expect(warnings[0]).toContain('matched=anthropic-api-error');
    expect(warnings[0]).toContain('original_len=36');
  });

  test('Anthropic API error with Error: prefix (String(err) form) substitutes', () => {
    const input = 'Error: API Error: 529 overloaded';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe('The channel between worlds slipped. Retry on the next.');
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('Internal Server Error substitutes', () => {
    const out = sanitizeOutboundBody('Internal Server Error', 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=http-internal-server-error');
  });

  test('bedrock chat error (reply.ts:934 throw shape) substitutes', () => {
    const input = 'bedrock chat error: 500 {"message":"upstream timeout"}';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=bedrock-chat-error');
  });

  test('orchestrator SDK error subtype (index.ts:536 throw shape) substitutes', () => {
    const input = 'orchestrator: SDK error subtype=error_during_execution errors=Anthropic API failed';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=orchestrator-sdk-error-subtype');
  });

  test('orchestrator empty completion (index.ts:556 throw shape) substitutes', () => {
    const input = 'orchestrator: SDK query completed without an assistant text response. tool_uses=2';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=orchestrator-empty-completion');
  });

  test('freeside agent-gateway error (reply.ts:984 throw shape) substitutes', () => {
    const input = 'freeside agent-gateway chat error: 503 Service Unavailable';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=freeside-agent-gateway-error');
  });

  test('raw JSON error envelope substitutes', () => {
    const input = '{"type":"error","error":{"type":"api_error","message":"upstream timeout"}}';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
  });

  test('dispatch REST wrapper (dispatch.ts:1083 throw shape) substitutes', () => {
    const input = 'interactions: PATCH @original failed status=429 body={"retry_after":1.234}';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=dispatch-rest-wrapper');
  });

  test('dispatch follow-up POST wrapper substitutes', () => {
    const input = 'interactions: follow-up POST failed status=403 body={"code":50013}';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=dispatch-rest-wrapper');
  });

  test('unknown character falls through to caller-supplied substrate template', () => {
    // Caller decides the fallback template; sanitizer is pure.
    const out = sanitizeOutboundBody('API Error: 500', 'unknown-character', tmpl('unknown-character'));
    expect(out).toBe('something broke. try again?');
  });
});

describe('sanitizeOutboundBody · generic catch-all (F4 · format-drift defense)', () => {
  let warnings: string[] = [];
  const originalWarn = console.warn;
  beforeEach(() => {
    warnings = [];
    console.warn = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  test('PascalCase Error class — hypothetical Anthropic SDK rename catches', () => {
    // Format drift: Anthropic renames `API Error: 500` to `AnthropicAPIError: 500`.
    // Specific pattern stops matching; generic catch-all fires.
    const input = 'AnthropicAPIError: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('PascalCase Exception class catches', () => {
    const input = 'RateLimitException at line 42 in chat.ts';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('PascalCase Failure class catches', () => {
    const input = 'BedrockTimeoutFailure: connection reset by peer';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('Error: prefix + PascalCase class catches', () => {
    const input = 'Error: OpenAIRateLimitException at line 42';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('Specific pattern wins over generic when both could match', () => {
    // `AnthropicAPIError:` matches the generic, but `Error: API Error:`
    // matches the SPECIFIC `anthropic-api-error` pattern. First-match-wins
    // → specific attribution preserved.
    const input = 'Error: API Error: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('Bare "Error" prefix without trailing class name does NOT match', () => {
    // `Error: ruggy is here` — bare Error followed by lowercase prose.
    // No specific pattern matches (no known shape after `Error: `).
    // No generic match (needs PascalCase identifier ending in
    // Error|Exception|Failure with at least one letter between).
    const input = 'Error: ruggy is here, just kidding';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('Lowercase prose mentioning "rate limit error" mid-body does NOT match', () => {
    // Real character voice — never starts with PascalCase identifier.
    const input = 'yo. saw a rate limit error earlier but cleared.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });
});

describe('sanitizeOutboundBody · passthrough cases', () => {
  let warnings: string[] = [];
  const originalWarn = console.warn;
  beforeEach(() => {
    warnings = [];
    console.warn = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  test('in-character ruggy error template passes through verbatim', () => {
    const input = "cables got crossed, nothing came back. try again?";
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('in-character satoshi error template passes through verbatim', () => {
    const input = 'The signal is unclear this window. Retry on the next.';
    expect(sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('substrate-quiet generic passes through verbatim', () => {
    const input = 'something broke. try again?';
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('LLM success — multi-paragraph prose passes through verbatim', () => {
    const input =
      "yo, ruggy here. been watching the bear-cave today, lots of " +
      "mibera_acquire signal. the cubs are restless.\n\n" +
      "want to peek at the ledger? lmk.";
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('LLM success — emoji-rich passes through verbatim', () => {
    const input = '<:mibera_acquire:123> spotted three transfers today. <:bear_pog:456>';
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('LLM success — code block with API-looking content passes through (no anchor match)', () => {
    const input =
      "here's the shape:\n\n```\nstatus=200 body={\"ok\":true}\n```\n\nbasic.";
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('empty string passes through', () => {
    expect(sanitizeOutboundBody('', 'ruggy', tmpl('ruggy'))).toBe('');
    expect(warnings).toHaveLength(0);
  });

  test('LLM prose that legitimately mentions an error number does not falsely match', () => {
    // Anchored regex protects against mid-body false positives.
    const input = 'saw a HTTP 500 status earlier but it self-healed.';
    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
    expect(warnings).toHaveLength(0);
  });
});

describe('sanitizeOutboundBody · idempotency', () => {
  let warnings: string[] = [];
  const originalWarn = console.warn;
  beforeEach(() => {
    warnings = [];
    console.warn = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  test('running twice on a raw-error body produces identical output', () => {
    const input = 'API Error: 500 Internal Server Error';
    const first = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    const second = sanitizeOutboundBody(first, 'ruggy', tmpl('ruggy'));
    expect(second).toBe(first);
    // First pass fires telemetry; second pass should not.
    expect(warnings).toHaveLength(1);
  });

  test('running twice on LLM success produces identical output (no telemetry)', () => {
    const input = "yo. been thinking about the cave.";
    const first = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    const second = sanitizeOutboundBody(first, 'ruggy', tmpl('ruggy'));
    expect(second).toBe(first);
    expect(warnings).toHaveLength(0);
  });
});
