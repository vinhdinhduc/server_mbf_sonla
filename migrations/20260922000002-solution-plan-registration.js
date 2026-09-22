module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('registration_items', 'type', { type: Sequelize.ENUM('sim', 'goi_cuoc', 'giai_phap', 'solution_plan'), allowNull: false });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('registration_items', 'type', { type: Sequelize.ENUM('sim', 'goi_cuoc', 'giai_phap'), allowNull: false });
  },
};
