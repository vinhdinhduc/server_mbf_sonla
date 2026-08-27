module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('registration_groups', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      customer_name: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('moi', 'dang_xu_ly', 'hoan_thanh', 'huy'),
        allowNull: false,
        defaultValue: 'moi',
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('registration_groups');
  },
};
