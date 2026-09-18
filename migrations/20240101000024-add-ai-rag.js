module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ai_chat_logs', 'was_helpful', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('ai_chat_logs', 'flagged_for_review', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.createTable('ai_knowledge_entries', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      tags: { type: Sequelize.STRING(255), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_knowledge_entries');
    await queryInterface.removeColumn('ai_chat_logs', 'flagged_for_review');
    await queryInterface.removeColumn('ai_chat_logs', 'was_helpful');
  },
};
