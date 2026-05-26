// Smoke test: busca liturgia de hoje, gera reflexao via Groq, imprime.
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqReflectionService } from '../services/reflection/groqReflectionService.js';

async function main(): Promise<void> {
  // 1. Buscar liturgia
  const source = new DancrfApiSource();
  const liturgy = await source.fetch();
  logger.info(
    { title: liturgy.title, color: liturgy.liturgicalColor, sections: liturgy.sections.length },
    'Liturgia obtida',
  );

  // 2. Gerar reflexao
  const service = new GroqReflectionService();
  logger.info('Gerando reflexao via Groq...');
  const result = await service.generate(liturgy);

  // 3. Imprimir
  const sep = '='.repeat(70);
  console.log(`\n${sep}`);
  console.log(`Modelo: ${result.model}`);
  console.log(`Tokens: ${result.promptTokens} in / ${result.completionTokens} out`);
  console.log(`Latencia: ${result.durationMs}ms`);
  console.log(sep);
  console.log('\nREFLEXAO:\n');
  console.log(result.content);
  console.log(`\n${sep}`);
}

main().catch((err) => {
  logger.error(err, 'Smoke reflexao falhou');
  process.exit(1);
});
