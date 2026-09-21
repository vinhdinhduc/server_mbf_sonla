module.exports = {
  up: async (queryInterface) => {
    const canonicalValues = {
      site_name: 'MobiFone Chi nhánh Sơn La',
      footer_address: 'Tổ 3, Phường Chiềng Lề, tỉnh Sơn La',
      footer_email: 'sonla@mobifone.vn',
      footer_working_hours: 'Thứ Hai – Thứ Bảy: 07:30 – 17:30',
    };

    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(canonicalValues)) {
        await queryInterface.bulkUpdate('settings', { value }, { key }, { transaction });
      }
    });
  },

  down: async () => {
    // Không khôi phục các giá trị liên hệ mâu thuẫn và chuỗi tiếng Việt mất dấu.
  },
};
