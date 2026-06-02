/**
 * shadow/discrepancy-cv2.ts — render the substrate's `Discrepancy` as a Discord
 * Components-V2 (CV2) message (Sprint 405 / Task 405.5, SDD §1.3 C6/§5.1, G-5).
 *
 * ── THE MEDIUM-AGNOSTIC PROOF (G-5) ──────────────────────────────────────────
 * This renderer consumes the EXACT SAME `Discrepancy` read-model the web lens
 * (S3, freeside-dashboard) renders — no substrate change per medium. The web
 * lens draws DOM; this draws a CV2 container. One contract, two media. That is
 * G-5 (feature-agnostic substrate): the substrate produces the read-model; the
 * lenses are voiceless renderers.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * This is a PURE render function (`Discrepancy` → CV2 component JSON). It holds
 * NO onboarding logic, fires no events, makes no Discord call. The bot's deliver
 * layer (`postToChannel` with the IS_COMPONENTS_V2 flag) sends the output.
 *
 * ── D2 / D3 ──────────────────────────────────────────────────────────────────
 * - D2: Freeside-MANAGED roles render with change affordances (created/added);
 *   pre-existing/Collab.Land roles render as dimmed LOCKED CONTEXT and are NEVER
 *   shown as "would change".
 * - D3: the `role_count` projection surfaces the projected 250-role total +
 *   overage predictively (a clear ⚠ when `exceeds`).
 *
 * CV2 grammar (mirrors packages/persona-engine/src/deliver/enriched-render.ts):
 *   container = { type: 17, accent_color, components: [...] }
 *   text      = { type: 10, content }
 *   separator = { type: 14 }
 * Send with the IS_COMPONENTS_V2 flag (1<<15) — content/embeds MUST be empty.
 *
 * ── INJECTION GUARD (FAGAN iter-2) ───────────────────────────────────────────
 * Role NAMES (`role_key`) are attacker-controllable: a low-priv guild member can
 * create a guild role named `@everyone`, `<@&123>`, or with markdown
 * (`# heading`, `**bold**`, backticks) and it surfaces here verbatim through the
 * pre-existing-roles context (D2). TWO defenses, both required:
 *   1. `allowed_mentions: { parse: [] }` on the payload — renders any mention
 *      syntax INERT (no role/user/@everyone ping fires) regardless of text.
 *   2. `escapeRoleName` neutralizes mention syntax + markdown control chars in
 *      role-name text BEFORE interpolation — so a malicious name cannot spoof the
 *      preview's structure (fake headings, fake code spans) or read as a mention.
 * A low-priv member must not be able to turn the preview into a mass-ping or
 * spoof its layout.
 */
import type { Discrepancy } from "@freeside-worlds/shadow-substrate";

/** The CV2 message-flags bit (IS_COMPONENTS_V2 = 1 << 15). */
export const IS_COMPONENTS_V2 = 1 << 15;

/**
 * Neutralize attacker-controllable role-NAME text before interpolating it into a
 * CV2 text component. Strips/escapes:
 *   • mention syntax — `@` (→ `@​`, breaks `@everyone`/`@here`) and the
 *     `<@&id>`/`<@id>`/`<#id>` angle-bracket mention forms (angle brackets escaped);
 *   • Discord markdown control chars — backtick, asterisk, underscore, tilde,
 *     pipe, `#`/`>`/`-` line-leading structure — so a name cannot forge a heading,
 *     bold/italic, code span, spoiler, or quote in the preview.
 * Defense-in-depth alongside `allowed_mentions: { parse: [] }` (which already
 * makes mentions inert). Returns a single-line, render-safe string.
 */
export function escapeRoleName(raw: string): string {
  return raw
    // collapse newlines/control whitespace so a name cannot inject extra lines.
    .replace(/[\r\n\t]+/g, " ")
    // break @everyone / @here / @user by inserting a zero-width space after @.
    .replace(/@/g, "@​")
    // escape Discord markdown + mention angle brackets.
    .replace(/[<>`*_~|#]/g, (ch) => `\\${ch}`)
    .trim();
}

/** Accent: warm honey by default, alert amber when the 250-limit is exceeded. */
const ACCENT_OK = 0x6f4ea1;
const ACCENT_WARN = 0xe0a83d;

type TextComponent = { type: 10; content: string };
type SeparatorComponent = { type: 14 };
type ContainerComponent = {
  type: 17;
  accent_color: number;
  components: Array<TextComponent | SeparatorComponent>;
};

function text(content: string): TextComponent {
  return { type: 10, content };
}
const sep: SeparatorComponent = { type: 14 };

/**
 * Render a `Discrepancy` as a CV2 container component. Returns the single
 * top-level component; the caller wraps it: `{ flags: IS_COMPONENTS_V2,
 * components: [renderDiscrepancyCV2(d)] }`.
 */
export function renderDiscrepancyCV2(d: Discrepancy): ContainerComponent {
  const rc = d.role_count;
  const accent = rc.exceeds ? ACCENT_WARN : ACCENT_OK;

  // BEFORE — current managed roles (pre-existing rendered separately as context).
  // role_key is an attacker-controllable Discord role NAME → escapeRoleName.
  const beforeManaged = d.before.roles.filter((r) => r.managed);
  const beforeLines = beforeManaged.length
    ? beforeManaged.map((r) => `• \`${escapeRoleName(r.role_key)}\` — ${r.members} member${r.members === 1 ? "" : "s"}`).join("\n")
    : "_(no Freeside roles yet)_";

  // AFTER — proposed managed roles; `created` marks not-yet-created ones.
  const afterManaged = d.after.roles.filter((r) => r.managed);
  const afterLines = afterManaged.length
    ? afterManaged
        .map((r) => {
          const tag = r.created ? "🆕 " : "";
          return `• ${tag}\`${escapeRoleName(r.role_key)}\` — ${r.members} member${r.members === 1 ? "" : "s"}`;
        })
        .join("\n")
    : "_(none proposed)_";

  // Latent qualified (MOCKED — honest provenance flag, FR-6/§8.5).
  const latentLines = d.latent_qualified.length
    ? d.latent_qualified
        .map((l) => `• \`${escapeRoleName(l.role_key)}\`: ${l.count} qualify off-server  _(${l.source})_`)
        .join("\n")
    : "_(none)_";

  // Pre-existing / Collab.Land roles — LOCKED CONTEXT (D2), NEVER "would change".
  // These are the clearest attacker surface: arbitrary guild role names.
  const preexisting = d.preexisting.roles;
  const preexistingLine = preexisting.length
    ? `🔒 Untouched (Collab.Land / pre-existing): ${preexisting.map((r) => `\`${escapeRoleName(r.role_key)}\``).join(", ")}`
    : "🔒 No pre-existing roles to preserve.";

  // D3 — predictive 250-role projection.
  const quotaLine = rc.exceeds
    ? `⚠️ **Would exceed Discord's ${rc.limit}-role limit** — projected ${rc.projected_total} (${rc.existing} existing + ${rc.to_create} to create). go_live will be refused until the proposed set fits.`
    : `Role budget: ${rc.projected_total}/${rc.limit} after apply (${rc.existing} existing + ${rc.to_create} to create).`;

  return {
    type: 17,
    accent_color: accent,
    components: [
      text(`# Shadow preview — \`${d.world}\``),
      text(`_map \`${d.role_map_hash.slice(0, 12)}…\` · generated ${d.generated_at}_`),
      sep,
      text(`## Before\n${beforeLines}`),
      text(`## After\n${afterLines}`),
      sep,
      text(`## Latent qualified (off-server)\n${latentLines}`),
      sep,
      text(preexistingLine),
      text(quotaLine),
    ],
  };
}

/** The full CV2 message payload (flags + components) ready for postToChannel. */
export function discrepancyCV2Payload(d: Discrepancy): {
  flags: number;
  components: ContainerComponent[];
  allowed_mentions: { parse: never[] };
} {
  return {
    flags: IS_COMPONENTS_V2,
    components: [renderDiscrepancyCV2(d)],
    // INJECTION GUARD: make every mention inert (no @everyone / role / user ping
    // can fire from an attacker-named role surfaced in the preview). Pairs with
    // escapeRoleName above (which neutralizes the text form).
    allowed_mentions: { parse: [] },
  };
}
