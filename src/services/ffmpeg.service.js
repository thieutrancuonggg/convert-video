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
    `scale=w='trunc(${TARGET_WIDTH}*(${zoomExpr})/2)*2':h='trunc(${VIDEO_AREA_HEIGHT}*(${zoomExpr})/2)*2':eval=frame:flags=lanczos`,
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(iw-ow)/2:(ih-oh)/2`,
  ];
}

function buildVideoOverlayFilters() {
  return [
    `drawbox=x=0:y=0:w=${TARGET_WIDTH}:h=${VIDEO_AREA_HEIGHT}:color=0x0A1224@0.05:t=fill`,
    `drawbox=x=24:y=0:w=4:h=${VIDEO_AREA_HEIGHT}:color=0xFFE61F@0.42:t=fill`,
    `drawbox=x=${TARGET_WIDTH - 28}:y=0:w=4:h=${VIDEO_AREA_HEIGHT}:color=0xFFE61F@0.42:t=fill`,
  ];
}

function buildInitialVideoAreaFilters(videoInfo) {
  if (!videoInfo.isNineToSixteen) {
    return [
      `scale=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
    ];
  }

  return [
    `scale=${TARGET_WIDTH}:-2:flags=lanczos`,
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:(iw-ow)/2:(ih-oh)/2`,
  ];
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shortProductName(productName) {
  return productName.trim().replace(/\s+/g, " ").slice(0, 34);
}

const UI_MARGIN_X = 90;
const UI_WIDTH = TARGET_WIDTH - UI_MARGIN_X * 2;
const YELLOW = "0xFFE61F";
const TEXT_WHITE = "0xFFFFFF";

function buildRandomHookText(variant, productName) {
  const product = shortProductName(productName);
  const templates = {
    v1: [
      "XEM TRƯỚC KHI MUA",
      "ĐỪNG LƯỚT QUA MẪU NÀY",
      `${product} CÓ ĐÁNG MUA?`,
      "CHECK NHANH TRƯỚC KHI CHỐT",
    ],
    v2: [
      "TEST NHANH TRONG 60S",
      "MÌNH SOI KỸ MẪU NÀY",
      "XEM XONG RỒI HÃY CHỐT",
      "ẢNH SHOP VS THỰC TẾ?",
    ],
    v3: [
      "CÓ NÊN MUA KHÔNG?",
      "3 ĐIỂM CẦN BIẾT",
      "MẪU NÀY HỢP AI?",
      "ĐỪNG MUA VỘI",
    ],
  };

  return pickRandom(templates[variant.id] || templates.v1);
}

function wrapDisplayText(text, maxChars) {
  const words = text.trim().replace(/\s+/g, " ").split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function buildTextLines(
  lines,
  { fontOpt, fontSize, colors, x, y, lineGap, enable },
) {
  return lines.map((line, index) => {
    const lineY = y + index * (fontSize + lineGap);
    const color = colors[index] || colors[colors.length - 1];
    return (
      `drawtext=${fontOpt}` +
      `text='${escapeDrawtext(line)}':` +
      `fontsize=${fontSize}:fontcolor=${color}:` +
      `borderw=4:bordercolor=black@0.92:` +
      `shadowx=2:shadowy=4:shadowcolor=black@0.55:` +
      `x=${x}:y=${lineY}:enable='${enable}'`
    );
  });
}

function buildHookFilters(hookText, hookY, hookDuration, fontOpt) {
  const lines = wrapDisplayText(hookText.toUpperCase(), 24);
  const fontSize = lines.length > 1 ? 48 : 54;
  const lineGap = 8;
  const boxX = UI_MARGIN_X;
  const boxW = UI_WIDTH;
  const boxH = lines.length * fontSize + (lines.length - 1) * lineGap + 40;
  const enable = `between(t,0,${hookDuration})`;

  return [
    `drawbox=x=${boxX}:y=${hookY - 20}:w=${boxW}:h=${boxH}:color=black@0.68:t=fill:enable='${enable}'`,
    `drawbox=x=${boxX}:y=${hookY - 20}:w=${boxW}:h=6:color=${YELLOW}@1:t=fill:enable='${enable}'`,
    `drawbox=x=${boxX}:y=${hookY - 20 + boxH - 6}:w=${boxW}:h=6:color=${YELLOW}@1:t=fill:enable='${enable}'`,
    ...buildTextLines(lines, {
      fontOpt,
      fontSize,
      colors: [YELLOW, TEXT_WHITE],
      x: "(w-tw)/2",
      y: hookY,
      lineGap,
      enable,
    }),
  ];
}

function buildCaptionTimelineFilters(duration, variant, productName, fontOpt) {
  const product = shortProductName(productName);
  const captionY = variant.hookPosition === "bottom" ? 280 : 1040;
  const captionBoxX = UI_MARGIN_X;
  const captionBoxW = UI_WIDTH;
  const captionBoxH = 142;
  const captions = [
    ["SOI NHANH", product.toUpperCase()],
    ["FORM / CHẤT LIỆU", "XEM KỸ TRƯỚC KHI MUA"],
    ["ĐIỂM ĐÁNG CHÚ Ý", "KHÔNG CHỈ NHÌN ẢNH SHOP"],
    ["HỢP AI?", "CHỐT SAU KHI XEM HẾT"],
  ];

  const start = Math.min(2.35, Math.max(duration * 0.14, 1.4));
  const step = Math.max(2.15, Math.min(3.0, duration / 5));
  const hold = Math.max(1.6, Math.min(2.25, step - 0.3));

  return captions.flatMap((lines, index) => {
    const from = parseFloat((start + index * step).toFixed(2));
    const to = parseFloat((from + hold).toFixed(2));
    if (to > duration - 2.65) return [];

    const enable = `between(t,${from},${to})`;

    return [
      `drawbox=x=${captionBoxX}:y=${captionY - 18}:w=${captionBoxW}:h=${captionBoxH}:color=black@0.58:t=fill:enable='${enable}'`,
      `drawbox=x=${captionBoxX}:y=${captionY - 18}:w=${captionBoxW}:h=3:color=0xFFFFFF@0.28:t=fill:enable='${enable}'`,
      `drawbox=x=${captionBoxX}:y=${captionY - 18}:w=9:h=${captionBoxH}:color=${YELLOW}@0.95:t=fill:enable='${enable}'`,
      ...buildTextLines(lines, {
        fontOpt,
        fontSize: index === 0 ? 42 : 40,
        colors: [YELLOW, TEXT_WHITE],
        x: "(w-tw)/2",
        y: captionY,
        lineGap: 8,
        enable,
      }),
    ];
  });
}

function buildBadgeAndProgressFilters(duration, fontOpt) {
  const progressX = UI_MARGIN_X;
  const progressY = 32;
  const progressW = UI_WIDTH;
  const segmentCount = 24;
  const segmentGap = 4;
  const segmentW = Math.floor(
    (progressW - segmentGap * (segmentCount - 1)) / segmentCount,
  );

  const progressSegments = Array.from({ length: segmentCount }, (_, index) => {
    const x = progressX + index * (segmentW + segmentGap);
    const from = parseFloat(((duration * index) / segmentCount).toFixed(2));
    return `drawbox=x=${x}:y=${progressY}:w=${segmentW}:h=10:color=${YELLOW}@0.95:t=fill:enable='gte(t,${from})'`;
  });

  const badgeW = 328;
  const badgeH = 62;
  const badgeX = Math.round((TARGET_WIDTH - badgeW) / 2);
  const badgeY = 58;

  return [
    `drawbox=x=${progressX}:y=${progressY}:w=${progressW}:h=10:color=black@0.45:t=fill`,
    ...progressSegments,
    `drawbox=x=${badgeX - 6}:y=${badgeY - 6}:w=${badgeW + 12}:h=${badgeH + 12}:color=black@0.88:t=fill`,
    `drawbox=x=${badgeX}:y=${badgeY}:w=${badgeW}:h=${badgeH}:color=${YELLOW}@1:t=fill`,
    `drawtext=${fontOpt}text='@camdaydo':fontsize=32:fontcolor=black:borderw=1:bordercolor=black@0.35:x=(w-tw)/2:y=${badgeY + 15}`,
  ];
}

function buildEndCardFilters(duration, variant, productName, fontOpt) {
  if (duration < 5) return [];

  const product = shortProductName(productName).toUpperCase();
  const start = Math.max(0, parseFloat((duration - 2.4).toFixed(2)));
  const end = parseFloat(duration.toFixed(2));
  const enable = `between(t,${start},${end})`;
  const cardX = UI_MARGIN_X;
  const cardY = variant.hookPosition === "bottom" ? 990 : 1160;
  const cardW = UI_WIDTH;
  const cardH = 190;
  const ctaTemplates = [
    "XEM GIÁ TRƯỚC KHI CHỐT",
    "LƯU LẠI ĐỂ SO SÁNH",
    "CHECK SIZE TRƯỚC KHI MUA",
    "ĐỌC REVIEW RỒI HÃY CHỐT",
  ];
  const cta = pickRandom(ctaTemplates);

  return [
    `drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=black@0.72:t=fill:enable='${enable}'`,
    `drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=8:color=${YELLOW}@1:t=fill:enable='${enable}'`,
    `drawbox=x=${cardX}:y=${cardY + cardH - 8}:w=${cardW}:h=8:color=${YELLOW}@1:t=fill:enable='${enable}'`,
    `drawtext=${fontOpt}text='${escapeDrawtext(cta)}':fontsize=42:fontcolor=${YELLOW}:borderw=4:bordercolor=black@0.9:shadowx=2:shadowy=4:shadowcolor=black@0.55:x=(w-tw)/2:y=${cardY + 34}:enable='${enable}'`,
    `drawtext=${fontOpt}text='${escapeDrawtext(product)}':fontsize=36:fontcolor=white:borderw=3:bordercolor=black@0.9:shadowx=2:shadowy=4:shadowcolor=black@0.55:x=(w-tw)/2:y=${cardY + 102}:enable='${enable}'`,
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
    hookPosition,
    hookDuration,
  } = variant;
  const filters = [];

  // Convert to YUV 4:4:4 immediately so every subsequent filter (scale,
  // drawbox, drawtext, colorbalance) operates at full chroma resolution.
  // The encoder converts back to 4:2:0 at the very end via -pix_fmt yuv420p.
  filters.push("format=yuv444p");

  // ── 1. Normalize into the top video area before variant zoom/crop ───────────
  filters.push(...buildInitialVideoAreaFilters(videoInfo));

  // ── 2. Zoom: scale up then crop to 1080 × VIDEO_AREA_HEIGHT ─────────────────
  const baseZoom = Math.min(zoom + 0.015, 1.1);
  const scaledW = evenFloor(TARGET_WIDTH * baseZoom);
  const scaledH = evenFloor(VIDEO_AREA_HEIGHT * baseZoom);

  const maxTx = Math.floor((scaledW - TARGET_WIDTH) / 2);
  const maxTy = Math.floor((scaledH - VIDEO_AREA_HEIGHT) / 2);
  const safeTx = Math.max(-maxTx, Math.min(maxTx, translateX));
  const safeTy = Math.max(-maxTy, Math.min(maxTy, translateY));

  const cropX = Math.round((scaledW - TARGET_WIDTH) / 2 + safeTx);
  const cropY = Math.round((scaledH - VIDEO_AREA_HEIGHT) / 2 + safeTy);

  filters.push(
    `scale=${scaledW}:${scaledH}:flags=lanczos`,
    `crop=${TARGET_WIDTH}:${VIDEO_AREA_HEIGHT}:${cropX}:${cropY}`,
  );

  // ── 3. Colour grading (applied to video area only, before pad) ──────────────
  filters.push(
    `eq=brightness=${(brightness + 0.01).toFixed(3)}:contrast=${(contrast + 0.04).toFixed(3)}:saturation=1.12`,
    `colorbalance=rs=0.025:gs=0.008:bs=-0.018`,
    `unsharp=lx=5:ly=5:la=0.8:cx=3:cy=3:ca=0.0`,
  );

  // ── 4. Occasional pulse zoom on the video area only ─────────────────────────
  filters.push(...buildPulseZoomFilters(variant));

  // ── 5. Pad to full output height; bottom area becomes the product panel ──────
  filters.push(`pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:0:0:color=0x060D1F`);

  // ── 6. Subtle phone-screen side stripes and video overlay ────────────────────
  filters.push(...buildVideoOverlayFilters());

  // ── 7. Paint the panel background (gradient simulation + separator) ──────────
  filters.push(...buildPanelBackgroundFilters());

  // ── 8. Speed ─────────────────────────────────────────────────────────────────
  if (speed !== 1.0) {
    const pts = (1 / speed).toFixed(6);
    filters.push(`setpts=${pts}*PTS`);
  }

  // ── 9. TikTok-style badge and progress bar ───────────────────────────────────
  const fontPath = findSystemFont();
  const fontOpt = fontPath ? `fontfile=${escapeFontPath(fontPath)}:` : "";
  filters.push(...buildBadgeAndProgressFilters(duration, fontOpt));

  // ── 10. Hook text: keep INSIDE the video area (0 – VIDEO_AREA_HEIGHT) ────────
  // Top hook sits below the badge/progress bar; bottom hook stays above the panel.
  const hookY =
    hookPosition === "top" ? "172" : String(VIDEO_AREA_HEIGHT - 130);
  const hookText = buildRandomHookText(variant, productName);
  filters.push(
    ...buildHookFilters(hookText, Number(hookY), hookDuration, fontOpt),
  );

  // ── 11. Caption timeline in the video area ───────────────────────────────────
  filters.push(
    ...buildCaptionTimelineFilters(duration, variant, productName, fontOpt),
  );

  // ── 12. End-card CTA in the final seconds ────────────────────────────────────
  filters.push(...buildEndCardFilters(duration, variant, productName, fontOpt));

  // ── 13. Product name in bottom panel ─────────────────────────────────────────
  // buildProductNameFilter returns 1 or 2 drawtext filters already joined with ','
  filters.push(buildProductNameFilter(productName, fontOpt));

  // ── 14. Panel and video icon animations ──────────────────────────────────────
  const iconFontPath = findIconFont();
  const iconFontOpt = iconFontPath
    ? `fontfile=${escapeFontPath(iconFontPath)}:`
    : fontOpt;
  filters.push(...buildPanelAnimationFilters(variant, duration, iconFontOpt));

  return filters.join(",");
}

// ─── Main render entry point ───────────────────────────────────────────────────
function renderVariant(inputPath, outputPath, videoInfo, variant, productName) {
  return new Promise((resolve, reject) => {
    const vf = buildVideoFilter(videoInfo, variant, productName);

    logger.debug(`[${variant.filename}] vf: ${vf.substring(0, 160)}…`);

    const cmd = ffmpeg(inputPath)
      .videoFilter(vf)
      .outputOptions([...encodeOptions, "-an"]);

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
