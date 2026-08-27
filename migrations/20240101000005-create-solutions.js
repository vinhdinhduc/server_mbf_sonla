module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('solutions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(255), unique: true, allowNull: false },
      category: {
        type: Sequelize.ENUM('sme', 'ubnd', 'ho_kinh_doanh', 'cuc_nganh'),
        allowNull: false,
      },
      thumbnail: { type: Sequelize.STRING(255), allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      content: { type: Sequelize.TEXT('long'), allowNull: false },
      is_hot: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('solutions');
  },
};
