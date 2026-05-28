import OpenAI from 'openai';
import type { ParsedLiturgy } from '../../domain/liturgy.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { withRetry } from '../../lib/retry.js';
import {
  WHATSAPP_TEXT_SYSTEM_PROMPT,
  buildWhatsappTextUserPrompt,
} from './whatsappPrompts.js';

// Mapeamento das leituras adaptadas para WhatsApp. Evangelho sempre presente;
// as demais sao opcionais (varia por dia liturgico).
export type AdaptedWhatsappTexts = {
  primeira_leitura?: string;
  salmo?: string;
  segunda_leitura?: string;
  evangelho: string;
};

export type WhatsappTextResult = {
  texts: AdaptedWhatsappTexts;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
};

// Gera versoes adaptadas (mais curtas e diretas) de cada leitura,
// preservando a estrutura liturgica mas com destaque para as cenas centrais.
export class GroqWhatsappTextService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.model = env.GROQ_MODEL;
  }

  async generate(liturgy: ParsedLiturgy): Promise<WhatsappTextResult> {
    const userPrompt = buildWhatsappTextUserPrompt(liturgy);
    const t0 = Date.now();

    const response = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: WHATSAPP_TEXT_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5, // mais estavel: queremos fidelidade ao texto original
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      {
        maxAttempts: 3,
        onRetry: (attempt, err) =>
          logger.warn({ attempt, err }, 'Retry gerando textos WhatsApp'),
      },
    );

    const durationMs = Date.now() - t0;
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Groq retornou JSON vazio');

    let parsed: AdaptedWhatsappTexts;
    try {
      parsed = JSON.parse(raw) as AdaptedWhatsappTexts;
    } catch (err) {
      throw new Error(`Resposta nao e JSON valido: ${String(err)}`);
    }

    if (!parsed.evangelho) {
      throw new Error('JSON nao contem o Evangelho (obrigatorio)');
    }

    return {
      texts: parsed,
      model: response.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      durationMs,
    };
  }
}
