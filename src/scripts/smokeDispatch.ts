// Smoke do dispatch (one-shot): dispara agora, fora do cron.
// Usa o dispatchService que tambem e usado pelo main loop (src/index.ts).
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { dispatchOnce } from '../services/dispatch/dispatchService.js';
import { createWhatsappClient } from '../services/whatsapp/whatsappWebService.js';

async function main(): Promise<void> {
  // --test forca o destino a ser o numero pessoal (WHATSAPP_TEST_NUMBER),
  // ignorando o grupo. Util para revisar mudancas sem impactar o grupo.
  const forceTestNumber = process.argv.includes('--test');

  const groupId =
    !forceTestNumber && env.WHATSAPP_GROUP_ID.endsWith('@g.us')
      ? env.WHATSAPP_GROUP_ID
      : null;
  const testNumber = env.WHATSAPP_TEST_NUMBER;

  if (!groupId && !testNumber) {
    logger.error(
      'Defina WHATSAPP_GROUP_ID (preferencial) ou WHATSAPP_TEST_NUMBER no .env',
    );
    process.exit(1);
  }
  if (forceTestNumber && !testNumber) {
    logger.error('--test exige WHATSAPP_TEST_NUMBER no .env');
    process.exit(1);
  }

  const client = createWhatsappClient();
  const ready = new Promise<void>((resolve, reject) => {
    client.on('ready', () => resolve());
    client.on('auth_failure', (m: string) => reject(new Error(`auth: ${m}`)));
    client.on('qr', () =>
      reject(new Error('Sem sessao - rode `npm run pair` primeiro')),
    );
  });
  logger.info('Conectando WhatsApp...');
  await client.initialize();
  await ready;

  // Resolve destino
  let chatId: string;
  if (groupId) {
    chatId = groupId;
    logger.info({ chatId, mode: 'grupo' }, 'Destino: grupo');
  } else {
    const digits = (testNumber as string).replace(/\D/g, '');
    const numberId = await client.getNumberId(digits);
    if (!numberId) {
      logger.error({ digits }, 'Numero nao tem WhatsApp ativo');
      process.exit(1);
    }
    chatId = numberId._serialized;
    logger.info({ chatId, mode: 'pessoal' }, 'Destino: numero pessoal');
  }

  const result = await dispatchOnce(client, chatId);
  logger.info(result, 'Dispatch concluido');

  setTimeout(() => process.exit(0), 3000);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke dispatch');
  process.exit(1);
});
