module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'settings',
      [
        { key: 'site_name', value: 'MobiFone Chi nhánh Sơn La', group: 'general', updated_at: now },
        { key: 'site_logo', value: '/uploads/default-logo.png', group: 'general', updated_at: now },
        { key: 'hotline', value: '18001090', group: 'general', updated_at: now },
        { key: 'contact_email', value: 'sonla@mobifone.vn', group: 'general', updated_at: now },
        {
          key: 'contact_address',
          value: 'Tổ 3, Phường Chiềng Lề, tỉnh Sơn La',
          group: 'general',
          updated_at: now,
        },
        {
          key: 'working_hours',
          value: 'Thứ Hai – Thứ Bảy: 07:30 – 17:30',
          group: 'general',
          updated_at: now,
        },
        { key: 'sim_activation_fee_prepaid', value: '50000', group: 'general', updated_at: now },
        { key: 'sim_activation_fee_postpaid', value: '60000', group: 'general', updated_at: now },
        {
          key: 'notify_email',
          value: 'admin@mobifone-sonla.vn',
          group: 'general',
          updated_at: now,
        },
        {
          key: 'footer_branch_name',
          value: 'Chi nhánh MobiFone tỉnh Sơn La',
          group: 'general',
          updated_at: now,
        },
        {
          key: 'footer_address',
          value: 'Tổ 3, Phường Chiềng Lề, tỉnh Sơn La',
          group: 'general',
          updated_at: now,
        },
        { key: 'footer_email', value: 'sonla@mobifone.vn', group: 'general', updated_at: now },
        {
          key: 'footer_description',
          value: 'Tổ 3, Phường Chiềng Lề, tỉnh Sơn La',
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
        {
          key: 'home_banner',
          value: '/uploads/default-banner.jpg',
          group: 'theme',
          updated_at: now,
        },
        { key: 'ai_chatbot_enabled', value: 'true', group: 'ai', updated_at: now },
        {
          key: 'ai_system_prompt',
          value:
            'Bạn là trợ lý ảo của MobiFone Chi nhánh Sơn La. Hãy trả lời ngắn gọn, lịch sự và chỉ dựa trên dữ liệu được cung cấp.',
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
        { key: 'ai_provider', value: 'anthropic', group: 'ai', updated_at: now },
        {
          key: 'ai_model',
          value: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
          group: 'ai',
          updated_at: now,
        },
        { key: 'ai_temperature', value: '0.4', group: 'ai', updated_at: now },
        { key: 'ai_max_tokens', value: '500', group: 'ai', updated_at: now },
        { key: 'ai_top_p', value: '1', group: 'ai', updated_at: now },
        { key: 'ai_rag_enabled', value: 'true', group: 'ai', updated_at: now },
        {
          key: 'ai_fallback_message',
          value:
            'Hiện chatbot chưa thể trả lời. Vui lòng gọi hotline MobiFone Sơn La để được hỗ trợ.',
          group: 'ai',
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', {});
  },
};
