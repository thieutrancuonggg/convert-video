require("../config/ffmpeg.config");

const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { encodeOptions } = require("../config/ffmpeg.config");
const {
  TARGET_WIDTH,
  TARGET_HEIGHT,
  VIDEO_AREA_HEIGHT,
  PANEL_HEIGHT,
} = require("../constants/video.constants");
const {
  buildProductNameFilter,
  escapeDrawtext,
} = require("../utils/text.util");
const { buildPanelAnimationFilters } = require("../utils/panel-animation.util");
const { logger } = require("../utils/logger.util");

// ─── Font detection ────────────────────────────────────────────────────────────
// Check project-local font first (drop BeVietnamPro-SemiBold.ttf into fonts/),
// then fall back to common system fonts.
let _cachedFont;
function findSystemFont() {
  if (_cachedFont !== undefined) return _cachedFont;

  const path = require("path");
  const fontsDir = path.join(__dirname, "../../fonts");
  const candidates = {
    darwin: [
      path.join(fontsDir, "BeVietnamPro-Bold.ttf"),
      path.join(fontsDir, "BeVietnamPro-SemiBold.ttf"),
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
      "/System/Library/Fonts/Supplemental/Arial.ttf",
      "/Library/Fonts/Arial.ttf",
      "/System/Library/Fonts/Geneva.ttf",
    ],
    win32: [
      path.join(fontsDir, "BeVietnamPro-Bold.ttf"),
      path.join(fontsDir, "BeVietnamPro-SemiBold.ttf"),
      "C:/Windows/Fonts/Arialbd.ttf",
      "C:/Windows/Fonts/Arial.ttf",
      "C:/Windows/Fonts/arial.ttf",
    ],
    linux: [
      path.join(fontsDir, "BeVietnamPro-Bold.ttf"),
      path.join(fontsDir, "BeVietnamPro-SemiBold.ttf"),
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
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
      "/System/Library/Fonts/Supplemental/Apple Symbols.ttf",
      "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ],
    win32: [
      "C:/Windows/Fonts/seguisym.ttf", // Segoe UI Symbol
      "C:/Windows/Fonts/Arial Unicode MS.ttf",
    ],
    linux: [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ],
  };
  const list = candidates[process.platform] || candidates.linux;
  _cachedIconFont = list.find((p) => fs.existsSync(p)) || null;
  return _cachedIconFont;
}

// On Windows, colon in paths must be \\: inside a drawtext filter value
function escapeFontPath(p) {
  if (process.platform === "win32") {
    return p.replace(/\\/g, "/").replace(":", "\\\\:");
  }
  return p;
}

// Round down to nearest even number (h264 requires even dimensions)
function evenFloor(n) {
  return Math.floor(n / 2) * 2;
}

function buildPulseZoomFilters(variant) {
  const amount = variant.pulseZoom || 0.035;
  const period = variant.pulsePeriod || 6;
  const duration = variant.pulseDuration || 1.25;
  const offsetMap = { v1: 0.4, v2: 1.6, v3: 2.8 };
  const offset = variant.pulseOffset ?? offsetMap[variant.id] ?? 0;
  const phase = `mod(t+${offset}\\,${period})`;
  const zoomExpr = `if(lt(${phase}\\,${duration})\\,1+${amount}*sin(PI*${phase}/${duration})\\,1)`;

  return [
    `scale=w='trunc(${TARGET_WIDTH}*(${zoomExpr})/2)*2':h='trunc(${VIDEO_AREA_HEIGHT}*(${zoomExpr})/2)*2':eval=frame`,
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(iw-ow)/2:(ih-oh)/2`,
  ];
}

// ─── Panel background filters ──────────────────────────────────────────────────
// Returns the array of filter strings that paint the bottom panel area.
// Called after the video has been padded to TARGET_HEIGHT.
function buildPanelBackgroundFilters() {
  const y = VIDEO_AREA_HEIGHT;
  const gradientStops = [
    [0.0, [38, 150, 244]],
    [0.32, [21, 120, 220]],
    [0.64, [9, 86, 184]],
    [1.0, [6, 63, 154]],
  ];

  const toHexColor = (rgb) =>
    `0x${rgb
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;

  const lerp = (from, to, amount) => Math.round(from + (to - from) * amount);
  const colorAt = (position) => {
    const nextIndex = gradientStops.findIndex(([stop]) => stop >= position);
    if (nextIndex <= 0) return gradientStops[0][1];

    const [fromStop, fromRgb] = gradientStops[nextIndex - 1];
    const [toStop, toRgb] = gradientStops[nextIndex];
    const amount = (position - fromStop) / (toStop - fromStop);
    return fromRgb.map((channel, index) => lerp(channel, toRgb[index], amount));
  };

  const bandCount = 92;
  const bandHeight = Math.ceil(PANEL_HEIGHT / bandCount);
  const panelGradient = Array.from({ length: bandCount }, (_, index) => {
    const bandY = y + index * bandHeight;
    const height = Math.min(bandHeight, y + PANEL_HEIGHT - bandY);
    const color = toHexColor(colorAt(index / (bandCount - 1)));
    return `drawbox=x=0:y=${bandY}:w=${TARGET_WIDTH}:h=${height}:color=${color}@1:t=fill`;
  });

  const gridX = Array.from(
    { length: Math.ceil(TARGET_WIDTH / 48) + 1 },
    (_, index) => {
      const x = index * 48;
      const alpha = index % 4 === 0 ? "0.48" : "0.28";
      const width = index % 4 === 0 ? 3 : 2;
      return `drawbox=x=${x}:y=${y}:w=${width}:h=${PANEL_HEIGHT}:color=0xFFFFFF@${alpha}:t=fill`;
    },
  );

  const gridY = Array.from(
    { length: Math.ceil(PANEL_HEIGHT / 48) + 1 },
    (_, index) => {
      const lineY = y + index * 48;
      const alpha = index % 3 === 0 ? "0.34" : "0.22";
      const height = index % 3 === 0 ? 3 : 2;
      return `drawbox=x=0:y=${lineY}:w=${TARGET_WIDTH}:h=${height}:color=0xFFFFFF@${alpha}:t=fill`;
    },
  );

  return [
    ...panelGradient,
    ...gridX,
    ...gridY,
    // Light glass strip at the top like the reference image.
    `drawbox=x=0:y=${y}:w=${TARGET_WIDTH}:h=78:color=0xFFFFFF@0.16:t=fill`,
    `drawbox=x=0:y=${y}:w=${TARGET_WIDTH}:h=3:color=0xD9F2FF@0.70:t=fill`,
    `drawbox=x=0:y=${y + 78}:w=${TARGET_WIDTH}:h=2:color=0xFFFFFF@0.34:t=fill`,
    `drawbox=x=0:y=${y + PANEL_HEIGHT - 5}:w=${TARGET_WIDTH}:h=5:color=0x063F9A@0.88:t=fill`,
  ];
}

// ─── Main video filter builder ─────────────────────────────────────────────────
function buildVideoFilter(videoInfo, variant, productName) {
  const duration = videoInfo.duration || 30;
  const {
    zoom,
    brightness,
    contrast,
    speed,
    translateX,
    translateY,
    hookText,
    hookPosition,
    hookDuration,
  } = variant;
  const { isNineToSixteen } = videoInfo;

  const filters = [];

  // ── 1. Non-9:16 sources: scale + letterbox to video area height (1460) ──────
  if (!isNineToSixteen) {
    filters.push(
      `scale=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:force_original_aspect_ratio=decrease`,
      `pad=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
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
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:${cropX}:${cropY}`,
  );

  // ── 3. Colour grading (applied to video area only, before pad) ──────────────
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}`);

  // ── 4. Occasional pulse zoom on the video area only ─────────────────────────
  filters.push(...buildPulseZoomFilters(variant));

  // ── 5. Pad to full output height; bottom 460px becomes the panel area ────────
  filters.push(`pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:0:0:color=0x060D1F`);

  // ── 6. Paint the panel background (gradient simulation + separator) ──────────
  filters.push(...buildPanelBackgroundFilters());

  // ── 7. Speed ─────────────────────────────────────────────────────────────────
  if (speed !== 1.0) {
    const pts = (1 / speed).toFixed(6);
    filters.push(`setpts=${pts}*PTS`);
  }

  // ── 8. Hook text: keep INSIDE the video area (0 – VIDEO_AREA_HEIGHT) ─────────
  const fontPath = findSystemFont();
  const fontOpt = fontPath ? `fontfile=${escapeFontPath(fontPath)}:` : "";
  // Bottom hook sits 130px above the panel, not 130px above the frame bottom
  const hookY = hookPosition === "top" ? "60" : String(VIDEO_AREA_HEIGHT - 130);
  const enable = `between(t,0,${hookDuration})`;

  filters.push(
    `drawtext=${fontOpt}` +
      `text='${escapeDrawtext(hookText)}':` +
      `fontsize=54:fontcolor=white:` +
      `x=(w-tw)/2:y=${hookY}:` +
      `box=1:boxcolor=black@0.60:boxborderw=18:` +
      `shadowx=2:shadowy=2:shadowcolor=black@0.5:` +
      `enable='${enable}'`,
  );

  // ── 9. Product name in bottom panel ──────────────────────────────────────────
  // buildProductNameFilter returns 1 or 2 drawtext filters already joined with ','
  filters.push(buildProductNameFilter(productName, fontOpt));

  // ── 10. Panel animations (shine streaks + icon badges) ───────────────────────
  const iconFontPath = findIconFont();
  const iconFontOpt = iconFontPath
    ? `fontfile=${escapeFontPath(iconFontPath)}:`
    : fontOpt;
  filters.push(...buildPanelAnimationFilters(variant, duration, iconFontOpt));

  return filters.join(",");
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
        ...encodeOptions.filter(
          (o) => !o.startsWith("-c:a") && !o.startsWith("-b:a"),
        ),
        "-an",
      ]);
    }

    cmd
      .output(outputPath)
      .on("start", () => logger.info(`Rendering ${variant.filename}…`))
      .on("progress", (p) => {
        if (p.percent != null)
          logger.debug(`  ${variant.filename}: ${Math.round(p.percent)}%`);
      })
      .on("end", () => {
        logger.info(`Done: ${variant.filename}`);
        resolve(outputPath);
      })
      .on("error", (err, _stdout, stderr) => {
        logger.error(`FFmpeg error [${variant.filename}]: ${err.message}`);
        if (stderr) logger.error(`stderr: ${stderr.slice(-600)}`);
        reject(
          new Error(`FFmpeg failed for ${variant.filename}: ${err.message}`),
        );
      })
      .run();
  });
}

module.exports = { renderVariant };
