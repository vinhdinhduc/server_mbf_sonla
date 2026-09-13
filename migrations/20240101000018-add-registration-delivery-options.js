module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('registration_groups', 'email', {
      type: Sequelize.STRING(150),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('registration_groups', 'delivery_method', {
      type: Sequelize.ENUM('address', 'store'),
      allowNull: false,
      defaultValue: 'address',
    });
    await queryInterface.addColumn('registration_groups', 'sim_type', {
      type: Sequelize.ENUM('physical', 'esim'),
      allowNull: false,
      defaultValue: 'physical',
    });
    await queryInterface.addColumn('registration_groups', 'delivery_store', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('registration_groups', 'delivery_store');
    await queryInterface.removeColumn('registration_groups', 'sim_type');
    await queryInterface.removeColumn('registration_groups', 'delivery_method');
    await queryInterface.removeColumn('registration_groups', 'email');
  },
};
