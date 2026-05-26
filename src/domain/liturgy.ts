// Tipos de secao reconhecidos numa liturgia.
// PRIMEIRA_LEITURA -> Antigo Testamento (ou Atos, em tempo pascal)
// SALMO            -> Salmo Responsorial
// SEGUNDA_LEITURA  -> Carta apostolica (so domingos/solenidades)
// EVANGELHO        -> Evangelho do dia
export type SectionKind =
  | 'PRIMEIRA_LEITURA'
  | 'SALMO'
  | 'SEGUNDA_LEITURA'
  | 'EVANGELHO';

export type LiturgySection = {
  kind: SectionKind;
  reference: string; // ex: "At 2,1-11"
  text: string;      // texto plano, sem HTML, formatado para leitura
};

export type LiturgicalColor = 'Verde' | 'Vermelho' | 'Roxo' | 'Rosa' | 'Branco';

export type ParsedLiturgy = {
  date: Date;                          // data da liturgia (00:00 local)
  title: string;                       // ex: "Domingo de Pentecostes, Solenidade"
  liturgicalColor?: LiturgicalColor;   // cor liturgica do dia (opcional)
  sourceUrl: string;                   // URL/endpoint de origem
  sourceName: string;                  // ex: "dancrf-v2"
  sections: LiturgySection[];
};

// Helper: junta todas as secoes num unico texto narravel pelo TTS.
// Aplica limpezas para evitar que o TTS leia numeros de versiculo etc.
export function liturgyToNarratedText(liturgy: ParsedLiturgy): string {
  const parts: string[] = [];
  parts.push(`${liturgy.title}.`);
  parts.push('');

  for (const section of liturgy.sections) {
    parts.push(sectionTitle(section.kind, section.reference));
    parts.push('');
    parts.push(cleanForNarration(section.text));
    parts.push('');
  }

  return parts.join('\n').trim();
}

// Texto da API tem numeros de versiculo grudados ("lugar. 2De repente").
// Para TTS, removemos numeros isolados que precedem texto, normalizamos
// travessoes e espacos.
export function cleanForNarration(text: string): string {
  return (
    text
      // Subversiculo "3b" seguido de MAIUSCULA (ex: "3bNinguem"): remove os dois.
      .replace(/([\s.,;:!?]|^)\d{1,3}[a-d](?=\p{Lu})/gu, '$1')
      // Numero de versiculo sozinho grudado em palavra (ex: "2De", "10da", ".21Novamente"): remove o numero.
      .replace(/([\s.,;:!?]|^)\d{1,3}(?=\p{L})/gu, '$1')
      // Garante espaco apos pontuacao colada a letra maiuscula ("Senhor.Novamente")
      .replace(/([.,;:!?])(\p{Lu})/gu, '$1 $2')
      // Travessoes como inicio de fala
      .replace(/^[—–\-]\s*/gm, '')
      // Aspas tipograficas -> retas
      .replace(/[“”]/g, '"')
      // Espacos / newlines duplicados
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function sectionTitle(kind: SectionKind, reference: string): string {
  const labels: Record<SectionKind, string> = {
    PRIMEIRA_LEITURA: 'Primeira Leitura',
    SALMO: 'Salmo Responsorial',
    SEGUNDA_LEITURA: 'Segunda Leitura',
    EVANGELHO: 'Evangelho',
  };
  return `${labels[kind]}. ${reference}.`;
}
