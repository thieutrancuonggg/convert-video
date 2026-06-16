// Ensures ffmpeg/ffprobe paths are set before any call
require("../config/ffmpeg.config");

const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const { ffmpegPath } = require("../config/ffmpeg.config");
const {
  TARGET_WIDTH,
  TARGET_HEIGHT,
  MAX_DURATION_WARN,
} = require("../constants/video.constants");

function analyzeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`FFprobe lỗi: ${err.message}`));

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
      );
      const audioStream = metadata.streams.find(
        (s) => s.codec_type === "audio",
      );

      if (!videoStream) {
        return reject(new Error("File không chứa video stream"));
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
          `Video dài ${Math.round(duration)} giây (khuyến nghị dưới ${MAX_DURATION_WARN}s cho TikTok Affiliate)`,
        );
      }
      if (!isNineToSixteen) {
        warnings.push(
          `Video không phải tỷ lệ 9:16 (${width}×${height}) — hệ thống sẽ tự scale+pad về ${TARGET_WIDTH}×${TARGET_HEIGHT}`,
        );
      }
      if (width < TARGET_WIDTH || height < TARGET_HEIGHT) {
        warnings.push(
          `Video gốc chỉ ${width}×${height}; xuất ${TARGET_WIDTH}×${TARGET_HEIGHT} sẽ phải upscale nên độ nét phụ thuộc nhiều vào file gốc`,
        );
      }
      if (bitrate > 0 && bitrate < 4000000) {
        warnings.push(
          `Bitrate gốc khoảng ${(bitrate / 1000000).toFixed(1)} Mbps, khá thấp cho video dọc 1080p; nên dùng nguồn 8–15 Mbps nếu có`,
        );
      }

      resolve({
        width,
        height,
        duration,
        bitrate,
        hasAudio,
        isNineToSixteen,
        warnings,
      });
    });
  });
}

function findHookSegment(filePath, duration, hookDuration = 1.5) {
  if (duration <= hookDuration + 1) {
    return Promise.resolve(null);
  }

  const scanStart = Math.max(1, duration * 0.25);
  const scanEnd = Math.min(duration - hookDuration, duration * 0.8);

  if (scanEnd - scanStart <= 0.5) {
    return Promise.resolve({
      start: Math.max(0, (duration - hookDuration) / 2),
      duration: hookDuration,
      score: null,
    });
  }

  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "info",
      "-i",
      filePath,
      "-vf",
      `select='between(t\\,${scanStart.toFixed(3)}\\,${scanEnd.toFixed(3)})*gt(scene\\,0.08)',metadata=print:key=lavfi.scene_score`,
      "-an",
      "-f",
      "null",
      "-",
    ];
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", () => {
      resolve(null);
    });

    child.on("close", () => {
      const matches = [
        ...stderr.matchAll(
          /pts_time:([0-9.]+)[\s\S]*?lavfi\.scene_score=([0-9.]+)/g,
        ),
      ];

      const candidates = matches
        .map((match) => ({
          start: parseFloat(match[1]),
          score: parseFloat(match[2]),
        }))
        .filter(
          ({ start, score }) =>
            Number.isFinite(start) &&
            Number.isFinite(score) &&
            start + hookDuration <= duration,
        );

      const best = candidates.sort((a, b) => b.score - a.score)[0];
      const fallbackStart = Math.min(
        duration - hookDuration,
        Math.max(1, duration * 0.55),
      );

      resolve({
        start: best ? best.start : fallbackStart,
        duration: hookDuration,
        score: best ? best.score : null,
      });
    });
  });
}

module.exports = { analyzeVideo, findHookSegment };
