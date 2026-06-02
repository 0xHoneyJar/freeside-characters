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
 */
import type { Discrepancy } from "@freeside-worlds/shadow-substrate";

/** The CV2 message-flags bit (IS_COMPONENTS_V2 = 1 << 15). */
export const IS_COMPONENTS_V2 = 1 << 15;

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
  const beforeManaged = d.before.roles.filter((r) => r.managed);
  const beforeLines = beforeManaged.length
    ? beforeManaged.map((r) => `• \`${r.role_key}\` — ${r.members} member${r.members === 1 ? "" : "s"}`).join("\n")
    : "_(no Freeside roles yet)_";

  // AFTER — proposed managed roles; `created` marks not-yet-created ones.
  const afterManaged = d.after.roles.filter((r) => r.managed);
  const afterLines = afterManaged.length
    ? afterManaged
        .map((r) => {
          const tag = r.created ? "🆕 " : "";
          return `• ${tag}\`${r.role_key}\` — ${r.members} member${r.members === 1 ? "" : "s"}`;
        })
        .join("\n")
    : "_(none proposed)_";

  // Latent qualified (MOCKED — honest provenance flag, FR-6/§8.5).
  const latentLines = d.latent_qualified.length
    ? d.latent_qualified
        .map((l) => `• \`${l.role_key}\`: ${l.count} qualify off-server  _(${l.source})_`)
        .join("\n")
    : "_(none)_";

  // Pre-existing / Collab.Land roles — LOCKED CONTEXT (D2), NEVER "would change".
  const preexisting = d.preexisting.roles;
  const preexistingLine = preexisting.length
    ? `🔒 Untouched (Collab.Land / pre-existing): ${preexisting.map((r) => `\`${r.role_key}\``).join(", ")}`
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
} {
  return { flags: IS_COMPONENTS_V2, components: [renderDiscrepancyCV2(d)] };
}
