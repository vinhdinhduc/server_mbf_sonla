module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('stores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      address: { type: Sequelize.STRING(255), allowNull: false },
      district: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      opening_hours: { type: Sequelize.STRING(100), allowNull: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('stores');
  },
};
