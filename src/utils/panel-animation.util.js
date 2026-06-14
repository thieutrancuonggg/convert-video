const {
  VIDEO_AREA_HEIGHT,
  PANEL_HEIGHT,
  TARGET_WIDTH,
} = require("../constants/video.constants");
const { PANEL_ANIMATION } = require("../constants/animation.constants");

// ─── Helpers ───────────────────────────────────────────────────────────────────

function spreadTimes(count, duration, startPad, endPad) {
  if (count <= 0 || duration <= 0) return [];
  const sp = Math.min(startPad, duration * 0.15);
  const ep = Math.min(endPad, duration * 0.15);
  const usable = Math.max(duration - sp - ep, 1);
  return Array.from({ length: count }, (_, i) =>
    parseFloat((sp + (usable * (i + 1)) / (count + 1)).toFixed(3)),
  );
}

// Icon anchor positions — video area AND panel area.
//
// Video-area positions avoid the hook text zones:
//   top hook occupies roughly y=40–150    (V1, V3)
//   bottom hook occupies y=1300–1420      (V2)
// Panel-area positions stay in the four corners of the product panel.
function iconAnchor(pos) {
  const PAD = 28;
  const panelY = VIDEO_AREA_HEIGHT;

  const anchors = {
    // ── Video area ─────────────────────────────────────────────────────────────
    // Top corners: below any top hook text (y ≥ 160)
    vtr: { x: TARGET_WIDTH - 72, y: 160 },
    vtl: { x: PAD, y: 160 },
    // Bottom corners: above bottom hook text and above panel (y ≤ 1240)
    vbr: { x: TARGET_WIDTH - 72, y: panelY - 220 },
    vbl: { x: PAD, y: panelY - 220 },
    // Centre-right edge of video (mid-height, good for accent icons)
    vcr: { x: TARGET_WIDTH - 72, y: Math.round(panelY / 2) - 36 },

    // ── Panel area ─────────────────────────────────────────────────────────────
    tr: { x: TARGET_WIDTH - 72, y: panelY + PAD },
    tl: { x: PAD, y: panelY + PAD },
    br: { x: TARGET_WIDTH - 72, y: panelY + PANEL_HEIGHT - 72 },
    bl: { x: PAD, y: panelY + PANEL_HEIGHT - 72 },
  };

  return anchors[pos] || anchors.tr;
}

// ─── Icon filters ──────────────────────────────────────────────────────────────
//
// drawtext alpha IS per-frame. Each icon fades in, holds, then fades out.
// Icons are spread across BOTH the video area and the panel (configured per-variant).

function buildIconFilters(icons, duration, fontOpt) {
  const cfg = PANEL_ANIMATION;
  if (!cfg.enableCuteIcons || !icons || icons.length === 0) return [];

  const { iconDuration, iconFadeDuration } = cfg;

  const startPad = Math.min(4, duration * 0.1);
  const endPad = Math.min(6, duration * 0.1);
  const times = spreadTimes(icons.length, duration, startPad, endPad);

  return icons.map(({ char, size, pos }, i) => {
    const tStart = times[i];
    const tEnd = parseFloat((tStart + iconDuration).toFixed(3));
    const fd = iconFadeDuration;

    const alphaExpr =
      `if(lt(t-${tStart},${fd}),(t-${tStart})/${fd}` +
      `,if(lt(${tEnd}-t,${fd}),(${tEnd}-t)/${fd},1))`;

    const { x, y } = iconAnchor(pos);
    const safeChar = char.replace(/'/g, "\\'").replace(/:/g, "\\:");

    return (
      `drawtext=${fontOpt}text='${safeChar}':fontsize=${size}:fontcolor=white` +
      `:x=${x}:y=${y}` +
      `:alpha='${alphaExpr}'` +
      `:shadowx=2:shadowy=3:shadowcolor=black@0.45` +
      `:enable='between(t,${tStart},${tEnd})'`
    );
  });
}

function buildFloatingVideoIconFilters(variant, duration, fontOpt) {
  const cfg = PANEL_ANIMATION;
  if (!cfg.enableCuteIcons) return [];

  const count = variant.panelAnim?.videoIconCount || cfg.videoIconCount || 0;
  if (count <= 0) return [];

  const iconDuration = cfg.videoIconDuration || cfg.iconDuration;
  const iconFadeDuration = cfg.videoIconFadeDuration || cfg.iconFadeDuration;
  const startPad = Math.min(2.6, duration * 0.18);
  const endPad = Math.min(4.5, duration * 0.16);
  const times = spreadTimes(count, duration, startPad, endPad);
  const chars = ["★", "✓", "◆", "★", "✓", "•"];
  const colors = ["white", "0xFFE61F", "0xE0F2FE", "0xFFE61F"];
  const points = [
    { x: 86, y: 260 },
    { x: TARGET_WIDTH - 122, y: 300 },
    { x: 112, y: 520 },
    { x: TARGET_WIDTH - 138, y: 610 },
    { x: 92, y: 850 },
    { x: TARGET_WIDTH - 116, y: 930 },
    { x: 142, y: VIDEO_AREA_HEIGHT - 360 },
    { x: TARGET_WIDTH - 150, y: VIDEO_AREA_HEIGHT - 340 },
    { x: Math.round(TARGET_WIDTH * 0.28), y: 420 },
    { x: Math.round(TARGET_WIDTH * 0.72), y: 760 },
    { x: Math.round(TARGET_WIDTH * 0.22), y: 1120 },
    { x: Math.round(TARGET_WIDTH * 0.78), y: 1180 },
  ];

  return times.map((tStart, i) => {
    const tEnd = parseFloat((tStart + iconDuration).toFixed(3));
    const fd = iconFadeDuration;
    const alphaExpr =
      `if(lt(t-${tStart},${fd}),(t-${tStart})/${fd}` +
      `,if(lt(${tEnd}-t,${fd}),(${tEnd}-t)/${fd},1))`;
    const point = points[i % points.length];
    const char = chars[i % chars.length];
    const color = colors[i % colors.length];
    const size = 28 + (i % 4) * 4;
    const drift = i % 2 === 0 ? -18 : 18;
    const safeChar = char.replace(/'/g, "\\'").replace(/:/g, "\\:");

    return (
      `drawtext=${fontOpt}text='${safeChar}':fontsize=${size}:fontcolor=${color}` +
      `:x=${point.x}:y='${point.y}+${drift}*sin((t-${tStart})*PI/${iconDuration})'` +
      `:alpha='${alphaExpr}*0.82'` +
      `:shadowx=2:shadowy=3:shadowcolor=black@0.50` +
      `:enable='between(t,${tStart},${tEnd})'`
    );
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

function buildPanelAnimationFilters(variant, duration, fontOpt) {
  if (!variant.panelAnim) return [];
  const { icons = [] } = variant.panelAnim;
  return [
    ...buildFloatingVideoIconFilters(variant, duration, fontOpt),
    ...buildIconFilters(icons, duration, fontOpt),
  ];
}

module.exports = { buildPanelAnimationFilters };
