// Smoke A/B: gera o audio da liturgia de hoje de DOIS jeitos, pra comparar:
//   1) ANTIGO: liturgia crua lida palavra por palavra (liturgyToSsml)
//   2) NOVO:   roteiro conversacional adaptado por IA (narrationScriptToSsml)
//
// Salva os dois mp3 + o roteiro em texto em storage/audios/comparacao/.
// Voce ouve os dois lado a lado e decide.
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { liturgyToSsml } from '../domain/liturgy.js';
import { narrationScriptToSsml } from '../domain/script.js';
import { VOICE_CONFIG } from '../domain/types.js';
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqScriptService } from '../services/script/scriptService.js';
import { AzureTtsService } from '../services/tts/azureTtsService.js';

const OUT_DIR = path.resolve('storage/audios/comparacao');

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Voz feminina (Thalita) costuma soar mais acolhedora pra meditacao
  const voice = VOICE_CONFIG.FEMININA.voiceName;

  logger.info('Buscando liturgia do dia...');
  const liturgy = await new DancrfApiSource().fetch();
  logger.info({ title: liturgy.title }, 'Liturgia obtida');

  const tts = new AzureTtsService();

  // === ANTIGO: liturgia crua ===
  logger.info('Gerando audio ANTIGO (liturgia crua)...');
  const oldSsml = liturgyToSsml(liturgy, voice);
  const oldResult = await tts.synthesizeSsml(oldSsml);
  const oldPath = path.join(OUT_DIR, 'ANTIGO-liturgia-crua.mp3');
  await writeFile(oldPath, oldResult.audio);
  logger.info(
    { path: oldPath, sizeMB: (oldResult.bytes / 1024 / 1024).toFixed(2) },
    'Audio ANTIGO salvo',
  );

  // === NOVO: roteiro adaptado ===
  logger.info('Gerando roteiro conversacional via Groq...');
  const scriptResult = await new GroqScriptService().generate(liturgy);
  logger.info(
    {
      words: scriptResult.script.split(/\s+/).length,
      chars: scriptResult.script.length,
      tokens: scriptResult.promptTokens + scriptResult.completionTokens,
    },
    'Roteiro gerado',
  );

  // Salva o roteiro em texto pra voce ler tambem
  const scriptTxtPath = path.join(OUT_DIR, 'NOVO-roteiro.txt');
  await writeFile(scriptTxtPath, scriptResult.script, 'utf-8');

  logger.info('Gerando audio NOVO (roteiro adaptado)...');
  const newSsml = narrationScriptToSsml(scriptResult.script, voice);
  const newResult = await tts.synthesizeSsml(newSsml);
  const newPath = path.join(OUT_DIR, 'NOVO-roteiro-adaptado.mp3');
  await writeFile(newPath, newResult.audio);
  logger.info(
    { path: newPath, sizeMB: (newResult.bytes / 1024 / 1024).toFixed(2) },
    'Audio NOVO salvo',
  );

  console.log('');
  console.log('======================================================');
  console.log('  COMPARACAO PRONTA - ouca os dois arquivos:');
  console.log('======================================================');
  console.log('');
  console.log(`  ANTIGO (liturgia crua):  ${oldPath}`);
  console.log(`  NOVO   (roteiro IA):     ${newPath}`);
  console.log(`  Roteiro em texto:        ${scriptTxtPath}`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke de comparacao');
  process.exit(1);
});
