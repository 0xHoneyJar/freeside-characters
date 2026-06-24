export interface VoiceAugment {
  readonly header: string;
  readonly outro: string;
}

export const EMPTY_VOICE_AUGMENT: VoiceAugment = {
  header: '',
  outro: '',
};

