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

  // Sintetiza texto puro (voz definida no parametro).
  async synthesize(text: string, voiceName: string): Promise<SynthesisResult> {
    return this.run((synth) => synth.speakTextAsync.bind(synth), text, {
      voiceName,
      charCount: text.length,
    });
  }

  // Sintetiza SSML (voz definida dentro do proprio SSML em <voice name=...>).
  async synthesizeSsml(ssml: string): Promise<SynthesisResult> {
    return this.run((synth) => synth.speakSsmlAsync.bind(synth), ssml, {
      voiceName: 'ssml',
      charCount: ssml.length,
    });
  }

  private run(
    methodGetter: (
      synth: sdk.SpeechSynthesizer,
    ) => (
      input: string,
      onSuccess: (r: sdk.SpeechSynthesisResult) => void,
      onError: (err: string) => void,
    ) => void,
    input: string,
    meta: { voiceName: string; charCount: number },
  ): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      const config = sdk.SpeechConfig.fromSubscription(
        env.AZURE_SPEECH_KEY,
        env.AZURE_SPEECH_REGION,
      );
      config.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
      if (meta.voiceName !== 'ssml') {
        config.speechSynthesisVoiceName = meta.voiceName;
      }

      const synthesizer = new sdk.SpeechSynthesizer(config, undefined);
      const t0 = Date.now();
      const method = methodGetter(synthesizer);

      method(
        input,
        (result) => {
          const durationMs = Date.now() - t0;
          synthesizer.close();

          if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
            const cancellation = sdk.CancellationDetails.fromResult(result);
            const msg = `Azure TTS falhou: ${cancellation.reason} - ${cancellation.errorDetails}`;
            logger.error({ ...meta, msg }, 'Erro na sintese');
            reject(new Error(msg));
            return;
          }

          const audio = Buffer.from(result.audioData);
          logger.debug(
            { ...meta, durationMs, bytes: audio.length },
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
