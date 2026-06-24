/**
 * Imagegen substrate barrel — public surface of the imagegen MCP module.
 *
 * Exposed via `@freeside-characters/persona-engine/orchestrator/imagegen`
 * so the bot's smoke + diagnostics can exercise the substrate primitives
 * without crossing the workspace boundary or widening the main index.ts.
 *
 * The orchestrator wires `createImagegenServer` + `isImagegenConfigured`
 * directly via the relative path; this barrel exists for external consumers
 * (smoke, future diagnostics) only.
 */

export { invokeStability, isImagegenConfigured } from './bedrock-client.ts';
export {
  ImageStyleSchema,
  ImageAspectRatioSchema,
  type ImageStyle,
  type ImageAspectRatio,
  type GenerateInput,
  type GenerateOutput,
  type SuggestStyleInput,
  type SuggestStyleOutput,
} from './types.ts';
