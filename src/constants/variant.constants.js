module.exports = {
  VARIANTS: [
    {
      id: 'v1',
      name: 'Output Video',
      label: 'Video hoàn chỉnh',
      description: 'Video đã được tối ưu khung hình, màu sắc, hook và thông tin sản phẩm',
      filename: 'video_output.mp4',
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
        // icons spread across video area + panel
        // hook is at TOP → video top-right (vtr) safe only after hookDuration
        // startPad for icons = max(hookDuration, 3s) in practice for real videos
        icons: [
          { char: '★', size: 44, pos: 'vtr' }, // video area top-right
          { char: '★', size: 40, pos: 'tr'  }, // panel top-right
        ],
      },
    },
  ],

  ZIP_FILENAME: 'all_variants.zip',
};
