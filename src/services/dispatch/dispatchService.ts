// Servico de dispatch diario: junta liturgia + reflexao + audios e envia
// pelo WhatsApp. Reutilizado pelo smoke (one-shot) e pelo cron (24/7).
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import pkg from 'whatsapp-web.js';
import type { Client } from 'whatsapp-web.js';

import { liturgyToSsml } from '../../domain/liturgy.js';
import type { ParsedLiturgy } from '../../domain/liturgy.js';
import {
  VOICE_CONFIG,
  VOICE_STYLES,
  type VoiceStyle,
} from '../../domain/types.js';
import { logger } from '../../lib/logger.js';
import { DancrfApiSource } from '../liturgy/dancrfApiSource.js';
import { GroqReflectionService } from '../reflection/groqReflectionService.js';
import { AzureTtsService } from '../tts/azureTtsService.js';

const MessageMedia =
  (pkg as { MessageMedia?: typeof pkg.MessageMedia }).MessageMedia ??
  pkg.MessageMedia;

const AUDIO_DIR = path.resolve('storage/audios/full');

const SECTION_LABELS = {
  PRIMEIRA_LEITURA: 'Primeira Leitura',
  SALMO: 'Salmo Responsorial',
  SEGUNDA_LEITURA: 'Segunda Leitura',
  EVANGELHO: 'Evangelho',
} as const;

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export type DispatchResult = {
  liturgyTitle: string;
  audiosGenerated: number; // quantos foram gerados (vs cache)
  audiosCached: number;
  reflectionTokens: number;
  messagesSent: number;
  durationMs: number;
};

// Executa um ciclo completo de dispatch.
// O cliente WhatsApp deve estar conectado (chamou `await client.initialize()`).
// chatId pode ser grupo (...@g.us) ou usuario (...@c.us).
export async function dispatchOnce(
  client: Client,
  chatId: string,
): Promise<DispatchResult> {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  const t0 = Date.now();

  // 1. Liturgia
  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  // 2. Reflexao
  logger.info('Gerando reflexao...');
  const reflection = await new GroqReflectionService().generate(liturgy);

  // 3. Audios (com cache em disco por data)
  const tts = new AzureTtsService();
  const audioPaths = {} as Record<VoiceStyle, string>;
  let audiosGenerated = 0;
  let audiosCached = 0;

  for (const style of VOICE_STYLES) {
    const voice = VOICE_CONFIG[style];
    const dateStr = liturgy.date.toISOString().slice(0, 10);
    const filePath = path.join(AUDIO_DIR, `${dateStr}-${style.toLowerCase()}.mp3`);
    audioPaths[style] = filePath;

    if (existsSync(filePath)) {
      audiosCached++;
      continue;
    }

    logger.info({ style, voice: voice.voiceName }, 'Sintetizando audio...');
    const ssml = liturgyToSsml(liturgy, voice.voiceName);
    const result = await tts.synthesizeSsml(ssml);
    await writeFile(filePath, result.audio);
    audiosGenerated++;
  }

  // 4. Enviar pacote
  logger.info({ chatId }, 'Enviando pacote...');
  let messagesSent = 0;
  const send = async (
    content: string | InstanceType<typeof MessageMedia>,
    options?: { sendAudioAsVoice?: boolean },
  ): Promise<void> => {
    await client.sendMessage(chatId, content, options);
    messagesSent++;
  };

  await send(buildHeader(liturgy));
  await delay(1500);

  await send(formatLiturgyText(liturgy));
  await delay(2000);

  for (const style of VOICE_STYLES) {
    const label = VOICE_CONFIG[style].label;
    await send(`_${label}:_`);
    await delay(800);
    const media = MessageMedia.fromFilePath(audioPaths[style]);
    await send(media, { sendAudioAsVoice: true });
    await delay(2500);
  }

  await send(`*Reflexão*\n\n${reflection.content}`);

  return {
    liturgyTitle: liturgy.title,
    audiosGenerated,
    audiosCached,
    reflectionTokens: reflection.promptTokens + reflection.completionTokens,
    messagesSent,
    durationMs: Date.now() - t0,
  };
}

function buildHeader(liturgy: ParsedLiturgy): string {
  const dateStr = liturgy.date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const lines = [
    '*Bom dia!*',
    '',
    `*${liturgy.title}*`,
    dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
  ];
  if (liturgy.liturgicalColor) {
    lines.push(`Cor litúrgica: ${liturgy.liturgicalColor}`);
  }
  return lines.join('\n');
}

function formatLiturgyText(liturgy: ParsedLiturgy): string {
  const parts: string[] = [];
  for (const section of liturgy.sections) {
    const label = SECTION_LABELS[section.kind];
    parts.push(`*${label}* _(${section.reference})_`);
    parts.push('');
    parts.push(section.text);
    parts.push('');
    parts.push('');
  }
  return parts.join('\n').trim();
}
