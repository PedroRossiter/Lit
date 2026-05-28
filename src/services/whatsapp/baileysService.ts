import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';
import baileysPkg, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';

// Em Baileys 6.x rodando via tsx/ESM, o default export as vezes vem dentro
// de `.default`. Detecta e extrai a funcao certa.
const makeWASocket = (
  typeof baileysPkg === 'function'
    ? baileysPkg
    : (baileysPkg as { default?: typeof baileysPkg }).default
) as typeof baileysPkg;
import pino from 'pino';
import { logger } from '../../lib/logger.js';

// Logger silencioso para o Baileys (e MUITO verboso por padrao)
const baileysLogger = pino({ level: 'silent' });

export type BaileysOptions = {
  authDir?: string;       // pasta para persistir credenciais
  printQR?: boolean;      // imprime QR no console (fallback)
};

// Cria socket Baileys com auth persistido em filesystem.
// Para producao vale migrar para auth state custom em Postgres.
export async function createBaileys(options: BaileysOptions = {}): Promise<WASocket> {
  const authDir = options.authDir ?? path.resolve('.baileys');
  if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info({ wa: version.join('.'), isLatest, authDir }, 'Conectando Baileys');

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS('Liturgia Pro'),
    logger: baileysLogger,
    printQRInTerminal: options.printQR ?? false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  return sock;
}

// Promise que resolve quando o socket abre, ou rejeita em erro de conexao.
// Util para scripts (pareamento, smoke).
export function waitForConnection(sock: WASocket): Promise<void> {
  return new Promise((resolve, reject) => {
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        logger.info('Baileys conectado');
        resolve();
        return;
      }

      if (connection === 'close') {
        const code =
          (lastDisconnect?.error as Boom | undefined)?.output?.statusCode ?? 0;
        if (code === DisconnectReason.loggedOut) {
          logger.error('Sessao foi deslogada pelo WhatsApp - precisa parear de novo');
          reject(new Error('logged out'));
          return;
        }
        // Outras causas: pode ser reconectavel. Quem chama decide.
        logger.warn({ code }, 'Conexao Baileys fechou');
      }
    });
  });
}

// Converte numero (so digitos, ex: "5511999999999") em JID 1-pra-1.
export function jidFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}
