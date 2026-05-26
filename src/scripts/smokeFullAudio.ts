// Smoke test final: busca liturgia de hoje, gera audio completo nas 2 vozes.
// Objetivo: validar que TTS aguenta texto longo (~3000 chars) sem degradacao.
import { writeFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { liturgyToNarratedText } from '../domain/liturgy.js';
import { VOICE_CONFIG, VOICE_STYLES } from '../domain/types.js';
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { AzureTtsService } from '../services/tts/azureTtsService.js';

const OUTPUT_DIR = path.resolve('storage/audios/full');

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Buscar liturgia
  const source = new DancrfApiSource();
  const liturgy = await source.fetch();
  const narrated = liturgyToNarratedText(liturgy);

  logger.info(
    {
      title: liturgy.title,
      sections: liturgy.sections.length,
      narratedChars: narrated.length,
    },
    'Liturgia obtida',
  );

  // 2. Gerar audio em cada voz (em paralelo)
  const tts = new AzureTtsService();
  logger.info({ vozes: VOICE_STYLES }, 'Sintetizando audio completo...');

  await Promise.all(
    VOICE_STYLES.map(async (style) => {
      const voice = VOICE_CONFIG[style];
      const result = await tts.synthesize(narrated, voice.voiceName);
      const filename = path.join(OUTPUT_DIR, `${style.toLowerCase()}-completa.mp3`);
      await writeFile(filename, result.audio);

      const sizeMB = (result.bytes / 1024 / 1024).toFixed(2);
      const estDurationSec = Math.round(narrated.length / 13);

      logger.info(
        {
          style,
          file: filename,
          sizeMB,
          chars: narrated.length,
          estDurationSec,
          generationSec: (result.durationMs / 1000).toFixed(1),
        },
        'Audio completo gerado',
      );
    }),
  );

  logger.info('Arquivos prontos em storage/audios/full/ - escute para validar.');
}

main().catch((err) => {
  logger.error(err, 'Smoke full audio falhou');
  process.exit(1);
});
