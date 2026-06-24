/**
 * Imagegen — input/output schemas (V0.7-A.1 substrate prep).
 *
 * Boundary contract between the MCP tool surface and the bedrock-client
 * implementation. Anything the LLM passes through `mcp__imagegen__generate`
 * lands here; anything the substrate hands Eileen's Bedrock Stability
 * invoke also lands here. Keep this file the single source of truth for
 * the imagegen tool shape so the MCP server, the bedrock client, and any
 * future substrate consumer never disagree.
 */

import { z } from 'zod';

export const ImageStyleSchema = z.enum([
  'photorealistic',
  'illustration',
  'abstract',
  'cinematic',
  'pixel-art',
]);
export type ImageStyle = z.infer<typeof ImageStyleSchema>;

export const ImageAspectRatioSchema = z.enum(['1:1', '16:9', '9:16']);
export type ImageAspectRatio = z.infer<typeof ImageAspectRatioSchema>;

export interface GenerateInput {
  prompt: string;
  style?: ImageStyle;
  aspect_ratio?: ImageAspectRatio;
  seed?: number;
}

export interface GenerateOutput {
  url: string;
  model: string;
  seed: number;
  /**
   * Substrate-side flag: true when the bedrock client returned a synthetic
   * placeholder URL (Eileen's SDK invoke body not yet landed). Lets the
   * dispatch handler decorate the reply with a "scaffold mode" notice.
   */
  placeholder: boolean;

  imageBase64?: string;
  mimeType?: string;
  filename?: string;
}

export interface SuggestStyleInput {
  archetype: string;
  mood?: string;
}

export interface SuggestStyleOutput {
  archetype: string;
  mood: string | null;
  style: ImageStyle;
  rationale: string;
}
