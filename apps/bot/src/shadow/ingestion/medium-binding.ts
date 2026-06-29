/**
 * ingestion/medium-binding.ts — the IMediumBinding port (cycle-010 S3.3; SDD §4.6;
 * GitHub #72). Resolves which medium a surface is delivered through, so the
 * render layer conditions on the medium's CAPABILITIES (a modal is
 * interaction-only, not available via webhook — the Pattern-B-shell split).
 *
 * ⚠️ MVP scope (FR-9): returns a local Discord-INTERACTION descriptor. The
 * persona-engine dep `@0xhoneyjar/medium-registry` (^0.2.0) is the eventual
 * source of truth for these capabilities; this local descriptor swaps for it
 * via one import change (same pattern as GATE-PKG). Telegram/CLI bindings are a
 * later cycle.
 *
 * VOICELESS: capability resolution only.
 */
import type { WorldRef } from "./source-producer.ts";

export type MediumKind = "discord-interaction" | "discord-webhook" | "telegram" | "cli";

/** What a medium can RENDER (mirrors medium-registry's MediumCapability shape). */
export interface MediumDescriptor {
  readonly kind: MediumKind;
  readonly capabilities: {
    readonly componentsV2: boolean;
    readonly modal: boolean; // interaction-only
    readonly ephemeral: boolean; // interaction-only
    readonly button: boolean;
  };
}

/** The Discord interaction descriptor (modals + ephemeral available). */
export const DISCORD_INTERACTION_DESCRIPTOR: MediumDescriptor = {
  kind: "discord-interaction",
  capabilities: { componentsV2: true, modal: true, ephemeral: true, button: true },
};

/** The Pattern-B shell webhook descriptor (NO modal/ephemeral — webhook context). */
export const DISCORD_WEBHOOK_DESCRIPTOR: MediumDescriptor = {
  kind: "discord-webhook",
  capabilities: { componentsV2: true, modal: false, ephemeral: false, button: true },
};

/** Resolve which medium a world's CM surfaces are delivered through (#72 IMediumBinding). */
export interface IMediumBinding {
  resolve(world: WorldRef): MediumDescriptor;
}

/** MVP binding: the CM dashboards are slash-command interactions → interaction descriptor. */
export const interactionMediumBinding: IMediumBinding = {
  resolve: () => DISCORD_INTERACTION_DESCRIPTOR,
};

/**
 * Assert a capability before rendering a surface that requires it. Throws a
 * descriptive error rather than letting Discord silently reject the payload.
 */
export function assertCapability(
  descriptor: MediumDescriptor,
  cap: keyof MediumDescriptor["capabilities"],
): void {
  if (!descriptor.capabilities[cap]) {
    throw new Error(
      `medium '${descriptor.kind}' cannot render '${cap}' — this surface needs an interaction context`,
    );
  }
}
