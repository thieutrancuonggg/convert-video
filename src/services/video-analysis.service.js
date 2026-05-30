// Ensures ffmpeg/ffprobe paths are set before any call
require('../config/ffmpeg.config');

const ffmpeg = require('fluent-ffmpeg');
const { TARGET_WIDTH, TARGET_HEIGHT, MAX_DURATION_WARN } = require('../constants/video.constants');

function analyzeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`FFprobe lỗi: ${err.message}`));

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

      if (!videoStream) {
        return reject(new Error('File không chứa video stream'));
      }

      const width = videoStream.width;
      const height = videoStream.height;
      const duration = parseFloat(metadata.format.duration) || 0;
      const bitrate = parseInt(metadata.format.bit_rate) || 0;
      const hasAudio = !!audioStream;

      // 9:16 check with small tolerance
      const isNineToSixteen = Math.abs(width / height - 9 / 16) < 0.02;

      const warnings = [];
      if (duration > MAX_DURATION_WARN) {
        warnings.push(
          `Video dài ${Math.round(duration)} giây (khuyến nghị dưới ${MAX_DURATION_WARN}s cho TikTok Affiliate)`
        );
      }
      if (!isNineToSixteen) {
        warnings.push(
          `Video không phải tỷ lệ 9:16 (${width}×${height}) — hệ thống sẽ tự scale+pad về ${TARGET_WIDTH}×${TARGET_HEIGHT}`
        );
      }

      resolve({ width, height, duration, bitrate, hasAudio, isNineToSixteen, warnings });
    });
  });
}

module.exports = { analyzeVideo };
