module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('solutions', 'section_titles', { type: Sequelize.JSON, allowNull: true });
    await queryInterface.addColumn('solution_pricing', 'status', { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('solution_pricing', 'status');
    await queryInterface.removeColumn('solutions', 'section_titles');
  },
};
