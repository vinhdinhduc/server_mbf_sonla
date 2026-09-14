module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_shifts', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'stores', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('work_shifts', 'store_id');
  },
};
