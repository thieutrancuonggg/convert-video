const {
  PANEL_HEIGHT,
  VIDEO_AREA_HEIGHT,
  TARGET_WIDTH,
} = require("../constants/video.constants");

const PANEL_PADDING_X = 60; // px each side
const USABLE_WIDTH = TARGET_WIDTH - PANEL_PADDING_X * 2; // 960px

// Strip extra whitespace, limit to maxLength
function normalizeProductName(raw, maxLength = 80) {
  return raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

// Escape special characters for use inside FFmpeg drawtext text='...'
// Must be called on individual line strings (before joining with \n)
function escapeDrawtext(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%");
}

// Wrap text into lines at word boundaries; each line ≤ maxChars
function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current !== "") {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Calculate the best font size + wrapped lines for the product name.
// Tuned for Be Vietnam Pro Bold (slightly narrower than Arial).
// Vietnamese chars with diacritics ≈ same width as Latin, so estimates are close.
function calculateTextLayout(text) {
  // [fontSize, maxCharsPerLine] — higher chars than Arial because BVP Bold is narrower
  const tiers = [
    [72, 20],
    [66, 22],
    [60, 25],
    [54, 28],
    [50, 31],
    [46, 34],
    [42, 38],
  ];

  for (const [fontSize, maxChars] of tiers) {
    const lines = wrapText(text, maxChars);
    if (lines.length <= 2) return { fontSize, lines };
  }

  // Hard fallback: truncate to 2 lines at smallest size
  const fallbackLines = wrapText(text, 40).slice(0, 2);
  return { fontSize: 40, lines: fallbackLines };
}

// Build one or two drawtext filter strings for the product name inside the bottom panel.
// Using separate filters per line ensures each line is independently centered (x=(w-tw)/2).
// A single drawtext with \n centers based on the widest line, leaving short lines left-aligned.
// fontOpt: empty string OR 'fontfile=/path/to/font.ttf:'
// Returns one or two comma-joined filter strings ready to append to the filter chain.
function buildProductNameFilter(productName, fontOpt) {
  const { fontSize, lines } = calculateTextLayout(productName);

  const shadowOpt =
    "borderw=5:bordercolor=black@0.95:shadowx=3:shadowy=5:shadowcolor=black@0.55";
  const baseOpt = `${fontOpt}fontsize=${fontSize}:fontcolor=0xFFE61F:${shadowOpt}`;

  const panelTop = VIDEO_AREA_HEIGHT;
  const panelMid = panelTop + PANEL_HEIGHT / 2; // 1690

  if (lines.length === 1) {
    // Single line: center using FFmpeg th expression
    const y = `${panelTop}+(${PANEL_HEIGHT}-th)/2`;
    return `drawtext=${baseOpt}:text='${escapeDrawtext(lines[0])}':x=(w-tw)/2:y=${y}`;
  }

  // Two lines: compute fixed y offsets.
  // Estimate rendered line height ≈ fontSize * 1.22 (empirical for Be Vietnam Pro Bold).
  const lineH = Math.round(fontSize * 1.22);
  const gap = 14; // px between lines
  const totalH = lineH * 2 + gap;

  const y1 = Math.round(panelMid - totalH / 2);
  const y2 = y1 + lineH + gap;

  const f1 = `drawtext=${baseOpt}:text='${escapeDrawtext(lines[0])}':x=(w-tw)/2:y=${y1}`;
  const f2 = `drawtext=${baseOpt}:text='${escapeDrawtext(lines[1])}':x=(w-tw)/2:y=${y2}`;
  return `${f1},${f2}`;
}

module.exports = {
  normalizeProductName,
  escapeDrawtext,
  calculateTextLayout,
  buildProductNameFilter,
};
