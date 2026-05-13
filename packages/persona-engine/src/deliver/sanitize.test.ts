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
  stripToolMarkup,
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
  // Capture telemetry · restore console.error between cases.
  let warnings: string[] = [];
  const originalWarn = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalWarn;
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
  const originalWarn = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalWarn;
  });

  test('PascalCase Error class — hypothetical Anthropic SDK rename catches', () => {
    // Format drift: Anthropic renames `API Error: 500` to `AnthropicAPIError: 500`.
    // Specific pattern stops matching; generic catch-all fires.
    const input = 'AnthropicAPIError: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('PascalCase Exception class WITH colon catches', () => {
    const input = 'RateLimitException: rate limit exceeded at line 42';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('PascalCase Failure class WITH colon catches', () => {
    const input = 'BedrockTimeoutFailure: connection reset by peer';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
  });

  test('Error: prefix + PascalCase class WITH colon catches', () => {
    const input = 'Error: OpenAIRateLimitException: too many requests';
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
    const input = 'Error: ruggy is here, just kidding';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('Lowercase prose mentioning "rate limit error" mid-body does NOT match', () => {
    const input = 'yo. saw a rate limit error earlier but cleared.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  // ─── FALSE-POSITIVE GUARDS (flatline gemini G2 · 2026-05-11) ───
  // The catch-all now requires trailing `:` so legitimate character voice
  // that opens with PascalCase identifier ending in Error/Exception/Failure
  // (followed by anything other than `:`) passes through.

  test('character voice: "TotalFailure is the name of my zine" passes through (G2 guard)', () => {
    const input = 'TotalFailure is the name of my new zine, you should see it.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('character voice: "ValidationError was his middle name" passes through (G2 guard)', () => {
    const input = 'ValidationError was his middle name, the codex told me so.';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('character voice: PascalCase Error class followed by space-and-prose passes through', () => {
    // Even though `RateLimitException at line 42` would have matched the old
    // `\b` pattern (false positive), the new `:` requirement protects it.
    const input = 'RateLimitException sounds like a band name, lowkey.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });
});

describe('sanitizeOutboundBody · passthrough cases', () => {
  let warnings: string[] = [];
  const originalWarn = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalWarn;
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
  const originalError = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalError;
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

describe('sanitizeOutboundBody · idempotency invariant (IMP-002)', () => {
  // This test enforces the invariant that our own error templates do not
  // themselves match the raw-error patterns. If they did, a second pass
  // of the sanitizer would substitute them AGAIN, breaking idempotency
  // and firing telemetry twice for one event.
  const CHARACTER_IDS_TO_TEST = ['ruggy', 'satoshi', 'unknown-character'];

  for (const charId of CHARACTER_IDS_TO_TEST) {
    test(`error template for "${charId}" should not match any raw error patterns`, () => {
      const errorBody = composeErrorBody(charId, 'error');
      // A "clean" run of the sanitizer on the template should produce no
      // warnings and return the template unchanged.
      const sanitizedResult = sanitizeOutboundBody(errorBody, charId, "SHOULD_NOT_BE_USED");
      expect(sanitizedResult).toBe(errorBody);
    });
  }
});

describe('sanitizeOutboundBody · unicode/locale variants (IMP-005)', () => {
    let warnings: string[] = [];
    const originalError = console.error;
    beforeEach(() => {
        warnings = [];
        console.error = (msg: string) => {
            warnings.push(typeof msg === 'string' ? msg : String(msg));
        };
    });
    afterEach(() => {
        console.error = originalError;
    });

    test('full-width unicode lookalikes are sanitized', () => {
        // Use full-width characters for "API Error: 500"
        const input = 'ＡＰＩ Ｅｒｒｏｒ: ５００';
        const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
        expect(out).toBe(composeErrorBody('ruggy', 'error'));
        expect(warnings).toHaveLength(1);
        // NFKC normalization converts full-width to ASCII before matching,
        // so the SPECIFIC anthropic-api-error pattern wins (not the generic
        // catch-all). This is the desired outcome: telemetry attributes
        // origin correctly.
        expect(warnings[0]).toContain('matched=anthropic-api-error');
    });

    test('full-width unicode passes through when not error-shaped', () => {
        // Character voice with intentional full-width text — must not
        // false-positive after NFKC normalization.
        const input = 'Ｈｅｌｌｏ ｆｒｉｅｎｄ, the bear watches today.';
        const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
        expect(out).toBe(input);
        expect(warnings).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────
// BLOCKER #1 whitespace-tolerance regression (gemini-skeptic · 2026-05-11)
//
// Anchored `^` patterns are defeated if the raw error body has leading
// whitespace or newlines. The fix: trimStart() the probe BEFORE matching.
// We compare against trimmed input but return the substitution (on match)
// or the original content (on no-match, preserving LLM whitespace).
//
// Plus: tolerate spaced JSON envelopes (`{"type": "error"…}` with space
// after colon) since the JSON pattern is widened to use `\s*`.
// ─────────────────────────────────────────────────────────────────────

describe('sanitizeOutboundBody · whitespace tolerance (BLOCKER #1)', () => {
  let warnings: string[] = [];
  const originalError = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalError;
  });

  test('leading newline + API Error substitutes', () => {
    const input = '\nAPI Error: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('leading multiple newlines + raw JSON envelope substitutes', () => {
    const input = '\n\n{"type":"error","error":{"type":"api_error"}}';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
  });

  test('leading spaces + bedrock chat error substitutes', () => {
    const input = '   bedrock chat error: 503 service unavailable';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=bedrock-chat-error');
  });

  test('leading tab + orchestrator SDK throw substitutes', () => {
    const input = '\torchestrator: SDK error subtype=error_during_execution';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=orchestrator-sdk-error-subtype');
  });

  test('spaced JSON envelope `{ "type" : "error" }` substitutes', () => {
    const input = '{ "type" : "error", "error" : { "type" : "api_error" } }';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
  });

  test('mixed-whitespace + spaced JSON substitutes', () => {
    const input = '  \n  { "type": "error", "error": { "message": "upstream" } }';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
  });

  test('LLM output with leading whitespace passes through verbatim (no-match preserves)', () => {
    // No raw-error pattern matches; LLM whitespace must survive.
    const input = '\n\nyo. just got the ledger update.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  test('LLM-shaped multi-line response with internal JSON code block passes through', () => {
    // Internal JSON is mid-body (after the LLM's prose preamble), so the
    // `^` anchor on the trimStart()ed input doesn't match it.
    const input = "here's the shape:\n\n```json\n{\"type\":\"error\",\"hint\":\"example\"}\n```";
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Zero-width / Cf-category bypass guards
// (flatline gemini-skeptic SKP-001 HIGH/760 · 2026-05-11)
//
// NFKC alone doesn't strip zero-width characters (ZWSP, ZWNJ, ZWJ, LRM,
// RLM, Word Joiner, BOM). An attacker could prefix or insert these to
// defeat the `^` anchor or break literal-byte matching.
// ─────────────────────────────────────────────────────────────────────

describe('sanitizeOutboundBody · zero-width strip (SKP-001 HIGH/760)', () => {
  let warnings: string[] = [];
  const originalError = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalError;
  });

  test('BOM (U+FEFF) prefix + API Error substitutes', () => {
    const input = '﻿API Error: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('ZWSP (U+200B) inserted mid-token substitutes', () => {
    // `A​PI` with a zero-width space between A and P.
    const input = 'A​PI Error: 500 Internal Server Error';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('Word Joiner (U+2060) prefix + JSON envelope substitutes', () => {
    const input = '⁠{"type":"error","error":{"type":"api_error"}}';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
  });

  test('ZWNJ (U+200C) + ZWJ (U+200D) scattered through error prefix substitutes', () => {
    const input = 'API‌ Error‍: 500';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('LRM (U+200E) + RLM (U+200F) bidi-mark obfuscation substitutes', () => {
    const input = '‎API Error: 500‏';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('NFKC + zero-width + leading whitespace: triple-stack substitutes', () => {
    // Combine all three defenses: full-width ＡＰＩ + ZWSP + leading newline.
    const input = '\n​ＡＰＩ Ｅｒｒｏｒ: ５００';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('LLM output with intentional zero-width chars passes through verbatim', () => {
    // ZWNJ is used in some scripts (e.g. Persian/Hindi) for legitimate
    // text rendering. LLM output must survive if it's not error-shaped.
    const input = 'hello‌world, the bear watches.';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(input);
    expect(warnings).toHaveLength(0);
  });

  // ─── Cf-broader coverage (flatline v3 SKP-002 + IMP-001 · HIGH-CONSENSUS 870) ───
  // `\p{Cf}` covers every format char, not just the zero-width subset.

  test('bidi LRI (U+2066) wrapping + API Error substitutes', () => {
    const input = '⁦API Error: 500⁩';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('bidi FSI (U+2066) + RLI (U+2067) + PDI (U+2069) obfuscation substitutes', () => {
    const input = '⁦AP⁧I Error⁩: 500';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });

  test('Arabic Letter Mark (U+061C) + bedrock chat error substitutes', () => {
    const input = '؜bedrock chat error: 500';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=bedrock-chat-error');
  });

  test('Soft Hyphen (U+00AD) injected mid-token substitutes', () => {
    // `API­ Error` — Soft Hyphen between API and Error.
    const input = 'API­ Error: 500';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=anthropic-api-error');
  });
});

// ─────────────────────────────────────────────────────────────────────
// discord.js bracketed error forms (flatline gemini-skeptic SKP-002 HIGH/720)
//
// discord.js stringifies errors like `DiscordAPIError[Cannot send messages
// to this user]: 50007`. Plain `DiscordAPIError:` regex misses the bracketed
// form. Widened pattern handles both bare and bracketed signatures.
// ─────────────────────────────────────────────────────────────────────

describe('sanitizeOutboundBody · bracketed discord.js errors (SKP-002 HIGH/720)', () => {
  let warnings: string[] = [];
  const originalError = console.error;
  beforeEach(() => {
    warnings = [];
    console.error = (msg: string) => {
      warnings.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.error = originalError;
  });

  test('bare DiscordAPIError: substitutes', () => {
    const input = 'DiscordAPIError: Missing Permissions';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=discord-js-api-error');
  });

  test('bracketed DiscordAPIError[Cannot send messages]: substitutes', () => {
    const input = 'DiscordAPIError[Cannot send messages to this user]: 50007';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=discord-js-api-error');
  });

  test('bracketed HTTPError[Rate Limited]: substitutes', () => {
    const input = 'HTTPError[Rate Limited]: 429';
    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
    expect(out).toBe(composeErrorBody('satoshi', 'error'));
    expect(warnings[0]).toContain('matched=discord-js-http-error');
  });

  test('Error: prefix + bracketed DiscordAPIError substitutes', () => {
    const input = 'Error: DiscordAPIError[Unknown Channel]: 10003';
    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
    expect(out).toBe(composeErrorBody('ruggy', 'error'));
    expect(warnings[0]).toContain('matched=discord-js-api-error');
  });
});

// =============================================================================
// stripToolMarkup · production digest leak fix (2026-05-13)
// =============================================================================

describe('stripToolMarkup · XML wrapper variants', () => {
  test('strips <tool_use>...</tool_use> wrapping a JSON tool call', () => {
    const input = `I'll fire the tools first.
<tool_use>{"name":"mcp__score__get_zone_digest","input":{"zone":"el-dorado","window":"weekly"}}</tool_use>
Composing now.
yo El Dorado (NFT) — 84 events`;
    const out = stripToolMarkup(input);
    expect(out).not.toContain('<tool_use>');
    expect(out).not.toContain('mcp__score__get_zone_digest');
    expect(out).toContain('yo El Dorado (NFT) — 84 events');
  });

  test('strips <tool_calls> variant (some model fine-tunes)', () => {
    const input = '<tool_calls>{"name":"get_zone_digest","input":{}}</tool_calls>\nbody';
    expect(stripToolMarkup(input)).toBe('body');
  });

  test('strips <function_call> variant', () => {
    const input = '<function_call>{"name":"x","arguments":{}}</function_call>\nbody';
    expect(stripToolMarkup(input)).toBe('body');
  });

  test('strips multiline JSON inside the wrapper', () => {
    const input = `<tool_use>
{
  "name": "mcp__score__get_zone_digest",
  "input": {"zone":"stonehenge","window":"weekly"}
}
</tool_use>
yo stonehenge`;
    const out = stripToolMarkup(input);
    expect(out).toBe('yo stonehenge');
  });

  test('strips multiple wrapped tool-calls in one body', () => {
    const input = `<tool_use>{"name":"a","input":{}}</tool_use>
mid-body
<tool_use>{"name":"b","arguments":{}}</tool_use>
end`;
    const out = stripToolMarkup(input);
    expect(out).not.toContain('tool_use');
    expect(out).toContain('mid-body');
    expect(out).toContain('end');
  });
});

describe('stripToolMarkup · bare JSON line variants', () => {
  test('strips bare {"name":"mcp__...", "input":{...}} on own line', () => {
    const input = `I'll call the tools first to ground this properly.
{"name": "mcp__score__get_zone_digest", "input": {"zone": "stonehenge", "window": "weekly"}}
ok so here's the digest`;
    const out = stripToolMarkup(input);
    expect(out).not.toContain('mcp__score__get_zone_digest');
    expect(out).toContain("here's the digest");
  });

  test('strips bare {"name":..., "arguments":...} variant', () => {
    const input = `prefix
{"name": "mcp__score__get_zone_digest", "arguments": {"zone": "stonehenge", "window": "weekly"}}
suffix`;
    const out = stripToolMarkup(input);
    expect(out).not.toContain('"arguments"');
    expect(out).toContain('prefix');
    expect(out).toContain('suffix');
  });

  test('strips non-MCP-prefixed tool names too', () => {
    const input = '{"name":"get_zone_digest","input":{"zone":"stonehenge","window":"weekly"}}\nbody';
    expect(stripToolMarkup(input)).toBe('body');
  });

  test('does NOT strip JSON-shaped content inside body prose', () => {
    const input = `here is some inline json: {"name": "foo"} mid-sentence
and a single line with json: {"name": "bar", "input": "qux"}`;
    // Inline JSON in middle of a sentence isn't stripped (not at line start)
    const out = stripToolMarkup(input);
    expect(out).toContain('here is some inline json');
    // The second line has tool-call shape but "input" value is a string not object
    // → schema mismatch → NOT stripped. Conservative pattern keeps real prose.
    expect(out).toContain('"input": "qux"');
  });
});

describe('stripToolMarkup · whitespace cleanup', () => {
  test('collapses triple+ blank lines left by stripping', () => {
    const input = 'before\n<tool_use>{"name":"a","input":{}}</tool_use>\n\n\n\nafter';
    const out = stripToolMarkup(input);
    expect(out).toBe('before\n\nafter');
  });

  test('strips leading whitespace when leak is at start of body', () => {
    const input = '<tool_use>{"name":"a","input":{}}</tool_use>\n\nbody';
    expect(stripToolMarkup(input)).toBe('body');
  });

  test('strips trailing whitespace when leak is at end of body', () => {
    const input = 'body\n\n<tool_use>{"name":"a","input":{}}</tool_use>\n';
    expect(stripToolMarkup(input)).toBe('body');
  });
});

describe('stripToolMarkup · idempotency + safety', () => {
  test('running twice produces identical output', () => {
    const input = `I'll fire the tools first.
<tool_use>{"name":"mcp__score__get_zone_digest","input":{"zone":"el-dorado"}}</tool_use>
Composing now.
yo El Dorado — 84 events`;
    const once = stripToolMarkup(input);
    const twice = stripToolMarkup(once);
    expect(twice).toBe(once);
  });

  test('clean body passes through unchanged', () => {
    const input = 'yo bear-cave team, 47 events this week. solid stacking.';
    expect(stripToolMarkup(input)).toBe(input);
  });

  test('empty string returns empty', () => {
    expect(stripToolMarkup('')).toBe('');
  });

  test('production digest leak (screenshot 2026-05-13) — full repro', () => {
    // Exact text observed in El Dorado (NFT) digest 5/9/26 5:00 PM.
    const leaked = `I'll fire the tools first.

<tool_use>
{"name":"mcp__score__get_zone_digest","input":{"zone":"el-dorado","window":"weekly"}}
</tool_use>

Composing now.

yo El Dorado (NFT)⛏️ · 84 events · 31 miberas · steady`;
    const out = stripToolMarkup(leaked);
    expect(out).not.toContain('<tool_use>');
    expect(out).not.toContain('mcp__score__get_zone_digest');
    // "Composing now." is plain text (not structural markup), so the
    // sanitize-layer strip won't catch it — that's the orchestrator
    // fix's responsibility (skip text from tool-using turns).
    expect(out).toContain('yo El Dorado (NFT)⛏️ · 84 events');
  });
});
