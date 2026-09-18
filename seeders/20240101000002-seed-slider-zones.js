module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert(
      'slider_zones',
      [
        {
          code: 'hero_banner',
          name: 'Banner trang chu',
          animation_type: 'fade',
          autoplay_enabled: true,
          autoplay_speed_ms: 5000,
          status: 'active',
        },
        {
          code: 'partners',
          name: 'Doi tac',
          animation_type: 'slide',
          autoplay_enabled: true,
          autoplay_speed_ms: 3000,
          status: 'active',
        },
        {
          code: 'testimonials',
          name: 'Danh gia khach hang',
          animation_type: 'fade',
          autoplay_enabled: true,
          autoplay_speed_ms: 6000,
          status: 'active',
        },
      ],
      { ignoreDuplicates: true },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('slider_zones', {
      code: ['hero_banner', 'partners', 'testimonials'],
    });
  },
};
