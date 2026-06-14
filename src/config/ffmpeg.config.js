const { execSync } = require("child_process");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
const ffmpeg = require("fluent-ffmpeg");

// Prefer system FFmpeg (compiled with libfreetype → drawtext support).
// Falls back to ffmpeg-static for local dev environments without system ffmpeg.
function resolveFFmpegPath() {
  try {
    const p = execSync("which ffmpeg", {
      stdio: ["pipe", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    if (p) return p;
  } catch {}
  return ffmpegStatic;
}

function resolveFFprobePath() {
  try {
    const p = execSync("which ffprobe", {
      stdio: ["pipe", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    if (p) return p;
  } catch {}
  return ffprobeInstaller.path;
}

const ffmpegPath = resolveFFmpegPath();
const ffprobePath = resolveFFprobePath();
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = {
  ffmpegPath,
  ffprobePath,
  // Encoding preset applied to every output
  encodeOptions: [
    "-c:v libx264",
    "-preset slower",
    "-crf 16",
    "-profile:v high",
    "-level 4.1",
    "-tune film",
    "-x264-params ref=6:bframes=5:b-adapt=2:direct=auto:me=umh:subme=9:trellis=2:rc-lookahead=60:deblock=-1,-1",
    "-pix_fmt yuv420p",
    "-movflags +faststart",
  ],
};
