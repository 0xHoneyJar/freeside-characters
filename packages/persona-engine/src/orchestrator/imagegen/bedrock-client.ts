/**
 * Bedrock Stability invoke — substrate scaffold (V0.7-A.1).
 *
 * Mirrors the invokeChatBedrock stub pattern in compose/reply.ts. Ships a
 * type-shaped boundary so substrate plumbing (orchestrator wiring, MCP
 * tool surface, dispatch handler) can land first, then Eileen replaces
 * the stub body with the real `@aws-sdk/client-bedrock-runtime`
 * InvokeModelCommand against the Stability model her region exposes
 * (e.g. `stability.stable-image-ultra-v1:0`).
 *
 * What ships now (this file):
 *   - isImagegenConfigured(config)  — env presence check substrate uses
 *     to conditionally register the imagegen MCP server
 *   - invokeStability(config, input) — placeholder body that round-trips
 *     prompt/style/seed in a synthetic URL so the MCP tool surface is
 *     end-to-end exercisable in dev (smoke test + /satoshi-image dispatch)
 *
 * What Eileen lands (her PR):
 *   - Add `@aws-sdk/client-bedrock-runtime` to persona-engine deps
 *   - Replace the placeholder body with InvokeModelCommand using
 *     `text_prompts`/`cfg_scale`/`seed` per her model's body spec
 *   - Image bytes → upload target (S3 / R2 / Discord attachment) → URL
 *
 * Auth path (already plumbed in config.ts via Eileen's bedrock-typing
 * scaffold): AWS_BEARER_TOKEN_BEDROCK (newer bearer-token auth) OR
 * BEDROCK_API_KEY. The substrate config carries them; this client reads
 * from the passed Config object rather than process.env directly so test
 * fixtures + per-character env scoping work uniformly.
 */

import type { Config } from '../../config.ts';
import type { GenerateInput, GenerateOutput } from './types.ts';

export function isImagegenConfigured(config: Config): boolean {
  return Boolean(config.AWS_REGION && config.BEDROCK_STABILITY_MODEL_ID);
}

export async function invokeStability(
  config: Config,
  input: GenerateInput,
): Promise<GenerateOutput> {
const region = config.AWS_REGION;
const modelId = config.BEDROCK_STABILITY_MODEL_ID;
const apiKey = config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY;

if (!region || !modelId) {
  throw new Error(
    'imagegen: AWS_REGION and BEDROCK_STABILITY_MODEL_ID are required to invoke Stability',
  );
}

if (!apiKey) {
  throw new Error(
    'imagegen: AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY required for Bedrock auth',
  );
}

const seed = input.seed ?? deterministicSeed(input.prompt);

const response = await fetch(
  `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      mode: 'text-to-image',
      aspect_ratio: input.aspect_ratio ?? '1:1',
      output_format: 'png',
      seed,
    }),
  },
);

if (!response.ok) {
  throw new Error(`imagegen: Bedrock Stability failed ${response.status}: ${await response.text()}`);
}

const data = (await response.json()) as {
  images?: string[];
  seeds?: number[];
  finish_reasons?: Array<string | null>;
};

const finishReason = data.finish_reasons?.[0];
if (finishReason) {
  throw new Error(`imagegen: Bedrock Stability finish_reason=${finishReason}`);
}

const imageBase64 = data.images?.[0];
if (!imageBase64) {
  throw new Error(`imagegen: Bedrock Stability returned no image: ${JSON.stringify(data)}`);
}

return {
  url: `attachment://satoshi-image-${seed}.png`,
  model: modelId,
  seed: data.seeds?.[0] ?? seed,
  placeholder: false,
  imageBase64,
  mimeType: 'image/png',
  filename: `image-${seed}.png`,
};
}

function buildPlaceholderUrl(input: GenerateInput, seed: number): string {
  // Round-trip context into the URL so dispatch logs and Eileen's local
  // QA see exactly what the substrate handed the (eventually-real) SDK
  // call. Truncate prompt at 80 chars to keep the URL within standard
  // length budgets — the LLM can echo the full prompt back in prose.
  const params = new URLSearchParams({
    placeholder: '1',
    prompt: input.prompt.slice(0, 80),
    seed: String(seed),
  });
  if (input.style) params.set('style', input.style);
  if (input.aspect_ratio) params.set('aspect', input.aspect_ratio);
  return `https://placehold.co/imagegen?${params.toString()}`;
}

/**
 * Cheap deterministic seed derivation when the caller didn't pass one —
 * gives reproducible-enough placeholder URLs in tests without pulling in
 * a hash dep. Eileen can replace with crypto.randomBytes when the real
 * Stability call lands and reproducibility matters.
 *
 * `>>> 0` coerces the int32 to unsigned-32-bit, dodging the
 * `Math.abs(INT32_MIN) === INT32_MIN` edge case (Math.abs has no positive
 * int32 representation for -2147483648, so the result would still be
 * negative · breaks any downstream `nonnegative` zod check).
 */
function deterministicSeed(prompt: string): number {
  let h = 5381;
  for (let i = 0; i < prompt.length; i++) {
    h = ((h << 5) + h + prompt.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
