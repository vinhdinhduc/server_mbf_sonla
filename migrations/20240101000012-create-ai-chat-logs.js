module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_chat_logs', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      session_id: { type: Sequelize.STRING(100), allowNull: false },
      user_message: { type: Sequelize.TEXT, allowNull: false },
      ai_response: { type: Sequelize.TEXT, allowNull: false },
      ip_address: { type: Sequelize.STRING(45), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_chat_logs');
  },
};
