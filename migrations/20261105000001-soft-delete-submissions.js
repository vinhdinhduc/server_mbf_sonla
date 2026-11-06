const TABLES = ['registration_groups', 'contact_messages', 'store_appointments'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (!columns.deleted_at) {
        await queryInterface.addColumn(table, 'deleted_at', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
    }
  },
  down: async (queryInterface) => {
    for (const table of [...TABLES].reverse()) {
      const columns = await queryInterface.describeTable(table);
      if (columns.deleted_at) await queryInterface.removeColumn(table, 'deleted_at');
    }
  },
};
