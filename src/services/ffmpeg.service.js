require('../config/ffmpeg.config');

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { encodeOptions } = require('../config/ffmpeg.config');
const { TARGET_WIDTH, TARGET_HEIGHT, VIDEO_AREA_HEIGHT, PANEL_HEIGHT } = require('../constants/video.constants');
const { buildProductNameFilter, escapeDrawtext } = require('../utils/text.util');
const { buildPanelAnimationFilters } = require('../utils/panel-animation.util');
const { logger } = require('../utils/logger.util');

// ─── Font detection ────────────────────────────────────────────────────────────
// Check project-local font first (drop BeVietnamPro-SemiBold.ttf into fonts/),
// then fall back to common system fonts.
let _cachedFont;
function findSystemFont() {
  if (_cachedFont !== undefined) return _cachedFont;

  const path = require('path');
  const fontsDir = path.join(__dirname, '../../fonts');
  const candidates = {
    darwin: [
      path.join(fontsDir, 'BeVietnamPro-Bold.ttf'),
      path.join(fontsDir, 'BeVietnamPro-SemiBold.ttf'),
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Geneva.ttf',
    ],
    win32: [
      path.join(fontsDir, 'BeVietnamPro-Bold.ttf'),
      path.join(fontsDir, 'BeVietnamPro-SemiBold.ttf'),
      'C:/Windows/Fonts/Arialbd.ttf',
      'C:/Windows/Fonts/Arial.ttf',
      'C:/Windows/Fonts/arial.ttf',
    ],
    linux: [
      path.join(fontsDir, 'BeVietnamPro-Bold.ttf'),
      path.join(fontsDir, 'BeVietnamPro-SemiBold.ttf'),
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ],
  };
  const list = candidates[process.platform] || candidates.linux;
  _cachedFont = list.find((p) => fs.existsSync(p)) || null;
  return _cachedFont;
}

// Separate font for panel icons — needs Unicode symbol coverage (★ ✓ ◆).
// Apple Symbols covers these on macOS; DejaVu Sans covers them on Linux.
let _cachedIconFont;
function findIconFont() {
  if (_cachedIconFont !== undefined) return _cachedIconFont;
  const candidates = {
    darwin: [
      '/System/Library/Fonts/Supplemental/Apple Symbols.ttf',
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    ],
    win32: [
      'C:/Windows/Fonts/seguisym.ttf', // Segoe UI Symbol
      'C:/Windows/Fonts/Arial Unicode MS.ttf',
    ],
    linux: [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
    ],
  };
  const list = candidates[process.platform] || candidates.linux;
  _cachedIconFont = list.find((p) => fs.existsSync(p)) || null;
  return _cachedIconFont;
}

// On Windows, colon in paths must be \\: inside a drawtext filter value
function escapeFontPath(p) {
  if (process.platform === 'win32') {
    return p.replace(/\\/g, '/').replace(':', '\\\\:');
  }
  return p;
}

// Round down to nearest even number (h264 requires even dimensions)
function evenFloor(n) {
  return Math.floor(n / 2) * 2;
}

// ─── Panel background filters ──────────────────────────────────────────────────
// Returns the array of filter strings that paint the bottom panel area.
// Called after the video has been padded to TARGET_HEIGHT.
function buildPanelBackgroundFilters() {
  const y = VIDEO_AREA_HEIGHT;
  return [
    // Deep navy base — premium, not generic-blue
    `drawbox=x=0:y=${y}:w=${TARGET_WIDTH}:h=${PANEL_HEIGHT}:color=0x060D1F@1:t=fill`,
    // Subtle blue gradient hint at top (lighter overlay → simulates top-fade)
    `drawbox=x=0:y=${y}:w=${TARGET_WIDTH}:h=120:color=0x0052E0@0.10:t=fill`,
    // Crisp white separator between video and panel
    `drawbox=x=0:y=${y}:w=${TARGET_WIDTH}:h=3:color=0xFFFFFF@0.22:t=fill`,
    // Thin blue accent bar at the very bottom of the panel
    `drawbox=x=0:y=${y + PANEL_HEIGHT - 4}:w=${TARGET_WIDTH}:h=4:color=0x0052E0@0.9:t=fill`,
  ];
}

// ─── Main video filter builder ─────────────────────────────────────────────────
function buildVideoFilter(videoInfo, variant, productName) {
  const duration = videoInfo.duration || 30;
  const { zoom, brightness, contrast, speed,
          translateX, translateY,
          hookText, hookPosition, hookDuration } = variant;
  const { isNineToSixteen } = videoInfo;

  const filters = [];

  // ── 1. Non-9:16 sources: scale + letterbox to video area height (1460) ──────
  if (!isNineToSixteen) {
    filters.push(
      `scale=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:force_original_aspect_ratio=decrease`,
      `pad=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`
    );
  }

  // ── 2. Zoom: scale up then crop to 1080 × VIDEO_AREA_HEIGHT ─────────────────
  const scaledW = evenFloor(TARGET_WIDTH * zoom);
  const scaledH = evenFloor(VIDEO_AREA_HEIGHT * zoom); // ← uses 1460, not 1920

  const maxTx = Math.floor((scaledW - TARGET_WIDTH) / 2);
  const maxTy = Math.floor((scaledH - VIDEO_AREA_HEIGHT) / 2);
  const safeTx = Math.max(-maxTx, Math.min(maxTx, translateX));
  const safeTy = Math.max(-maxTy, Math.min(maxTy, translateY));

  const cropX = Math.round((scaledW - TARGET_WIDTH) / 2 + safeTx);
  const cropY = Math.round((scaledH - VIDEO_AREA_HEIGHT) / 2 + safeTy);

  filters.push(
    `scale=${scaledW}:${scaledH}`,
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:${cropX}:${cropY}`
  );

  // ── 3. Colour grading (applied to video area only, before pad) ──────────────
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}`);

  // ── 4. Pad to full output height; bottom 460px becomes the panel area ────────
  filters.push(`pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:0:0:color=0x060D1F`);

  // ── 5. Paint the panel background (gradient simulation + separator) ──────────
  filters.push(...buildPanelBackgroundFilters());

  // ── 6. Speed ─────────────────────────────────────────────────────────────────
  if (speed !== 1.0) {
    const pts = (1 / speed).toFixed(6);
    filters.push(`setpts=${pts}*PTS`);
  }

  // ── 7. Hook text: keep INSIDE the video area (0 – VIDEO_AREA_HEIGHT) ─────────
  const fontPath = findSystemFont();
  const fontOpt = fontPath ? `fontfile=${escapeFontPath(fontPath)}:` : '';
  // Bottom hook sits 130px above the panel, not 130px above the frame bottom
  const hookY = hookPosition === 'top' ? '60' : String(VIDEO_AREA_HEIGHT - 130);
  const enable = `between(t,0,${hookDuration})`;

  filters.push(
    `drawtext=${fontOpt}` +
    `text='${escapeDrawtext(hookText)}':` +
    `fontsize=54:fontcolor=white:` +
    `x=(w-tw)/2:y=${hookY}:` +
    `box=1:boxcolor=black@0.60:boxborderw=18:` +
    `shadowx=2:shadowy=2:shadowcolor=black@0.5:` +
    `enable='${enable}'`
  );

  // ── 8. Product name in bottom panel ──────────────────────────────────────────
  // buildProductNameFilter returns 1 or 2 drawtext filters already joined with ','
  filters.push(buildProductNameFilter(productName, fontOpt));

  // ── 9. Panel animations (shine streaks + icon badges) ────────────────────────
  const iconFontPath = findIconFont();
  const iconFontOpt  = iconFontPath ? `fontfile=${escapeFontPath(iconFontPath)}:` : fontOpt;
  filters.push(...buildPanelAnimationFilters(variant, duration, iconFontOpt));

  return filters.join(',');
}

// ─── Audio filter ─────────────────────────────────────────────────────────────
function buildAudioFilter(variant) {
  if (variant.speed === 1.0) return null;
  return `atempo=${variant.speed.toFixed(4)}`;
}

// ─── Main render entry point ───────────────────────────────────────────────────
function renderVariant(inputPath, outputPath, videoInfo, variant, productName) {
  return new Promise((resolve, reject) => {
    const vf = buildVideoFilter(videoInfo, variant, productName);
    const af = buildAudioFilter(variant);

    logger.debug(`[${variant.filename}] vf: ${vf.substring(0, 160)}…`);

    const cmd = ffmpeg(inputPath).videoFilter(vf);

    if (videoInfo.hasAudio) {
      if (af) cmd.audioFilter(af);
      cmd.outputOptions([...encodeOptions]);
    } else {
      cmd.outputOptions([
        ...encodeOptions.filter((o) => !o.startsWith('-c:a') && !o.startsWith('-b:a')),
        '-an',
      ]);
    }

    cmd
      .output(outputPath)
      .on('start', () => logger.info(`Rendering ${variant.filename}…`))
      .on('progress', (p) => {
        if (p.percent != null) logger.debug(`  ${variant.filename}: ${Math.round(p.percent)}%`);
      })
      .on('end', () => {
        logger.info(`Done: ${variant.filename}`);
        resolve(outputPath);
      })
      .on('error', (err, _stdout, stderr) => {
        logger.error(`FFmpeg error [${variant.filename}]: ${err.message}`);
        if (stderr) logger.error(`stderr: ${stderr.slice(-600)}`);
        reject(new Error(`FFmpeg failed for ${variant.filename}: ${err.message}`));
      })
      .run();
  });
}

module.exports = { renderVariant };
