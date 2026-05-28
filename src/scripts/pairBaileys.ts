// Script de pareamento WhatsApp Web (via whatsapp-web.js).
//
// Fluxo:
//   1. Inicializa cliente (sobe Chromium headless)
//   2. Cliente emite QR no evento 'qr'
//   3. Mostra QR ASCII no terminal + salva PNG (.qrcode-esse.png)
//   4. Usuario escaneia com WhatsApp do bot
//   5. Evento 'ready' indica conexao concluida
//   6. Sessao salva em .wweb-auth/
import path from 'node:path';
import QRCode from 'qrcode';
// @ts-expect-error - qrcode-terminal nao tem types
import qrTerminal from 'qrcode-terminal';
import { logger } from '../lib/logger.js';
import { createWhatsappClient } from '../services/whatsapp/whatsappWebService.js';

const QR_FILE = path.resolve('qrcode-esse.png');

async function main(): Promise<void> {
  const client = createWhatsappClient();

  let qrCount = 0;

  client.on('qr', async (qr: string) => {
    qrCount++;
    await QRCode.toFile(QR_FILE, qr, {
      width: 480,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    console.log('');
    console.log('======================================================');
    console.log(`  QR CODE #${qrCount} (expira em ~60s)`);
    console.log('======================================================');
    console.log('');
    qrTerminal.generate(qr, { small: true });
    console.log('');
    console.log(`  Backup PNG: ${QR_FILE}`);
    console.log('');
    console.log('  No celular do bot:');
    console.log('  1. WhatsApp > Menu > Aparelhos Conectados > Conectar');
    console.log('  2. Aponte a camera para o QR acima');
    console.log('');
  });

  client.on('authenticated', () => {
    logger.info('Autenticado com sucesso! Aguardando ready...');
  });

  client.on('ready', async () => {
    logger.info('Pareamento concluido! Aguardando sincronizacao completa...');
    // Aguarda 15s para o whatsapp-web.js terminar de sincronizar Local Storage
    // e IndexedDB (caso contrario a sessao salva fica incompleta e o smoke
    // pede QR de novo)
    await new Promise((r) => setTimeout(r, 15000));
    logger.info('Sessao salva em .wweb-auth/. Encerrando.');
    await client.destroy();
    process.exit(0);
  });

  client.on('auth_failure', (msg: string) => {
    logger.error({ msg }, 'Falha de autenticacao');
    process.exit(1);
  });

  logger.info('Inicializando cliente WhatsApp Web (subindo Chromium)...');
  await client.initialize();
}

main().catch((err) => {
  logger.fatal(err, 'Erro no pareamento');
  process.exit(1);
});
