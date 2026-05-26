// Smoke test: gera 1 mp3 com cada voz para uma frase curta.
// Valida a chave Azure + qualidade das 3 vozes neurais.
import { writeFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { VOICE_CONFIG, VOICE_STYLES } from '../domain/types.js';
import { logger } from '../lib/logger.js';
import { AzureTtsService } from '../services/tts/azureTtsService.js';

const TEST_PHRASE =
  'Domingo de Pentecostes, Solenidade. Refrão: Enviai o vosso Espírito, Senhor, e da terra toda a face renovai.';

const OUTPUT_DIR = path.resolve('storage/audios/smoke');

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const tts = new AzureTtsService();
  logger.info({ chars: TEST_PHRASE.length, output: OUTPUT_DIR }, 'Iniciando smoke do TTS');

  for (const style of VOICE_STYLES) {
    const voice = VOICE_CONFIG[style];
    logger.info({ style, voice: voice.voiceName }, 'Sintetizando...');

    const result = await tts.synthesize(TEST_PHRASE, voice.voiceName);
    const filename = path.join(OUTPUT_DIR, `${style.toLowerCase()}.mp3`);
    await writeFile(filename, result.audio);

    logger.info(
      {
        style,
        file: filename,
        bytes: result.bytes,
        durationMs: result.durationMs,
        kbps: Math.round((result.bytes * 8) / 1000),
      },
      'Audio gerado',
    );
  }

  logger.info('Smoke do TTS concluido. Verifique os arquivos em storage/audios/smoke/');
}

main().catch((err) => {
  logger.error(err, 'Smoke do TTS falhou');
  process.exit(1);
});
