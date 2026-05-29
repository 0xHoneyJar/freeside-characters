// onboarding-dispatch.test.ts — cycle-009 sprint-2 T2.2 ACs.
import { describe, test, expect, beforeAll } from 'bun:test';
import { Effect } from 'effect';
import {
  isOnboardingInteraction,
  isForeignOnboardSquat,
  decideOnboardingBranch,
  handleOnboardingInteraction,
  runOnboardingPrecheck,
  noOnboardingRuntime,
  type OnboardingRuntime,
} from './onboarding-dispatch.ts';
import type { FreesideAuthClient } from '@freeside-characters/persona-engine/onboarding';
import type { DiscordInteraction } from './types.ts';

beforeAll(() => {
  process.env.ONBOARDING_STATE_SECRET = 'y'.repeat(40);
});

const buttonClick = (customId: string, guild = '333'): DiscordInteraction =>
  ({
    type: 3, // MESSAGE_COMPONENT
    id: 'iid-1',
    application_id: 'app-1',
    token: 'tok-1',
    guild_id: guild,
    channel_id: 'chan-1',
    member: { user: { id: 'user-9', username: 'mibera' } },
    data: { id: 'c', name: '', custom_id: customId } as DiscordInteraction['data'],
  }) as DiscordInteraction;

describe('onboarding-dispatch C2 — detection', () => {
  test('the verify button is detected', () => {
    expect(isOnboardingInteraction(buttonClick('onboard:verify'))).toBe(true);
  });
  test('/onboard slash is detected', () => {
    const slash = { type: 2, id: 'i', application_id: 'a', token: 't', data: { id: 'd', name: 'onboard' } } as DiscordInteraction;
    expect(isOnboardingInteraction(slash)).toBe(true);
  });
  test('a foreign onboard: squat is NOT handled, and is flagged (RT-6)', () => {
    const squat = buttonClick('onboard:evil');
    expect(isOnboardingInteraction(squat)).toBe(false);
    expect(isForeignOnboardSquat(squat)).toBe(true);
  });
  test('an unrelated component is neither', () => {
    const other = buttonClick('quest_submission_1');
    expect(isOnboardingInteraction(other)).toBe(false);
    expect(isForeignOnboardSquat(other)).toBe(false);
  });
});

describe('onboarding-dispatch C2 — branch decision (pure)', () => {
  test('linked + role → verified', () => {
    expect(decideOnboardingBranch({ linked: true, hasRole: true })).toBe('verified');
  });
  test('linked + no role → restored (FR-13)', () => {
    expect(decideOnboardingBranch({ linked: true, hasRole: false })).toBe('restored');
  });
  test('not linked → new', () => {
    expect(decideOnboardingBranch({ linked: false, hasRole: false })).toBe('new');
  });
});

describe('onboarding-dispatch C2 — ACK never exceeds the 3s window (H-3)', () => {
  test('a guild click defers ephemerally (type 5, flag 64)', () => {
    const ack = handleOnboardingInteraction(buttonClick('onboard:verify'));
    expect(ack.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    expect(ack.data?.flags).toBe(64);
  });
  test('a DM click gets an instant ephemeral, no defer (guild-only)', () => {
    const dm = { ...buttonClick('onboard:verify'), guild_id: undefined } as DiscordInteraction;
    const ack = handleOnboardingInteraction(dm);
    expect(ack.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
    expect(ack.data?.content).toContain('server');
  });
});

describe('onboarding-dispatch C2 — pre-check (background)', () => {
  // capture the PATCH @original body the precheck sends.
  const capture = () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, fetchFn };
  };

  const newUserClient = {
    // resolveByDiscord → null = not linked = the new-user path.
    resolveByDiscord: () => Effect.succeed(null),
  } as unknown as FreesideAuthClient;

  const linkedClient = {
    resolveByDiscord: () => Effect.succeed({ user_id: 'u1' }),
  } as unknown as FreesideAuthClient;

  test('new user → mints a token + PATCHes an opaque verify URL (discord_id NOT in URL · H-1)', async () => {
    const { calls, fetchFn } = capture();
    const runtime: OnboardingRuntime = {
      authClient: newUserClient,
      verifyBaseUrl: 'https://verify.test/',
      noRuntime: false,
    };
    await runOnboardingPrecheck(buttonClick('onboard:verify'), runtime, { fetchFn });
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toContain('/messages/@original');
    const body = JSON.parse(calls[0]!.body);
    expect(body.content).toMatch(/verify\.test\/verify\/[0-9a-f]{32}/); // opaque 16-byte id
    expect(body.content).not.toContain('user-9'); // the discord_id never appears in the URL
    expect(body.flags).toBe(64); // stays ephemeral
  });

  test('linked user with no role → restored (no token minted, regrant attempted)', async () => {
    const { calls, fetchFn } = capture();
    let regranted = false;
    const runtime: OnboardingRuntime = {
      authClient: linkedClient,
      verifyBaseUrl: 'https://verify.test',
      regrantRole: async () => {
        regranted = true;
      },
      noRuntime: false,
    };
    await runOnboardingPrecheck(buttonClick('onboard:verify'), runtime, { fetchFn });
    expect(regranted).toBe(true);
    const body = JSON.parse(calls[0]!.body);
    expect(body.content).not.toContain('/verify/'); // no token URL on the restored path
  });

  test('no runtime (auth client null) → degrades to the new path (slip-fallback), still mints', async () => {
    const { calls, fetchFn } = capture();
    const runtime: OnboardingRuntime = { ...noOnboardingRuntime, verifyBaseUrl: 'https://verify.test' };
    await runOnboardingPrecheck(buttonClick('onboard:verify'), runtime, { fetchFn });
    const body = JSON.parse(calls[0]!.body);
    expect(body.content).toMatch(/verify\/[0-9a-f]{32}/);
  });

  test('T5.3/IMP-002 · resolve-by-wallet mode SKIPS resolveByDiscord (DEP-A not shipped)', async () => {
    const { calls, fetchFn } = capture();
    let resolveCalled = false;
    const probeClient = {
      resolveByDiscord: () => {
        resolveCalled = true;
        return Effect.succeed({ user_id: 'u1' }); // would say "linked" → restored, IF called
      },
    } as unknown as FreesideAuthClient;
    const runtime: OnboardingRuntime = {
      authClient: probeClient,
      verifyBaseUrl: 'https://verify.test',
      idempotentMode: 'resolve-by-wallet',
      noRuntime: false,
    };
    await runOnboardingPrecheck(buttonClick('onboard:verify'), runtime, { fetchFn });
    expect(resolveCalled).toBe(false); // pre-check skipped
    expect(JSON.parse(calls[0]!.body).content).toMatch(/verify\/[0-9a-f]{32}/); // → new path
  });
});
