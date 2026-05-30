const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { uploadsDir } = require('../config/storage.config');
const { sanitizeFilename } = require('../utils/file.util');
const { logger } = require('../utils/logger.util');

// Move the temp file saved by multer into uploads/<jobId>/ and return job info
async function saveUploadedFile(file) {
  const jobId = uuidv4();
  const jobUploadDir = path.join(uploadsDir, jobId);
  await fs.ensureDir(jobUploadDir);

  const safeFilename = sanitizeFilename(file.originalname);
  const destPath = path.join(jobUploadDir, safeFilename);

  await fs.move(file.path, destPath);

  logger.info(`Upload saved: ${destPath} (job: ${jobId})`);

  return { jobId, inputPath: destPath, originalFilename: file.originalname };
}

module.exports = { saveUploadedFile };
