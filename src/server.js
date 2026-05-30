require('dotenv').config();

const app = require('./app');
const appConfig = require('./config/app.config');
const { uploadsDir, outputsDir } = require('./config/storage.config');
const { ensureDir } = require('./utils/file.util');
const { cleanupOldFiles } = require('./services/cleanup.service');
const { logger } = require('./utils/logger.util');

async function bootstrap() {
  // Ensure required directories exist
  await ensureDir(uploadsDir);
  await ensureDir(outputsDir);

  // Clean up files older than configured threshold
  await cleanupOldFiles();

  app.listen(appConfig.port, () => {
    logger.info(`─────────────────────────────────────────`);
    logger.info(` TikTok Affiliate Tool running`);
    logger.info(` URL   : http://localhost:${appConfig.port}`);
    logger.info(` Env   : ${appConfig.nodeEnv}`);
    logger.info(` Upload: max ${appConfig.maxUploadSizeMb} MB`);
    logger.info(` Queue : max ${appConfig.maxConcurrentRenders} concurrent render(s)`);
    logger.info(`─────────────────────────────────────────`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});
