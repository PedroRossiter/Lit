// Smoke test: usa sessao Baileys ja pareada e envia uma mensagem teste.
// Pre-requisito: ter rodado `npm run pair` antes e que a pasta .baileys/
// tenha credenciais validas.
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  createBaileys,
  jidFromPhone,
  waitForConnection,
} from '../services/whatsapp/baileysService.js';

async function main(): Promise<void> {
  const testNumber = env.WHATSAPP_TEST_NUMBER;
  if (!testNumber) {
    logger.error('WHATSAPP_TEST_NUMBER nao definido no .env. Use seu numero pessoal (so digitos com DDI, ex: 5511999999999).');
    process.exit(1);
  }

  const sock = await createBaileys();

  if (!sock.authState.creds.registered) {
    logger.error('Bot nao esta pareado. Rode `npm run pair` primeiro.');
    process.exit(1);
  }

  logger.info('Aguardando conexao...');
  await waitForConnection(sock);

  const jid = jidFromPhone(testNumber);
  const message =
    'Ola! Aqui e o Liturgia Pro, em fase de teste. ' +
    'Se voce esta recebendo isso, o bot esta funcionando :)';

  logger.info({ jid }, 'Enviando mensagem teste...');
  await sock.sendMessage(jid, { text: message });
  logger.info('Mensagem enviada com sucesso!');

  // Encerra apos 2s pra garantir delivery
  setTimeout(() => process.exit(0), 2000);
}

main().catch((err) => {
  logger.fatal(err, 'Erro no smoke do WhatsApp');
  process.exit(1);
});
