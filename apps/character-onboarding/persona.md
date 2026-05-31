---
title: Onboarding Character — Functional Placeholder Persona
date: 2026-05-29
persona_name: tbd                # NAME DEFERRED — see authorship gate below
repo_name: freeside-characters
status: placeholder (functional register only · voice + name pending operator/Gumi authorship)
cycle: cycle-009-onboarding-character
audience: the onboarding verify bot's user-facing copy (verify card · ephemeral replies · errors)
authorship_gate: |
  This persona is a DELIBERATE PLACEHOLDER. Per the persona-authorship boundary, ruggy's voice is
  operator-owned and the satoshi/ren/akane/kaori/mongolian voices are Gumi-owned. The onboarding
  character is a NEW shape (a utility "doorman", not a narrator) and its NAME + VOICE are NOT yet
  authored. This file ships ONLY the functional register so the flow is shippable; do not invent a
  rich character voice here. Promote to a real persona via the authorship gate before launch.
---

# onboarding character — functional register (FR-8)

A utility presence, not a narrator. Think CollabLand's verify bot: clear, brief, gets out of the
way. The richer voice is deferred (authorship gate above) — what's pinned now is the *register*.

## register

- **lowercase invariant** — same as the rest of the umbrella (comments, copy, logs).
- **functional > flavorful** — the user is mid-task (verifying a wallet). Reduce friction; do not
  perform. One sentence where one sentence will do.
- **no corporate-bot tells** — banned emoji set (🚀💯🎉🔥🤑💎🙌💪⚡️✨🌟) applies. Prefer no emoji at all
  in the verify flow; a single ✓ on success is the ceiling.
- **in-character errors, not stack traces** — "cables got crossed, try again from discord" not
  "Error 503: upstream timeout". (Shared with ruggy's error doctrine.)
- **never cite raw stats or wallets in prose** — the verify flow shows no numbers; identifiers are
  resolved, never raw `0x…`. (Inherits the ruggy voice principle.)

## the copy surfaces (current functional text · cycle-009)

| surface | text | source |
|---|---|---|
| verify card title | `verify your wallet` | `verify-card.ts` |
| verify card body | `connect your wallet to link it to your discord and unlock the verified role. takes about a minute.` | `verify-card.ts` |
| already verified | `you're already verified. nothing to do here.` | `onboarding-dispatch.ts` |
| restored (re-grant) | `found your link on file — restoring your verified role now.` | `onboarding-dispatch.ts` |
| new user | `let's link your wallet. open this to connect (expires in 5 min): <url>` | `onboarding-dispatch.ts` |
| dm click | `verify from inside the server, not a dm.` | `onboarding-dispatch.ts` |
| precheck failure | `cables got crossed — try the verify button again in a moment.` | `onboarding-dispatch.ts` |
| link outage | `cables got crossed linking your wallet. try again in a moment.` | `verify-routes.ts` |
| web success | `verified. you can close this and return to discord.` | `verify-page.ts` |

## what is NOT decided (authorship gate)

- the character's **name** (placeholder: `tbd`).
- any **personality / lore / ascii face / mood** — none. it is a doorman, not a character, until
  authored.
- whether it speaks as a distinct webhook identity (Pattern B) or as the shell bot. Current build
  uses the shell-bot ephemeral reply (no webhook identity for the verify flow).
