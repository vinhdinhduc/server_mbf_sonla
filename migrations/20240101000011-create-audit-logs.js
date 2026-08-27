module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      action: {
        type: Sequelize.ENUM('create', 'update', 'delete', 'login', 'logout'),
        allowNull: false,
      },
      module: { type: Sequelize.STRING(50), allowNull: false },
      target_id: { type: Sequelize.INTEGER, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      old_value: { type: Sequelize.JSON, allowNull: true },
      new_value: { type: Sequelize.JSON, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
  },
};
