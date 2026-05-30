const multer = require('multer');
const { logger } = require('../utils/logger.util');
const appConfig = require('../config/app.config');

// Centralised error handler — must have 4 params for Express to treat as error middleware
function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error(`Unhandled error: ${err.message}`);

  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `File quá lớn. Giới hạn upload là ${appConfig.maxUploadSizeMb}MB.`
      : `Upload thất bại: ${err.message}`;
    return res.status(400).render('pages/error', { title: 'Lỗi Upload', message: msg });
  }

  if (err.message && err.message.startsWith('Chỉ chấp nhận')) {
    return res.status(400).render('pages/error', { title: 'File không hợp lệ', message: err.message });
  }

  const message = appConfig.isDev ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';
  res.status(500).render('pages/error', { title: 'Lỗi hệ thống', message });
}

module.exports = { errorMiddleware };
