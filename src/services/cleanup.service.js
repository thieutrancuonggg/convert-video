const { getOldJobDirs, removeDir } = require('../utils/file.util');
const { uploadsDir, outputsDir } = require('../config/storage.config');
const appConfig = require('../config/app.config');
const { logger } = require('../utils/logger.util');

async function cleanupOldFiles() {
  const hours = appConfig.cleanupAfterHours;
  let removed = 0;

  const dirs = [
    ...(await getOldJobDirs(uploadsDir, hours)),
    ...(await getOldJobDirs(outputsDir, hours)),
  ];

  for (const dir of dirs) {
    await removeDir(dir);
    logger.info(`Cleaned up: ${dir}`);
    removed++;
  }

  if (removed > 0) {
    logger.info(`Cleanup done — removed ${removed} old job directories`);
  }
}

module.exports = { cleanupOldFiles };
