module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('packages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(20), unique: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(255), unique: true, allowNull: false },
      group_type: {
        type: Sequelize.ENUM('hot', 'tra_truoc', 'tra_sau', 'wifi_5g'),
        allowNull: false,
      },
      headline_desc: { type: Sequelize.STRING(100), allowNull: true },
      price: { type: Sequelize.DECIMAL(12, 0), allowNull: false },
      duration_value: { type: Sequelize.INTEGER, allowNull: false },
      duration_unit: { type: Sequelize.ENUM('ngay', 'thang'), allowNull: false },
      data_desc: { type: Sequelize.STRING(255), allowNull: true },
      call_desc: { type: Sequelize.STRING(255), allowNull: true },
      sms_desc: { type: Sequelize.STRING(255), allowNull: true },
      speed_desc: { type: Sequelize.STRING(100), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('packages');
  },
};
