// Lista todos os grupos onde o bot esta presente, com nome e ID interno.
// Use o ID do grupo desejado e cole no .env como WHATSAPP_GROUP_ID.
import { logger } from '../lib/logger.js';
import { createWhatsappClient } from '../services/whatsapp/whatsappWebService.js';

async function main(): Promise<void> {
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

  const chats = await client.getChats();
  const groups = chats.filter((c) => c.isGroup);

  if (groups.length === 0) {
    logger.warn('O bot nao esta em nenhum grupo ainda.');
    setTimeout(() => process.exit(0), 2000);
    return;
  }

  console.log('');
  console.log('======================================================');
  console.log(`  ${groups.length} GRUPO(S) ENCONTRADO(S)`);
  console.log('======================================================');
  console.log('');

  for (const g of groups) {
    console.log(`Nome:        ${g.name}`);
    console.log(`ID:          ${g.id._serialized}`);
    console.log(`Participantes: ${(g as { participants?: unknown[] }).participants?.length ?? '?'}`);
    console.log('------------------------------------------------------');
  }

  console.log('');
  console.log('Copie o ID do grupo desejado e cole no .env:');
  console.log('  WHATSAPP_GROUP_ID=<ID>');
  console.log('');

  setTimeout(() => process.exit(0), 2000);
}

main().catch((err) => {
  logger.fatal(err, 'Erro listando grupos');
  process.exit(1);
});
