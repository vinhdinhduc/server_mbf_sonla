module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('packages', 'register_syntax', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('packages', 'register_shortcode', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('packages', 'register_shortcode');
    await queryInterface.removeColumn('packages', 'register_syntax');
  },
};
