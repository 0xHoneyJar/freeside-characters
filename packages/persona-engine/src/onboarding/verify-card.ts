// verify-card.ts — C1 · the public onboarding verify card (cycle-009 · sprint-2 · T2.1).
//
// A Components V2 container posted ONCE in the onboarding channel. It carries a single
// custom_id button (NOT a URL button) — the click is a MESSAGE_COMPONENT interaction the
// bot receives + handles (C2 dispatch), which is the only way to bind the click to the
// clicker's discord_id server-side (RT-6: a URL button would hand the flow to the browser
// with no discord identity, defeating the secure handoff).
//
// The `onboard:` custom_id namespace is RESERVED here (RT-6 prefix-ownership) — the dispatch
// rejects any foreign component that squats the prefix.

// Discord component type ids (mirror deliver/enriched-render.ts).
const COMPONENT_CONTAINER = 17;
const COMPONENT_TEXT_DISPLAY = 10;
const COMPONENT_ACTION_ROW = 1;
const COMPONENT_BUTTON = 2;

// Button style: 1 = PRIMARY (a custom_id action button, not a link).
const BUTTON_PRIMARY = 1;

/** Reserved interaction custom_id namespace (RT-6). */
export const ONBOARD_PREFIX = 'onboard:';
/** The verify button's custom_id — the click the C2 dispatch intercepts. */
export const ONBOARD_VERIFY_CUSTOM_ID = 'onboard:verify';

/** Onboarding accent — neutral verified-green (this is a utility card, not a zone billboard). */
const ONBOARD_ACCENT = 0x3ba55c;

export interface VerifyCardOpts {
  /** card heading (persona swaps this in sprint-5; functional default here). */
  title?: string;
  /** card body copy. */
  body?: string;
  /** button label. */
  buttonLabel?: string;
}

/**
 * Build the verify card as a Components V2 container (send with IS_COMPONENTS_V2 flag).
 * Pure — no network, no identity. The identity binding happens at click time (C2).
 */
export function buildVerifyCard(opts: VerifyCardOpts = {}): unknown[] {
  const title = opts.title ?? 'verify your wallet';
  const body =
    opts.body ??
    'connect your wallet to link it to your discord and unlock the verified role. takes about a minute.';
  const buttonLabel = opts.buttonLabel ?? 'verify';

  return [
    {
      type: COMPONENT_CONTAINER,
      accent_color: ONBOARD_ACCENT,
      components: [
        { type: COMPONENT_TEXT_DISPLAY, content: `## ${title}` },
        { type: COMPONENT_TEXT_DISPLAY, content: body },
        {
          type: COMPONENT_ACTION_ROW,
          components: [
            {
              type: COMPONENT_BUTTON,
              style: BUTTON_PRIMARY,
              label: buttonLabel,
              custom_id: ONBOARD_VERIFY_CUSTOM_ID,
            },
          ],
        },
      ],
    },
  ];
}
