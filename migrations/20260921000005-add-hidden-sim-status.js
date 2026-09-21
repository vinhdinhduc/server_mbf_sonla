module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('sim_numbers', 'status', {
      type: Sequelize.ENUM('available', 'reserved', 'sold', 'hidden'),
      allowNull: false,
      defaultValue: 'available',
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE sim_numbers SET status = 'available' WHERE status = 'hidden'",
    );
    await queryInterface.changeColumn('sim_numbers', 'status', {
      type: Sequelize.ENUM('available', 'reserved', 'sold'),
      allowNull: false,
      defaultValue: 'available',
    });
  },
};
