const {
  VIDEO_AREA_HEIGHT,
  PANEL_HEIGHT,
  TARGET_WIDTH,
  TARGET_HEIGHT,
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

// ─── Shine filters ─────────────────────────────────────────────────────────────
//
// drawbox x/y are init-only — not per-frame.  We simulate a left-to-right sweep
// using STRIP_COUNT static vertical boxes at staggered enable windows.
// Shine now covers the FULL FRAME height (video + panel) for a cohesive look.

const STRIP_COUNT = 12;
const STRIP_OVERLAP = 2.0; // heavy overlap → softer strip boundaries

function buildShineFilters(shineCount, duration) {
  const cfg = PANEL_ANIMATION;
  if (!cfg.enablePanelAnimation || shineCount <= 0) return [];

  const { shineDuration, shineOpacity } = cfg;
  const step = shineDuration / STRIP_COUNT;
  const stripW = Math.round((TARGET_WIDTH / STRIP_COUNT) * STRIP_OVERLAP);
  const stripDur = step * 2.5;

  const startPad = Math.min(6, duration * 0.15);
  const endPad = Math.min(6, duration * 0.15);

  return spreadTimes(shineCount, duration, startPad, endPad).flatMap(
    (tBase) => {
      const filters = [];
      for (let i = 0; i < STRIP_COUNT; i++) {
        const stripX = Math.round(i * (TARGET_WIDTH / STRIP_COUNT));
        const stripStart = parseFloat((tBase + i * step).toFixed(3));
        const stripEnd = parseFloat((stripStart + stripDur).toFixed(3));

        // Edge strips are dimmer; centre strips peak at full opacity
        const isMid =
          i >= Math.floor(STRIP_COUNT * 0.2) &&
          i < Math.ceil(STRIP_COUNT * 0.8);
        const alpha = (isMid ? shineOpacity : shineOpacity * 0.5).toFixed(3);

        filters.push(
          // Full frame height — covers video area AND panel together
          `drawbox=x=${stripX}:y=0:w=${stripW}:h=${TARGET_HEIGHT}` +
            `:color=white@${alpha}:t=fill:enable='between(t,${stripStart},${stripEnd})'`,
        );
      }
      return filters;
    },
  );
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

// ─── Public API ────────────────────────────────────────────────────────────────

function buildPanelAnimationFilters(variant, duration, fontOpt) {
  if (!variant.panelAnim) return [];
  const { shineCount = 0, icons = [] } = variant.panelAnim;
  return [
    ...buildShineFilters(shineCount, duration),
    ...buildIconFilters(icons, duration, fontOpt),
  ];
}

module.exports = { buildPanelAnimationFilters };
