const rows = [
  ['footer_about_title', 'MobiFone Sơn La'],
  ['footer_about_content', 'Thông tin liên hệ chính thức của MobiFone Sơn La.'],
  ['footer_phone', '18001090'],
  ['footer_working_hours', 'Thứ Hai – Thứ Bảy: 07:30 – 17:30'],
  ['footer_zalo_url', ''],
  ['footer_youtube_url', ''],
  ['footer_copyright', ''],
  ['contact_widget_message', 'Cần hỗ trợ? Nhắn Zalo hoặc gọi ngay'],
  ['contact_widget_enabled', 'true'],
];

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('settings', rows.map(([key, value]) => ({
      key, value, group: 'general', updated_at: new Date(),
    })), { ignoreDuplicates: true });
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', { key: rows.map(([key]) => key) });
  },
};
