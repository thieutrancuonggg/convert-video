module.exports = {
  VARIANTS: [
    {
      id: 'v1',
      name: 'Light Variant',
      label: 'Version 1 — Light',
      description: 'Zoom nhẹ 3%, tăng sáng nhẹ, hook text ở đầu video (2 giây)',
      filename: 'video_v1_light.mp4',
      zoom: 1.03,
      brightness: 0.03,
      contrast: 1.03,
      speed: 1.00,
      translateX: 0,
      translateY: 0,
      hookText: 'Xem trước khi bạn mua',
      hookPosition: 'top',
      hookDuration: 2,
      panelAnim: {
        shineCount: 1,
        // icons spread across video area + panel
        // hook is at TOP → video top-right (vtr) safe only after hookDuration
        // startPad for icons = max(hookDuration, 3s) in practice for real videos
        icons: [
          { char: '★', size: 44, pos: 'vtr' }, // video area top-right
          { char: '★', size: 40, pos: 'tr'  }, // panel top-right
        ],
      },
    },
    {
      id: 'v2',
      name: 'Medium Variant',
      label: 'Version 2 — Medium',
      description: 'Zoom 6%, dịch khung ngang 20px, tốc độ +1%, hook text cuối màn hình',
      filename: 'video_v2_medium.mp4',
      zoom: 1.06,
      brightness: 0.04,
      contrast: 1.05,
      speed: 1.01,
      translateX: 20,
      translateY: 0,
      hookText: 'Mình đã test thử sản phẩm này',
      hookPosition: 'bottom',
      hookDuration: 2,
      panelAnim: {
        shineCount: 2,
        // hook is at BOTTOM → use video top corners (vtl/vtr) for video icons
        icons: [
          { char: '✓', size: 44, pos: 'vtl' }, // video area top-left
          { char: '✓', size: 40, pos: 'tl'  }, // panel top-left
          { char: '★', size: 36, pos: 'br'  }, // panel bottom-right
        ],
      },
    },
    {
      id: 'v3',
      name: 'Strong Safe Variant',
      label: 'Version 3 — Strong Safe',
      description: 'Zoom 8%, dịch khung dọc 20px, tốc độ -1%, tương phản cao hơn nhẹ',
      filename: 'video_v3_strong_safe.mp4',
      zoom: 1.08,
      brightness: 0.02,
      contrast: 1.08,
      speed: 0.99,
      translateX: 0,
      translateY: 20,
      hookText: 'Có đáng mua không?',
      hookPosition: 'top',
      hookDuration: 2,
      panelAnim: {
        shineCount: 2,
        // hook is at TOP → use video bottom-right (vbr) safe; top corners avoid hook
        icons: [
          { char: '★', size: 46, pos: 'vbr' }, // video area bottom-right (above panel)
          { char: '◆', size: 38, pos: 'vtr' }, // video area top-right (≥160px, below hook)
          { char: '★', size: 40, pos: 'bl'  }, // panel bottom-left
        ],
      },
    },
  ],

  ZIP_FILENAME: 'all_variants.zip',
};
