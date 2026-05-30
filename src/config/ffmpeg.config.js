const ffmpegStatic = require('ffmpeg-static');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

module.exports = {
  ffmpegPath: ffmpegStatic,
  ffprobePath: ffprobeInstaller.path,
  // Encoding preset applied to every output
  encodeOptions: [
    '-c:v libx264',
    '-preset veryfast',
    '-crf 23',
    '-c:a aac',
    '-b:a 128k',
    '-pix_fmt yuv420p',
    '-movflags +faststart',
  ],
};
