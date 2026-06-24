import type { Config } from '../config.ts';

export interface BedrockTextToImageArgs {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:5' | '5:4' | '3:2' | '2:3' | '21:9' | '9:21';
  outputFormat?: 'png' | 'jpeg';
}

export interface BedrockGeneratedImage {
  buffer: Buffer;
  filename: string;
  contentType: 'image/png' | 'image/jpeg';
  meta: {
    provider: 'bedrock';
    modelId: string;
    region: string;
    finishReasons?: Array<string | null>;
    seeds?: number[];
  };
}

export async function generateBedrockTextToImage(
  config: Config,
  args: BedrockTextToImageArgs,
): Promise<BedrockGeneratedImage> {
  const apiKey = config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY;
  if (!apiKey) {
    throw new Error('Bedrock image provider selected but AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY is unset');
  }

  const region = config.BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION || config.BEDROCK_IMAGE_REGION;
  const modelId = config.BEDROCK_IMAGE_TEXT_TO_IMAGE_MODEL_ID;
  if (!modelId) {
    throw new Error('Bedrock image provider selected but BEDROCK_IMAGE_TEXT_TO_IMAGE_MODEL_ID is unset');
  }

  const prompt = args.prompt.trim();
  if (!prompt) {
    throw new Error('Bedrock image prompt is empty');
  }

  const outputFormat = args.outputFormat ?? 'png';
  const aspectRatio = args.aspectRatio ?? '1:1';

  const encodedModelId = encodeURIComponent(modelId);
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModelId}/invoke`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      mode: 'text-to-image',
      aspect_ratio: aspectRatio,
      output_format: outputFormat,
    }),
  });

  if (!response.ok) {
    throw new Error(`bedrock image error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    seeds?: number[];
    finish_reasons?: Array<string | null>;
    images?: string[];
  };

  const base64Image = data.images?.[0];
  if (!base64Image) {
    throw new Error(`bedrock image returned no image: ${JSON.stringify(data)}`);
  }

  const buffer = Buffer.from(base64Image, 'base64');
  const filename = outputFormat === 'jpeg' ? 'satoshi-bedrock.jpg' : 'satoshi-bedrock.png';

  return {
    buffer,
    filename,
    contentType: outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
    meta: {
      provider: 'bedrock',
      modelId,
      region,
      finishReasons: data.finish_reasons,
      seeds: data.seeds,
    },
  };
}
