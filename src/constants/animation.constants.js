// ─── Panel animation configuration ────────────────────────────────────────────
module.exports = {
  PANEL_ANIMATION: {
    // Master switches
    enablePanelAnimation: true,
    enableCuteIcons: true,

    // Shine parameters
    shineCount: 2,          // default (overridden per-variant)
    shineDuration: 1.0,     // seconds each shine runs
    shineWidth: 240,        // px wide of the streak
    shineOpacity: 0.07,     // max alpha of the core strip (keep subtle)

    // Icon parameters
    iconCount: 3,           // default (overridden per-variant)
    iconDuration: 1.2,      // seconds each icon is visible
    iconFadeDuration: 0.28, // seconds for fade-in and fade-out each
  },
};
