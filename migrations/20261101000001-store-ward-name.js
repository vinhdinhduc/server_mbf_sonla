module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('stores');
    if (!columns.ward_name) {
      await queryInterface.addColumn('stores', 'ward_name', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE stores s INNER JOIN wards w ON BINARY w.code = BINARY s.ward_code SET s.ward_name = w.name_with_type WHERE s.ward_name IS NULL AND s.ward_code IS NOT NULL",
    );
  },
  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('stores');
    if (columns.ward_name) await queryInterface.removeColumn('stores', 'ward_name');
  },
};
