import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().url(),

  DISPATCH_CRON: z.string().default('0 5 * * *'),
  DISPATCH_TZ: z.string().default('America/Sao_Paulo'),

  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  AZURE_SPEECH_KEY: z.string().min(1),
  AZURE_SPEECH_REGION: z.string().min(1),

  // OpenAI - usado para TTS (gpt-4o-mini-tts). Opcional ate migrarmos a voz.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),

  WHATSAPP_GROUP_ID: z.string().min(1),
  WHATSAPP_ADMIN_NUMBER: z.string().min(1),
  // Numero do chip do bot (Claro), usado no pareamento. So digitos com DDI.
  // Ex: "5511999999999"
  WHATSAPP_BOT_NUMBER: z.string().optional(),
  // Numero pessoal do dono do bot para smoke test de envio.
  WHATSAPP_TEST_NUMBER: z.string().optional(),

  AUDIO_STORAGE_PATH: z.string().default('./storage/audios'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env: Env = parsed.data;
