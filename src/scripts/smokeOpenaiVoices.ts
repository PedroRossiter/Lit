// Smoke: gera o roteiro adaptado e sintetiza em VARIAS vozes OpenAI
// (gpt-4o-mini-tts) com instrucao de tom acolhedor, pra comparar.
// Reusa o mesmo roteiro pra todas (gera Groq 1x so).
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqScriptService } from '../services/script/scriptService.js';
import { OpenAiTtsService } from '../services/tts/openaiTtsService.js';

const OUT_DIR = path.resolve('storage/audios/openai-voices');

// Vozes OpenAI candidatas pra narracao calma/reflexiva.
// (todas funcionam em PT-BR; variam em timbre e genero)
const VOICES = ['onyx', 'sage', 'coral', 'nova', 'ash', 'shimmer'];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  logger.info('Gerando roteiro (Groq)...');
  const { script } = await new GroqScriptService().generate(liturgy);
  await writeFile(path.join(OUT_DIR, '_roteiro.txt'), script, 'utf-8');
  logger.info({ chars: script.length }, 'Roteiro pronto');

  const tts = new OpenAiTtsService();
  const ok: string[] = [];

  for (const voice of VOICES) {
    try {
      logger.info({ voice }, `Sintetizando ${voice}...`);
      const result = await tts.synthesize(script, voice);
      const out = path.join(OUT_DIR, `${voice}.mp3`);
      await writeFile(out, result.audio);
      logger.info(
        { out, sizeMB: (result.bytes / 1024 / 1024).toFixed(2) },
        `OK ${voice}`,
      );
      ok.push(voice);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ voice, msg }, `FALHOU ${voice}`);
    }
  }

  console.log('');
  console.log('======================================================');
  console.log('  VOZES OPENAI GERADAS');
  console.log('======================================================');
  console.log(`  Pasta: ${OUT_DIR}`);
  console.log(`  OK: ${ok.join(', ')}`);
  console.log('');
  console.log('  Ouca todas e me diga qual ficou melhor.');
  console.log('  Compare com a Azure (storage/audios/comparacao/).');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke de vozes OpenAI');
  process.exit(1);
});
