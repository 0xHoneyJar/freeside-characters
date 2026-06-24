export interface DeterministicEmbed {
  readonly color: number;
  readonly fields: ReadonlyArray<{ name: string; value: string; inline?: boolean }>;
  readonly footer?: { text: string };
  // `description` intentionally absent. Truth zone cannot carry voice.
}

export interface DigestMessage {
  readonly voiceContent: string;
  readonly truthEmbed: DeterministicEmbed;
}

