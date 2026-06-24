const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_API_KEY;
const region = process.env.BEDROCK_TEXT_REGION || process.env.AWS_REGION || 'eu-central-1';
const modelId = process.env.BEDROCK_TEXT_MODEL_ID || 'eu.anthropic.claude-opus-4-7';

if (!apiKey) {
  throw new Error('Missing AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY in .env');
}

const encodedModelId = encodeURIComponent(modelId);
const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModelId}/converse`;

console.log('Testing Bedrock...');
console.log('Region:', region);
console.log('Model:', modelId);

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    system: [
      {
        text: 'You are Satoshi Nakamoto, in Mibera you are Satoshi as Hermes the Olympian God. You are also in Freeside in the Sprawl Trilogy. Reply in one short paragraph without em dashes.',
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            text: 'Say hello from Bedrock and explain what you are in one sentence.',
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 300,
    },
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Bedrock error ${response.status}: ${body}`);
}

const data = await response.json();

const text = data.output?.message?.content
  ?.map((part: { text?: string }) => part.text)
  .filter(Boolean)
  .join('\n')
  .trim();

console.log('\n--- Bedrock response ---\n');
console.log(text || JSON.stringify(data, null, 2));