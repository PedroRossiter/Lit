// Smoke: gera o roteiro adaptado e sintetiza em VARIAS vozes HD (Dragon HD Omni)
// do Azure, pra comparar qual soa mais humana. Vozes que falharem (nao
// existirem na regiao) sao puladas com aviso.
//
// Reusa o mesmo roteiro pra todas as vozes (gera Groq 1x so).
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { narrationScriptToHdSsml } from '../domain/script.js';
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqScriptService } from '../services/script/scriptService.js';
import { AzureTtsService } from '../services/tts/azureTtsService.js';

const OUT_DIR = path.resolve('storage/audios/hd-voices');

// Vozes HD candidatas pra pt-BR. Tentamos o set Omni (geracao mais nova).
// Se alguma nao existir na regiao/conta, o Azure da erro e pulamos.
const CANDIDATES: { label: string; voice: string }[] = [
  { label: 'Macerio-HDOmni-masc', voice: 'pt-BR-Macerio:DragonHDOmniLatestNeural' },
  { label: 'Thalita-HDOmni-fem', voice: 'pt-BR-Thalita:DragonHDOmniLatestNeural' },
  { label: 'Antonio-HDOmni-masc', voice: 'pt-BR-Antonio:DragonHDOmniLatestNeural' },
  { label: 'Francisca-HDOmni-fem', voice: 'pt-BR-Francisca:DragonHDOmniLatestNeural' },
];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  logger.info('Gerando roteiro (Groq)...');
  const { script } = await new GroqScriptService().generate(liturgy);
  await writeFile(path.join(OUT_DIR, '_roteiro.txt'), script, 'utf-8');
  logger.info({ chars: script.length }, 'Roteiro pronto');

  const tts = new AzureTtsService();
  const ok: string[] = [];
  const failed: string[] = [];

  for (const { label, voice } of CANDIDATES) {
    try {
      logger.info({ voice }, `Sintetizando ${label}...`);
      const ssml = narrationScriptToHdSsml(script, voice);
      const result = await tts.synthesizeSsml(ssml);
      const out = path.join(OUT_DIR, `${label}.mp3`);
      await writeFile(out, result.audio);
      logger.info(
        { out, sizeMB: (result.bytes / 1024 / 1024).toFixed(2) },
        `OK ${label}`,
      );
      ok.push(label);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ voice, msg }, `FALHOU ${label} (voz pode nao existir)`);
      failed.push(label);
    }
  }

  console.log('');
  console.log('======================================================');
  console.log('  VOZES HD GERADAS');
  console.log('======================================================');
  console.log(`  Pasta: ${OUT_DIR}`);
  console.log(`  OK:     ${ok.join(', ') || '(nenhuma)'}`);
  console.log(`  Falhou: ${failed.join(', ') || '(nenhuma)'}`);
  console.log('');
  console.log('  Ouca os .mp3 e compare com o NOVO-roteiro-adaptado.mp3');
  console.log('  da pasta comparacao/ (que usava a voz Multilingual antiga).');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke de vozes HD');
  process.exit(1);
});
