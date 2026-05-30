require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB) || 200,
  maxConcurrentRenders: parseInt(process.env.MAX_CONCURRENT_RENDERS) || 1,
  cleanupAfterHours: parseInt(process.env.CLEANUP_AFTER_HOURS) || 24,
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
