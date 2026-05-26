export type VoiceStyle = 'MASCULINA' | 'FEMININA';

export type VoiceConfig = {
  voiceName: string;
  label: string;
};

// Mapeamento de estilo -> voz Azure Neural PT-BR
export const VOICE_CONFIG: Record<VoiceStyle, VoiceConfig> = {
  MASCULINA: { voiceName: 'pt-BR-FabioNeural', label: 'Voz masculina' },
  FEMININA: { voiceName: 'pt-BR-ThalitaNeural', label: 'Voz feminina' },
};

export const VOICE_STYLES: VoiceStyle[] = ['MASCULINA', 'FEMININA'];
