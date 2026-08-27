module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('slider_zones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      animation_type: {
        type: Sequelize.ENUM('fade', 'slide', 'zoom'),
        allowNull: false,
        defaultValue: 'fade',
      },
      autoplay_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      autoplay_speed_ms: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5000 },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('slider_zones');
  },
};
