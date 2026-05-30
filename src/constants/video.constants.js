module.exports = {
  TARGET_WIDTH: 1080,
  TARGET_HEIGHT: 1920,

  // Layout with bottom panel
  VIDEO_AREA_HEIGHT: 1460, // video occupies top portion
  PANEL_HEIGHT: 460, // product name panel at bottom

  MAX_DURATION_WARN: 35, // seconds — warn but still process

  ALLOWED_EXTENSION: ".mp4",

  // Hard safety limits for all variants
  MAX_ZOOM: 1.08,
  MIN_ZOOM: 1.03,
  MIN_SPEED: 0.97,
  MAX_SPEED: 1.03,
  MAX_BRIGHTNESS: 0.06,
  MAX_CONTRAST: 1.08,
  MAX_TRANSLATE_X: 30,
  MAX_TRANSLATE_Y: 30,
};
