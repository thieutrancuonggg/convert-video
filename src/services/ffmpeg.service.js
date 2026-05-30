require('../config/ffmpeg.config');

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { encodeOptions } = require('../config/ffmpeg.config');
const { TARGET_WIDTH, TARGET_HEIGHT } = require('../constants/video.constants');
const { logger } = require('../utils/logger.util');

// ─── Font detection ────────────────────────────────────────────────────────────
// Finds a system TTF that can render Vietnamese (UTF-8) text.
// Falls back to null → FFmpeg built-in font (ASCII only, still renders hook text).
function findSystemFont() {
  const candidates = {
    darwin: [
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/Library/Fonts/Arial Unicode MS.ttf',
      '/System/Library/Fonts/Geneva.ttf',
    ],
    win32: [
      'C:/Windows/Fonts/Arial.ttf',
      'C:/Windows/Fonts/arial.ttf',
    ],
    linux: [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ],
  };
  const list = candidates[process.platform] || candidates.linux;
  return list.find((p) => fs.existsSync(p)) || null;
}

// Escape text for FFmpeg drawtext value  (inside text='...')
function escapeText(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

// On Windows, colons in font paths must be written as \\:
function escapeFontPath(p) {
  if (process.platform === 'win32') {
    return p.replace(/\\/g, '/').replace(':', '\\\\:');
  }
  return p;
}

// Ensure even pixel count (required by h264)
function evenFloor(n) {
  return Math.floor(n / 2) * 2;
}

// ─── Video filter builder ──────────────────────────────────────────────────────
function buildVideoFilter(videoInfo, variant) {
  const { zoom, brightness, contrast, speed,
          translateX, translateY,
          hookText, hookPosition, hookDuration } = variant;
  const { isNineToSixteen } = videoInfo;

  const filters = [];

  // ── 1. Scale + pad to 9:16 for non-9:16 sources ───────────────────────────
  if (!isNineToSixteen) {
    // Keep aspect ratio, letterbox/pillarbox with black
    filters.push(
      `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease`,
      `pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`
    );
  }

  // ── 2. Zoom: scale up, then crop back to target size ──────────────────────
  const scaledW = evenFloor(TARGET_WIDTH * zoom);
  const scaledH = evenFloor(TARGET_HEIGHT * zoom);

  // Center offset, then apply safe-clamped translate
  const maxTx = Math.floor((scaledW - TARGET_WIDTH) / 2);
  const maxTy = Math.floor((scaledH - TARGET_HEIGHT) / 2);
  const safeTx = Math.max(-maxTx, Math.min(maxTx, translateX));
  const safeTy = Math.max(-maxTy, Math.min(maxTy, translateY));

  const cropX = (scaledW - TARGET_WIDTH) / 2 + safeTx;
  const cropY = (scaledH - TARGET_HEIGHT) / 2 + safeTy;

  filters.push(
    `scale=${scaledW}:${scaledH}`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}:${Math.round(cropX)}:${Math.round(cropY)}`
  );

  // ── 3. Brightness / contrast ───────────────────────────────────────────────
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}`);

  // ── 4. Speed (video timing) ────────────────────────────────────────────────
  if (speed !== 1.0) {
    const pts = (1 / speed).toFixed(6);
    filters.push(`setpts=${pts}*PTS`);
  }

  // ── 5. Hook text overlay (first hookDuration seconds) ─────────────────────
  const fontPath = findSystemFont();
  const fontOpt = fontPath ? `fontfile=${escapeFontPath(fontPath)}:` : '';
  const textY = hookPosition === 'top' ? '60' : `h-130`;
  const enable = `between(t,0,${hookDuration})`;

  filters.push(
    `drawtext=${fontOpt}` +
    `text='${escapeText(hookText)}':` +
    `fontsize=52:fontcolor=white:` +
    `x=(w-tw)/2:y=${textY}:` +
    `box=1:boxcolor=black@0.55:boxborderw=14:` +
    `enable='${enable}'`
  );

  return filters.join(',');
}

// Audio filter: atempo to match speed change
function buildAudioFilter(variant) {
  if (variant.speed === 1.0) return null;
  // atempo accepts 0.5–2.0; our values are always in that range
  return `atempo=${variant.speed.toFixed(4)}`;
}

// ─── Main render function ──────────────────────────────────────────────────────
function renderVariant(inputPath, outputPath, videoInfo, variant) {
  return new Promise((resolve, reject) => {
    const vf = buildVideoFilter(videoInfo, variant);
    const af = buildAudioFilter(variant);

    logger.debug(`[${variant.filename}] vf: ${vf.substring(0, 120)}...`);

    const cmd = ffmpeg(inputPath).videoFilter(vf);

    if (videoInfo.hasAudio) {
      if (af) cmd.audioFilter(af);
      cmd.outputOptions([...encodeOptions]);
    } else {
      // No audio stream → skip audio encoding
      cmd.outputOptions([...encodeOptions.filter((o) => !o.startsWith('-c:a') && !o.startsWith('-b:a')), '-an']);
    }

    cmd
      .output(outputPath)
      .on('start', () => logger.info(`Rendering ${variant.filename}…`))
      .on('progress', (p) => {
        if (p.percent != null) {
          logger.debug(`  ${variant.filename}: ${Math.round(p.percent)}%`);
        }
      })
      .on('end', () => {
        logger.info(`Done: ${variant.filename}`);
        resolve(outputPath);
      })
      .on('error', (err, _stdout, stderr) => {
        logger.error(`FFmpeg error [${variant.filename}]: ${err.message}`);
        if (stderr) logger.error(`stderr: ${stderr.slice(-500)}`);
        reject(new Error(`FFmpeg failed for ${variant.filename}: ${err.message}`));
      })
      .run();
  });
}

module.exports = { renderVariant };
