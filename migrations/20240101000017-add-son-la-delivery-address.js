module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('registration_groups', 'province', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: 'Sơn La',
    });
    await queryInterface.addColumn('registration_groups', 'district', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('registration_groups', 'ward', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('registration_groups', 'delivery_address', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('registration_groups', 'delivery_address');
    await queryInterface.removeColumn('registration_groups', 'ward');
    await queryInterface.removeColumn('registration_groups', 'district');
    await queryInterface.removeColumn('registration_groups', 'province');
  },
};
