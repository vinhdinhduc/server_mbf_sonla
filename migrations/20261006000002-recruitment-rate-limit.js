'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'INSERT IGNORE INTO rate_limit_policies (`key`, enabled, max_requests, window_seconds, block_seconds, key_by, message, updated_at) VALUES (:key, 1, 5, 3600, 3600, :keyBy, :message, NOW())',
      { replacements: { key: 'job_application', keyBy: 'ip', message: 'Bạn đã gửi nhiều hồ sơ trong thời gian ngắn. Vui lòng thử lại sau.' } },
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE FROM rate_limit_policies WHERE `key`=:key', { replacements: { key: 'job_application' } });
  },
};
