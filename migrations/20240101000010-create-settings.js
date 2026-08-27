module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      key: { type: Sequelize.STRING(100), unique: true, allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: false },
      group: {
        type: Sequelize.ENUM('general', 'theme', 'ai', 'analytics'),
        allowNull: false,
      },
      updated_by: {
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
    await queryInterface.dropTable('settings');
  },
};
