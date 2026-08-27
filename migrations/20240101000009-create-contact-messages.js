module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('contact_messages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      email: { type: Sequelize.STRING(100), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.ENUM('moi', 'da_xu_ly'),
        allowNull: false,
        defaultValue: 'moi',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('contact_messages');
  },
};
