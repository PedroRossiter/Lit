import OpenAI from 'openai';
import type { ParsedLiturgy } from '../../domain/liturgy.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { withRetry } from '../../lib/retry.js';
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserPrompt } from './prompts.js';

export type ScriptResult = {
  script: string; // roteiro falado, paragrafos separados por linha em branco
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
};

// Gera um roteiro narravel (conversacional) a partir da liturgia crua.
// Reusa Groq (compativel OpenAI) como o GroqReflectionService.
export class GroqScriptService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.model = env.GROQ_MODEL;
  }

  async generate(liturgy: ParsedLiturgy): Promise<ScriptResult> {
    const userPrompt = buildScriptUserPrompt(liturgy);
    const t0 = Date.now();

    const response = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8, // um pouco mais alto: queremos calor e variacao
          max_tokens: 1200,
        }),
      {
        maxAttempts: 3,
        onRetry: (attempt, err) =>
          logger.warn({ attempt, err }, 'Retry gerando roteiro'),
      },
    );

    const durationMs = Date.now() - t0;
    const script = response.choices[0]?.message?.content?.trim();
    if (!script) {
      throw new Error('Groq retornou roteiro vazio');
    }

    return {
      script,
      model: response.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      durationMs,
    };
  }
}
