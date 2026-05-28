// Smoke: gera APENAS o texto adaptado das leituras e imprime no console
// como apareceria no WhatsApp. Nao gera audio nem manda mensagem.
// Util para revisar o formato antes de mandar pro grupo de verdade.
import { logger } from '../lib/logger.js';
import { DancrfApiSource } from '../services/liturgy/dancrfApiSource.js';
import { GroqWhatsappTextService } from '../services/script/whatsappTextService.js';

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

async function main(): Promise<void> {
  logger.info('Buscando liturgia...');
  const liturgy = await new DancrfApiSource().fetch();

  logger.info('Adaptando para WhatsApp...');
  const { texts, promptTokens, completionTokens, durationMs } =
    await new GroqWhatsappTextService().generate(liturgy);

  console.log('');
  console.log('========== PREVIEW DAS MENSAGENS WHATSAPP ==========');
  console.log('');

  // 1. Cabecalho
  const dateStr = liturgy.date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  console.log('---[ mensagem 1: cabecalho ]---');
  console.log(`☀️ *Bom dia.*\n`);
  console.log(`*${liturgy.title}*`);
  console.log(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
  if (liturgy.liturgicalColor) {
    console.log(`Cor litúrgica: ${liturgy.liturgicalColor}`);
  }
  console.log('');

  // 2..N: leituras adaptadas
  let msgN = 2;
  for (const section of SECTION_DEFS) {
    const adapted = texts[section.field];
    const original = liturgy.sections.find((s) => s.kind === section.kind);
    if (!adapted || !original) continue;

    console.log(`---[ mensagem ${msgN}: ${section.label} ]---`);
    console.log(`📖 *${section.label}*  _(${original.reference})_`);
    console.log('');
    console.log(adapted.trim());
    console.log('');
    msgN++;
  }

  console.log(`---[ mensagem ${msgN}: rotulo voz masculina ]---`);
  console.log('_Voz masculina:_');
  console.log('');
  console.log(`---[ mensagem ${msgN + 1}: audio Onyx ]---`);
  console.log('[audio mp3]');
  console.log('');
  console.log(`---[ mensagem ${msgN + 2}: rotulo voz feminina ]---`);
  console.log('_Voz feminina:_');
  console.log('');
  console.log(`---[ mensagem ${msgN + 3}: audio Nova ]---`);
  console.log('[audio mp3]');
  console.log('');
  console.log(`---[ mensagem ${msgN + 4}: reflexao ]---`);
  console.log('🕊️ *Reflexão*');
  console.log('');
  console.log('[texto da reflexao IA]');
  console.log('');

  console.log('====================================================');
  console.log(
    `tokens Groq: ${promptTokens + completionTokens} | tempo: ${durationMs}ms`,
  );
  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro');
  process.exit(1);
});
