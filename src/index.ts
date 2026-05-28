// Main loop do servico em producao.
// Mantem o WhatsApp Web conectado 24/7 e dispara o pacote diario
// no horario configurado em DISPATCH_CRON / DISPATCH_TZ.
import cron from 'node-cron';

import { env } from './config/env.js';
import { prisma } from './infra/db/client.js';
import { logger } from './lib/logger.js';
import { dispatchOnce } from './services/dispatch/dispatchService.js';
import { createWhatsappClient } from './services/whatsapp/whatsappWebService.js';
import type { Client } from 'whatsapp-web.js';

let client: Client | null = null;
let cronTask: ReturnType<typeof cron.schedule> | null = null;
let isDispatching = false; // evita execucoes sobrepostas

async function main(): Promise<void> {
  logger.info(
    { tz: env.DISPATCH_TZ, schedule: env.DISPATCH_CRON },
    'Liturgia Pro - iniciando main loop',
  );

  // 1. Sanity check do banco
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database conectada');

  // 2. Resolve destino (grupo > test number)
  const chatId = resolveChatId();
  if (!chatId.serialized && !chatId.pendingResolve) {
    logger.fatal('Sem destino configurado. Defina WHATSAPP_GROUP_ID ou WHATSAPP_TEST_NUMBER.');
    process.exit(1);
  }

  // 3. Sobe cliente WhatsApp e mantem conectado
  client = createWhatsappClient();
  const ready = new Promise<void>((resolve, reject) => {
    client!.on('ready', () => resolve());
    client!.on('auth_failure', (m: string) =>
      reject(new Error(`auth_failure: ${m}`)),
    );
    client!.on('qr', () =>
      reject(new Error('Sem sessao - rode `npm run pair` primeiro')),
    );
  });

  logger.info('Conectando WhatsApp Web...');
  await client.initialize();
  await ready;
  logger.info('WhatsApp conectado');

  // Se destino e numero pessoal, resolve via getNumberId agora que cliente esta vivo
  if (chatId.pendingResolve) {
    const numberId = await client.getNumberId(chatId.pendingResolve);
    if (!numberId) {
      logger.fatal({ digits: chatId.pendingResolve }, 'Numero nao tem WhatsApp');
      process.exit(1);
    }
    chatId.serialized = numberId._serialized;
  }

  logger.info(
    { chatId: chatId.serialized, mode: chatId.mode },
    'Destino resolvido',
  );

  // 4. Registra cron
  cronTask = cron.schedule(
    env.DISPATCH_CRON,
    () => void runDispatch(chatId.serialized!),
    { timezone: env.DISPATCH_TZ },
  );
  logger.info(
    { next: 'aguardando proximo trigger conforme cron' },
    'Cron registrado',
  );

  // 5. Signal handlers
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Mantem vivo
  await new Promise(() => {});
}

async function runDispatch(chatId: string): Promise<void> {
  if (isDispatching) {
    logger.warn('Dispatch ja em execucao, pulando trigger');
    return;
  }
  if (!client) {
    logger.error('Cliente WhatsApp nao inicializado');
    return;
  }

  isDispatching = true;
  try {
    logger.info('Cron disparou - iniciando dispatch');
    const result = await dispatchOnce(client, chatId);
    logger.info(result, 'Dispatch concluido com sucesso');
  } catch (err) {
    logger.error({ err }, 'Falha no dispatch');
  } finally {
    isDispatching = false;
  }
}

type ResolvedChatId = {
  serialized: string | null;
  mode: 'grupo' | 'pessoal';
  pendingResolve: string | null; // digitos a resolver via getNumberId
};

function resolveChatId(): ResolvedChatId {
  if (env.WHATSAPP_GROUP_ID.endsWith('@g.us')) {
    return {
      serialized: env.WHATSAPP_GROUP_ID,
      mode: 'grupo',
      pendingResolve: null,
    };
  }
  const test = env.WHATSAPP_TEST_NUMBER;
  if (test) {
    return {
      serialized: null,
      mode: 'pessoal',
      pendingResolve: test.replace(/\D/g, ''),
    };
  }
  return { serialized: null, mode: 'pessoal', pendingResolve: null };
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Encerrando');
  cronTask?.stop();
  try {
    await client?.destroy();
  } catch (err) {
    logger.warn({ err }, 'Erro ao fechar cliente WhatsApp');
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Erro fatal no main loop');
  process.exit(1);
});
