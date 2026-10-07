'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const contacts = await queryInterface.describeTable('contact_messages');
    if (!contacts.source) await queryInterface.addColumn('contact_messages', 'source', {
      type: Sequelize.ENUM('website', 'chatbot'), allowNull: false, defaultValue: 'website',
    });
    const logs = await queryInterface.describeTable('ai_chat_logs');
    if (!logs.feedback_comment) await queryInterface.addColumn('ai_chat_logs', 'feedback_comment', {
      type: Sequelize.STRING(500), allowNull: true,
    });
    // Existing website contacts keep source=website; no email migration is needed
    // because a chatbot contact without email is stored as an empty string.
    await queryInterface.sequelize.query(
      'INSERT IGNORE INTO settings (`key`, value, `group`, updated_at) VALUES (:key, :value, :group, NOW())',
      { replacements: { key: 'ai_chatbot_quick_replies', value: JSON.stringify(['Gói cước nào rẻ?', 'Cửa hàng gần tôi', 'Tư vấn giải pháp doanh nghiệp']), group: 'general' } },
    );
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ai_chat_logs', 'feedback_comment');
    await queryInterface.removeColumn('contact_messages', 'source');
    await queryInterface.sequelize.query('DELETE FROM settings WHERE `key`=:key', { replacements: { key: 'ai_chatbot_quick_replies' } });
  },
};
