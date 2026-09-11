module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('settings', [
      { key: 'site_name', value: 'MobiFone Chi nhanh Son La', group: 'general', updated_at: now },
      { key: 'site_logo', value: '/uploads/default-logo.png', group: 'general', updated_at: now },
      { key: 'hotline', value: '18001090', group: 'general', updated_at: now },
      { key: 'notify_email', value: 'admin@mobifone-sonla.vn', group: 'general', updated_at: now },
      {
        key: 'footer_branch_name',
        value: 'Chi nhánh MobiFone tỉnh Sơn La',
        group: 'general',
        updated_at: now,
      },
      {
        key: 'footer_address',
        value: 'Tổ 3, Phường Chiềng Lề, Thành phố Sơn La, tỉnh Sơn La',
        group: 'general',
        updated_at: now,
      },
      { key: 'footer_email', value: 'sonla@mobifone.vn', group: 'general', updated_at: now },
      {
        key: 'footer_description',
        value: 'Tổ 3, Phường Chiềng Lề, Thành phố Sơn La, tỉnh Sơn La',
        group: 'general',
        updated_at: now,
      },
      {
        key: 'footer_facebook_url',
        value: 'https://facebook.com/mobifonesonla',
        group: 'general',
        updated_at: now,
      },
      { key: 'theme_primary_color', value: '#0066b3', group: 'theme', updated_at: now },
      { key: 'home_banner', value: '/uploads/default-banner.jpg', group: 'theme', updated_at: now },
      { key: 'ai_chatbot_enabled', value: 'true', group: 'ai', updated_at: now },
      {
        key: 'ai_system_prompt',
        value:
          'Ban la tro ly ao cua MobiFone chi nhanh Son La, tra loi ngan gon, lich su, chi dua tren du lieu duoc cung cap.',
        group: 'ai',
        updated_at: now,
      },
      { key: 'ai_daily_limit', value: '20', group: 'ai', updated_at: now },
      { key: 'ga4_id', value: '', group: 'analytics', updated_at: now },
      { key: 'fb_pixel_id', value: '', group: 'analytics', updated_at: now },
      {
        key: 'recaptcha_site_key',
        value: process.env.RECAPTCHA_SITE_KEY || '',
        group: 'general',
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', {});
  },
};
