import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export type OpenAiSynthesisResult = {
  audio: Buffer;
  durationMs: number;
  bytes: number;
};

// Instrucao de tom padrao para a narracao da liturgia.
// gpt-4o-mini-tts e o unico modelo OpenAI que aceita `instructions`,
// permitindo moldar a entrega da voz (ritmo, calor, intencao).
//
// NOTA: instrucao deliberadamente generica e curta. Em testes A/B, instrucoes
// muito especificas (persona detalhada, gestos forcados) produziram voz que
// soou artificial. O modelo se sai melhor com diretrizes simples.
export const DEFAULT_TTS_INSTRUCTIONS = `Você é um narrador católico brasileiro, com voz calma, acolhedora e reverente.
Leia como uma meditação matinal: ritmo pausado, respirações naturais, calor humano.
Transmita serenidade e fé, sem pressa e sem tom de locutor de rádio.
Pronuncie tudo em português do Brasil, com naturalidade e proximidade.`;

// Cliente TTS via OpenAI (gpt-4o-mini-tts).
// Diferente do Azure: passamos texto puro + instrucao de tom (nao SSML).
export class OpenAiTtsService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY nao definido no .env');
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_TTS_MODEL;
  }

  // Sintetiza texto em audio mp3.
  // voice: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer...
  async synthesize(
    text: string,
    voice: string,
    instructions: string = DEFAULT_TTS_INSTRUCTIONS,
  ): Promise<OpenAiSynthesisResult> {
    const t0 = Date.now();

    const response = await this.client.audio.speech.create({
      model: this.model,
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
    });

    const audio = Buffer.from(await response.arrayBuffer());
    const durationMs = Date.now() - t0;

    logger.debug(
      { voice, chars: text.length, bytes: audio.length, durationMs },
      'OpenAI TTS sintese concluida',
    );

    return { audio, durationMs, bytes: audio.length };
  }
}
