// Smoke test: busca a liturgia de hoje e imprime de forma legivel.
// Rodar com: npm run smoke:liturgy
import { liturgyToNarratedText } from '../domain/liturgy.js';
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';

async function main(): Promise<void> {
  const source = new DancrfApiSource();
  const t0 = Date.now();
  const liturgy = await source.fetch();
  const ms = Date.now() - t0;

  logger.info({ ms }, 'Liturgia obtida');

  const sep = '='.repeat(70);
  console.log(`\n${sep}`);
  console.log(`Titulo: ${liturgy.title}`);
  console.log(`Data:   ${liturgy.date.toISOString().slice(0, 10)}`);
  console.log(`Cor:    ${liturgy.liturgicalColor ?? '(nao informada)'}`);
  console.log(`Fonte:  ${liturgy.sourceName} (${liturgy.sourceUrl})`);
  console.log(`Secoes: ${liturgy.sections.length}`);
  console.log(sep);

  for (const section of liturgy.sections) {
    console.log(`\n--- ${section.kind} (${section.reference}) ---`);
    const preview =
      section.text.length > 400
        ? section.text.slice(0, 400) + `\n... [${section.text.length - 400} chars cortados]`
        : section.text;
    console.log(preview);
  }

  console.log(`\n${sep}`);
  console.log('TEXTO NARRAVEL (input para o TTS):');
  console.log(sep);
  const narrated = liturgyToNarratedText(liturgy);
  console.log(`Total de chars: ${narrated.length}`);
  console.log(`\n[TEXTO COMPLETO]\n${narrated}\n`);
}

main().catch((err) => {
  logger.error(err, 'Smoke test falhou');
  process.exit(1);
});
