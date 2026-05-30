const { analyzeVideo } = require('../services/video-analysis.service');
const { logger } = require('../utils/logger.util');

async function validateVideo(req, res, next) {
  if (!req.file) {
    return res.status(400).render('pages/error', {
      title: 'Upload thất bại',
      message: 'Không nhận được file nào. Vui lòng chọn file MP4 và thử lại.',
    });
  }

  try {
    const videoInfo = await analyzeVideo(req.file.path);
    req.videoInfo = videoInfo;
    next();
  } catch (err) {
    logger.error('Video validation failed:', err.message);
    return res.status(400).render('pages/error', {
      title: 'File không hợp lệ',
      message: `Không thể đọc video: ${err.message}`,
    });
  }
}

module.exports = { validateVideo };
