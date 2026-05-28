// Servico de dispatch diario: junta liturgia + roteiro + audios + texto
// adaptado + reflexao e envia pelo WhatsApp.
//
// Mensagens (na ordem):
//   1. Cabecalho com saudacao (☀️) + titulo do dia + cor liturgica
//   2..N. Cada leitura adaptada (📖) - mantem estrutura, texto direto
//   N+1. Audio Onyx (voz masculina)
//   N+2. Audio Nova (voz feminina)
//   final. Reflexao (🕊️)
//
// TTS: usa OpenAI gpt-4o-mini-tts (vozes Onyx e Nova).
// Audios cacheados por data em storage/audios/full/YYYY-MM-DD-{voz}.mp3.
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import pkg from 'whatsapp-web.js';
import type { Client } from 'whatsapp-web.js';

import type { ParsedLiturgy } from '../../domain/liturgy.js';
import { logger } from '../../lib/logger.js';
import { DancrfApiSource } from '../liturgy/dancrfApiSource.js';
import { GroqReflectionService } from '../reflection/groqReflectionService.js';
import { GroqScriptService } from '../script/scriptService.js';
import {
  GroqWhatsappTextService,
  type AdaptedWhatsappTexts,
} from '../script/whatsappTextService.js';
import { OpenAiTtsService } from '../tts/openaiTtsService.js';

const MessageMedia =
  (pkg as { MessageMedia?: typeof pkg.MessageMedia }).MessageMedia ??
  pkg.MessageMedia;

const AUDIO_DIR = path.resolve('storage/audios/full');

// Vozes OpenAI usadas em producao (escolhidas em A/B com Pedro).
const VOICES = [
  { id: 'onyx', label: 'Voz masculina', filename: 'onyx' },
  { id: 'nova', label: 'Voz feminina', filename: 'nova' },
] as const;

// Mapeamento secao -> rotulo e label do JSON adaptado.
const SECTION_DEFS = [
  {
    kind: 'PRIMEIRA_LEITURA' as const,
    label: 'Primeira Leitura',
    field: 'primeira_leitura' as const,
  },
  {
    kind: 'SALMO' as const,
    label: 'Salmo Responsorial',
    field: 'salmo' as const,
  },
  {
    kind: 'SEGUNDA_LEITURA' as const,
    label: 'Segunda Leitura',
    field: 'segunda_leitura' as const,
  },
  { kind: 'EVANGELHO' as const, label: 'Evangelho', field: 'evangelho' as const },
];

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export type DispatchResult = {
  liturgyTitle: string;
  audiosGenerated: number;
  audiosCached: number;
  reflectionTokens: number;
  whatsappTextTokens: number;
  scriptTokens: number;
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

  // 1. Liturgia crua
  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  // 2. Texto adaptado por leitura (para mensagens WhatsApp)
  logger.info('Adaptando leituras para WhatsApp...');
  const whatsappResult = await new GroqWhatsappTextService().generate(liturgy);

  // 3. Roteiro narravel (para os audios)
  logger.info('Gerando roteiro narravel...');
  const scriptResult = await new GroqScriptService().generate(liturgy);

  // 4. Reflexao
  logger.info('Gerando reflexao...');
  const reflection = await new GroqReflectionService().generate(liturgy);

  // 5. Audios (cache por data)
  const tts = new OpenAiTtsService();
  const audioPaths: Record<string, string> = {};
  let audiosGenerated = 0;
  let audiosCached = 0;

  for (const voice of VOICES) {
    const dateStr = liturgy.date.toISOString().slice(0, 10);
    const filePath = path.join(AUDIO_DIR, `${dateStr}-${voice.filename}.mp3`);
    audioPaths[voice.id] = filePath;

    if (existsSync(filePath)) {
      audiosCached++;
      continue;
    }

    logger.info({ voice: voice.id }, 'Sintetizando audio (OpenAI)...');
    const result = await tts.synthesize(scriptResult.script, voice.id);
    await writeFile(filePath, result.audio);
    audiosGenerated++;
  }

  // 6. Enviar pacote
  logger.info({ chatId }, 'Enviando pacote...');
  let messagesSent = 0;
  const send = async (
    content: string | InstanceType<typeof MessageMedia>,
    options?: { sendAudioAsVoice?: boolean },
  ): Promise<void> => {
    await client.sendMessage(chatId, content, options);
    messagesSent++;
  };

  // (a) Cabecalho
  await send(buildHeader(liturgy));
  await delay(1500);

  // (b) Cada leitura adaptada como mensagem propria
  for (const section of SECTION_DEFS) {
    const adapted = whatsappResult.texts[section.field];
    const original = liturgy.sections.find((s) => s.kind === section.kind);
    if (!adapted || !original) continue;

    await send(buildSectionMessage(section.label, original.reference, adapted));
    await delay(1500);
  }

  // (c) Audios (Onyx + Nova)
  for (const voice of VOICES) {
    const audioPath = audioPaths[voice.id];
    if (!audioPath) continue;
    await send(`_${voice.label}:_`);
    await delay(800);
    const media = MessageMedia.fromFilePath(audioPath);
    await send(media, { sendAudioAsVoice: true });
    await delay(2500);
  }

  // (d) Reflexao
  await send(buildReflectionMessage(reflection.content));

  return {
    liturgyTitle: liturgy.title,
    audiosGenerated,
    audiosCached,
    reflectionTokens: reflection.promptTokens + reflection.completionTokens,
    whatsappTextTokens:
      whatsappResult.promptTokens + whatsappResult.completionTokens,
    scriptTokens: scriptResult.promptTokens + scriptResult.completionTokens,
    messagesSent,
    durationMs: Date.now() - t0,
  };
}

// ---------- Builders das mensagens (WhatsApp markdown) ----------

function buildHeader(liturgy: ParsedLiturgy): string {
  const dateStr = liturgy.date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const lines = [
    `☀️ *Bom dia.*`,
    '',
    `*${liturgy.title}*`,
    dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
  ];
  if (liturgy.liturgicalColor) {
    lines.push(`Cor litúrgica: ${liturgy.liturgicalColor}`);
  }
  return lines.join('\n');
}

function buildSectionMessage(
  label: string,
  reference: string,
  text: string,
): string {
  return `📖 *${label}*  _(${reference})_\n\n${text.trim()}`;
}

function buildReflectionMessage(content: string): string {
  return `🕊️ *Reflexão*\n\n${content.trim()}`;
}
