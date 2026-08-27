module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      full_name: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      role: {
        type: Sequelize.ENUM('admin', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'locked'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
