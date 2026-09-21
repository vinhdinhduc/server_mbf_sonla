const normalizeUploadPath = (column) =>
  `CASE
    WHEN ${column} LIKE 'http://localhost:4000/%' THEN SUBSTRING(${column}, 22)
    WHEN ${column} LIKE 'http://127.0.0.1:4000/%' THEN SUBSTRING(${column}, 22)
    ELSE ${column}
  END`;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        'slider_zones',
        { name: Sequelize.literal("CASE code WHEN 'hero_banner' THEN 'Banner trang chủ' WHEN 'partners' THEN 'Đối tác' WHEN 'testimonials' THEN 'Đánh giá khách hàng' ELSE name END") },
        { code: ['hero_banner', 'partners', 'testimonials'] },
        { transaction },
      );
      await queryInterface.bulkInsert(
        'settings',
        [
          { key: 'contact_email', value: 'sonla@mobifone.vn', group: 'general', updated_at: new Date() },
          { key: 'contact_address', value: 'Tổ 3, Phường Chiềng Lề, tỉnh Sơn La', group: 'general', updated_at: new Date() },
          { key: 'working_hours', value: 'Thứ Hai – Thứ Bảy: 07:30 – 17:30', group: 'general', updated_at: new Date() },
        ],
        { ignoreDuplicates: true, transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE slider_items SET image_url = ${normalizeUploadPath('image_url')} WHERE image_url LIKE 'http://localhost:4000/%' OR image_url LIKE 'http://127.0.0.1:4000/%'`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE news SET thumbnail = ${normalizeUploadPath('thumbnail')} WHERE thumbnail LIKE 'http://localhost:4000/%' OR thumbnail LIKE 'http://127.0.0.1:4000/%'`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE solutions SET thumbnail = ${normalizeUploadPath('thumbnail')} WHERE thumbnail LIKE 'http://localhost:4000/%' OR thumbnail LIKE 'http://127.0.0.1:4000/%'`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE users SET avatar_url = ${normalizeUploadPath('avatar_url')} WHERE avatar_url LIKE 'http://localhost:4000/%' OR avatar_url LIKE 'http://127.0.0.1:4000/%'`,
        { transaction },
      );
      await queryInterface.bulkUpdate(
        'settings',
        { value: 'Bạn là trợ lý ảo của MobiFone Chi nhánh Sơn La. Hãy trả lời ngắn gọn, lịch sự và chỉ dựa trên dữ liệu được cung cấp.' },
        { key: 'ai_system_prompt' },
        { transaction },
      );
    });
  },
  down: async () => {
    // Chuẩn hóa nội dung và URL là thay đổi an toàn, không khôi phục dữ liệu sai cũ.
  },
};
