const multer = require('multer');
const path = require('path');
const os = require('os');
const appConfig = require('../config/app.config');
const { ALLOWED_EXTENSION } = require('../constants/video.constants');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload_${Date.now()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ALLOWED_EXTENSION) {
    return cb(new Error(`Chỉ chấp nhận file ${ALLOWED_EXTENSION.toUpperCase()}`), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: appConfig.maxUploadSizeMb * 1024 * 1024 },
});

module.exports = { upload };
