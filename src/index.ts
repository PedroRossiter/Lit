import { env } from './config/env.js';
import { prisma } from './infra/db/client.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV, tz: env.DISPATCH_TZ }, 'Liturgia Pro starting');

  // Sanity check da conexao com o banco
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connected');

  // Cron e jobs sao registrados aqui em fases posteriores.
  logger.info({ cron: env.DISPATCH_CRON }, 'Boot complete - awaiting cron triggers');

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal(err, 'Fatal startup error');
  process.exit(1);
});
