module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sim_numbers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      phone_number: { type: Sequelize.STRING(15), unique: true, allowNull: false },
      prefix: { type: Sequelize.STRING(5), allowNull: false },
      catalog: {
        type: Sequelize.ENUM('so_dep', 'phong_thuy', 'nam_sinh', 'tra_truoc', 'sim_data', 'esim'),
        allowNull: false,
      },
      sim_type: {
        type: Sequelize.ENUM('tam_hoa', 'tu_quy', 'phat_loc', 'than_tai', 'thuong'),
        allowNull: false,
      },
      price: { type: Sequelize.DECIMAL(12, 0), allowNull: false },
      bundle_note: { type: Sequelize.STRING(255), allowNull: true },
      commitment_months: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('available', 'reserved', 'sold'),
        allowNull: false,
        defaultValue: 'available',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('sim_numbers');
  },
};
