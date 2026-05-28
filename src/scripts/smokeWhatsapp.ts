// Smoke test: usa sessao whatsapp-web.js ja pareada e envia mensagem teste.
// Pre-requisito: ter rodado `npm run pair` antes e que a pasta .wweb-auth/
// tenha credenciais validas.
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  chatIdFromPhone,
  createWhatsappClient,
} from '../services/whatsapp/whatsappWebService.js';

async function main(): Promise<void> {
  const testNumber = env.WHATSAPP_TEST_NUMBER;
  if (!testNumber) {
    logger.error(
      'WHATSAPP_TEST_NUMBER nao definido no .env. Use seu numero pessoal (so digitos com DDI).',
    );
    process.exit(1);
  }

  const client = createWhatsappClient();

  const ready = new Promise<void>((resolve, reject) => {
    client.on('ready', () => resolve());
    client.on('auth_failure', (msg: string) => reject(new Error(`auth: ${msg}`)));
    client.on('qr', () => {
      reject(new Error('Sem sessao valida - rode `npm run pair` primeiro'));
    });
  });

  logger.info('Inicializando cliente...');
  await client.initialize();
  await ready;

  // Normaliza numero -> WhatsApp ID interno (resolve LID quando necessario)
  const digits = testNumber.replace(/\D/g, '');
  const numberId = await client.getNumberId(digits);
  if (!numberId) {
    logger.error({ digits }, 'Numero nao tem WhatsApp ativo');
    process.exit(1);
  }

  const message =
    'Ola! Aqui e o Liturgia Pro, em fase de teste. ' +
    'Se voce esta recebendo isso, o bot esta funcionando :)';

  logger.info({ chatId: numberId._serialized }, 'Enviando mensagem teste...');
  await client.sendMessage(numberId._serialized, message);
  logger.info('Mensagem enviada com sucesso!');

  setTimeout(() => process.exit(0), 3000);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke do WhatsApp');
  process.exit(1);
});
