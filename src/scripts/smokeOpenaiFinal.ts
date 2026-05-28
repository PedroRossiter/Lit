// Smoke final: gera o roteiro com o prompt MELHORADO (texto falado de verdade)
// e sintetiza nas DUAS vozes finalistas (Onyx masc, Nova fem) com a instrucao
// de tom MELHORADA (persona padre 50 anos).
//
// Custo: ~$0.10 do saldo OpenAI por execucao.
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqScriptService } from '../services/script/scriptService.js';
import { OpenAiTtsService } from '../services/tts/openaiTtsService.js';

const OUT_DIR = path.resolve('storage/audios/openai-final');

const VOICES = [
  { name: 'onyx', label: 'masculina (padre maduro)' },
  { name: 'nova', label: 'feminina (clara)' },
];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  logger.info('Gerando roteiro com prompt aprimorado...');
  const { script } = await new GroqScriptService().generate(liturgy);
  await writeFile(path.join(OUT_DIR, '_roteiro-novo.txt'), script, 'utf-8');
  logger.info(
    {
      chars: script.length,
      words: script.split(/\s+/).length,
    },
    'Roteiro pronto',
  );

  const tts = new OpenAiTtsService();
  for (const { name, label } of VOICES) {
    logger.info({ voice: name }, `Sintetizando ${name} (${label})...`);
    const result = await tts.synthesize(script, name);
    const out = path.join(OUT_DIR, `${name}.mp3`);
    await writeFile(out, result.audio);
    logger.info(
      { out, sizeMB: (result.bytes / 1024 / 1024).toFixed(2) },
      `OK ${name}`,
    );
  }

  console.log('');
  console.log('======================================================');
  console.log('  VERSAO FINAL GERADA');
  console.log('======================================================');
  console.log(`  Pasta:  ${OUT_DIR}`);
  console.log('');
  console.log('  Compare com a pasta openai-voices/ pra ver a evolucao.');
  console.log('  Roteiro em texto: _roteiro-novo.txt');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro');
  process.exit(1);
});
