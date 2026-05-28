// Converte um roteiro falado (gerado por IA) em SSML para o Azure Speech.
//
// Filosofia: o roteiro JA e conversacional, com pontuacao rica (virgulas,
// reticencias, pontos). Entao NAO forcamos prosodia agressiva nem emphasis -
// deixamos a pontuacao natural gerar o ritmo, e so adicionamos:
//   - prosodia levemente mais lenta e calorosa (tom de meditacao matinal)
//   - pausas maiores entre paragrafos (trocas de ideia)
//   - micro-pausa apos reticencias (respiracao de quem reflete)

export function narrationScriptToSsml(
  script: string,
  voiceName: string,
): string {
  const paragraphs = script
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const parts: string[] = [];
  parts.push(
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="pt-BR">`,
  );
  parts.push(`<voice name="${esc(voiceName)}">`);
  // Prosodia suave: levemente mais lento, sem exagero (evita soar arrastado)
  parts.push(`<prosody rate="-4%" pitch="-1%">`);

  paragraphs.forEach((para, idx) => {
    parts.push(prepareParagraph(para));
    // Pausa entre paragrafos: troca de ideia merece respiro
    if (idx < paragraphs.length - 1) {
      parts.push('<break time="750ms"/>');
    }
  });

  parts.push('</prosody>');
  parts.push('</voice>');
  parts.push('</speak>');

  return parts.join('\n');
}

// Trata um paragrafo: escapa XML e converte reticencias em micro-pausa
// explicita (algumas vozes nao pausam o suficiente em "...").
function prepareParagraph(text: string): string {
  const escaped = esc(text);
  // Reticencias -> pequena pausa de respiracao (180ms) alem da pontuacao
  return escaped.replace(/\.\.\.|…/g, '…<break time="180ms"/>');
}

// Versao para vozes HD (Dragon HD / HD Omni).
// IMPORTANTE: vozes HD NAO suportam <prosody>, <break>, <emphasis>.
// A naturalidade vem do proprio modelo - so passamos texto limpo em <p>,
// e ajustamos o parametro temperature (variacao/expressividade).
export function narrationScriptToHdSsml(
  script: string,
  voiceName: string,
  temperature = 0.9,
): string {
  const paragraphs = script
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const parts: string[] = [];
  parts.push(
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="pt-BR">`,
  );
  parts.push(
    `<voice name="${esc(voiceName)}" parameters="temperature=${temperature}">`,
  );
  for (const para of paragraphs) {
    parts.push(`<p>${esc(para)}</p>`);
  }
  parts.push('</voice>');
  parts.push('</speak>');

  return parts.join('\n');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
