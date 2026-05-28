import path from 'node:path';
import pkg from 'whatsapp-web.js';
import { logger } from '../../lib/logger.js';

// whatsapp-web.js exporta tudo via default em CommonJS, mas via tsx/ESM
// alguns nomes ficam em .default. Extraimos com fallback.
const Client = (pkg as { Client?: typeof pkg.Client }).Client ?? pkg.Client;
const LocalAuth =
  (pkg as { LocalAuth?: typeof pkg.LocalAuth }).LocalAuth ?? pkg.LocalAuth;

export type WhatsappClientOptions = {
  dataPath?: string;
};

// Cria cliente whatsapp-web.js controlando Chromium headless.
// Usa o WhatsApp Web oficial - muito menos detectado que Baileys.
export function createWhatsappClient(
  options: WhatsappClientOptions = {},
): InstanceType<typeof Client> {
  const dataPath = options.dataPath ?? path.resolve('.wweb-auth');

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath, clientId: 'liturgia-pro' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  client.on('disconnected', (reason) => {
    logger.warn({ reason }, 'WhatsApp Web desconectou');
  });

  client.on('auth_failure', (msg) => {
    logger.error({ msg }, 'Falha de autenticacao WhatsApp Web');
  });

  return client;
}

// Converte numero (so digitos, ex: "558173347043") em chat ID 1-pra-1.
// whatsapp-web.js usa formato XXXXXX@c.us (diferente de @s.whatsapp.net do Baileys)
export function chatIdFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}
