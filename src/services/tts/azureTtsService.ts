import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export type SynthesisResult = {
  audio: Buffer;
  durationMs: number;
  bytes: number;
};

// Cliente para Azure Cognitive Services Speech (TTS).
// Gera audio mp3 mono 16kHz 32kbps - balanceado para vozes faladas no WhatsApp.
export class AzureTtsService {
  private readonly speechConfig: sdk.SpeechConfig;

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      env.AZURE_SPEECH_KEY,
      env.AZURE_SPEECH_REGION,
    );
    this.speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
  }

  // Sintetiza um texto na voz especificada. Retorna o mp3 como Buffer.
  async synthesize(text: string, voiceName: string): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      // Cria config local para nao mutar a config compartilhada com a voz.
      const config = sdk.SpeechConfig.fromSubscription(
        env.AZURE_SPEECH_KEY,
        env.AZURE_SPEECH_REGION,
      );
      config.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
      config.speechSynthesisVoiceName = voiceName;

      // Passar undefined faz o SDK acumular o audio em memoria em vez de tocar.
      const synthesizer = new sdk.SpeechSynthesizer(config, undefined);
      const t0 = Date.now();

      synthesizer.speakTextAsync(
        text,
        (result) => {
          const durationMs = Date.now() - t0;
          synthesizer.close();

          if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
            const cancellation = sdk.CancellationDetails.fromResult(result);
            const msg = `Azure TTS falhou: ${cancellation.reason} - ${cancellation.errorDetails}`;
            logger.error({ voiceName, msg }, 'Erro na sintese');
            reject(new Error(msg));
            return;
          }

          const audio = Buffer.from(result.audioData);
          logger.debug(
            { voiceName, durationMs, bytes: audio.length, chars: text.length },
            'TTS sintese concluida',
          );
          resolve({ audio, durationMs, bytes: audio.length });
        },
        (err) => {
          synthesizer.close();
          reject(new Error(`Azure TTS erro: ${err}`));
        },
      );
    });
  }
}
