import OpenAI from 'openai';
import type { ParsedLiturgy } from '../../domain/liturgy.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { withRetry } from '../../lib/retry.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

export type ReflectionResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
};

// Cliente para gerar reflexao via Groq.
// Groq expoe API compativel com OpenAI, entao reusamos o SDK oficial mudando baseURL.
export class GroqReflectionService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.model = env.GROQ_MODEL;
  }

  async generate(liturgy: ParsedLiturgy): Promise<ReflectionResult> {
    const userPrompt = buildUserPrompt(liturgy);
    const t0 = Date.now();

    const response = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 600,
          // sem top_p, presence_penalty etc - defaults sao adequados
        }),
      {
        maxAttempts: 3,
        onRetry: (attempt, err) =>
          logger.warn({ attempt, err }, 'Retry gerando reflexao'),
      },
    );

    const durationMs = Date.now() - t0;
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Groq retornou resposta vazia');
    }

    return {
      content,
      model: response.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      durationMs,
    };
  }
}
