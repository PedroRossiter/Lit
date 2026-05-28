// Script de pareamento Baileys via QR code (salvo como PNG).
//
// Fluxo:
//   1. Conecta socket Baileys
//   2. Baileys emite QR via evento connection.update
//   3. Salva QR como ./qr.png (sobrescreve a cada novo QR - WhatsApp regenera ~30s)
//   4. Usuario abre o arquivo qr.png no Explorer
//   5. WhatsApp do bot > Aparelhos Conectados > Conectar > aponta camera pra tela
//   6. Conexao abre, credencial e salva, script termina
import path from 'node:path';
import QRCode from 'qrcode';
import { logger } from '../lib/logger.js';
import { createBaileys } from '../services/whatsapp/baileysService.js';

const QR_FILE = path.resolve('qr.png');

async function main(): Promise<void> {
  const sock = await createBaileys();

  if (sock.authState.creds.registered) {
    logger.info('Bot ja esta pareado. Aguardando conexao...');
  }

  let qrCount = 0;

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrCount++;
      // Gera PNG grande (~400px), borda larga, alta qualidade pra scanner
      await QRCode.toFile(QR_FILE, qr, {
        width: 480,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      console.log('');
      console.log('======================================================');
      console.log(`  QR CODE #${qrCount} GERADO (expira em ~30s)`);
      console.log('======================================================');
      console.log('');
      console.log(`  Arquivo: ${QR_FILE}`);
      console.log('');
      console.log('  No celular do bot:');
      console.log('  1. WhatsApp > Menu > Aparelhos Conectados');
      console.log('  2. Conectar um aparelho');
      console.log('  3. Aponte a camera para o QR aberto na tela');
      console.log('');
    }

    if (connection === 'open') {
      logger.info('Pareamento concluido com sucesso!');
      logger.info('Credenciais salvas em .baileys/. Pode rodar smoke:whatsapp agora.');
      setTimeout(() => process.exit(0), 2000);
    }

    if (connection === 'close') {
      const reason = update.lastDisconnect?.error?.message ?? 'desconhecido';
      logger.warn({ reason }, 'Conexao fechou');
    }
  });

  await new Promise(() => {});
}

main().catch((err) => {
  logger.fatal(err, 'Erro no pareamento');
  process.exit(1);
});
