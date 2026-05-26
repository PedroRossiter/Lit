export type VoiceStyle = 'MASCULINA' | 'FEMININA';

export type VoiceConfig = {
  voiceName: string;
  label: string;
};

// Mapeamento de estilo -> voz Azure Multilingual Neural PT-BR.
// Vozes Multilingual sao a geracao mais recente (2024+), com prosodia mais
// natural que as Neural classicas (Fabio, Thalita simples).
export const VOICE_CONFIG: Record<VoiceStyle, VoiceConfig> = {
  MASCULINA: {
    voiceName: 'pt-BR-MacerioMultilingualNeural',
    label: 'Voz masculina',
  },
  FEMININA: {
    voiceName: 'pt-BR-ThalitaMultilingualNeural',
    label: 'Voz feminina',
  },
};

export const VOICE_STYLES: VoiceStyle[] = ['MASCULINA', 'FEMININA'];
