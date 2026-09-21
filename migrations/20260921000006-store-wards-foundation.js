/** M06: additive migration. Old district/address/opening_hours remain for rollback and review. */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : table.tableName);
    if (!tables.includes('provinces')) {
      await queryInterface.createTable('provinces', {
        code: { type: Sequelize.STRING(2), primaryKey: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
      });
    }
    if (!tables.includes('wards')) {
      await queryInterface.createTable('wards', {
        code: { type: Sequelize.STRING(5), primaryKey: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        name_with_type: { type: Sequelize.STRING(120), allowNull: false },
        province_code: { type: Sequelize.STRING(2), allowNull: false, references: { model: 'provinces', key: 'code' } },
      });
      await queryInterface.addIndex('wards', ['province_code', 'name']);
    }
    const columns = await queryInterface.describeTable('stores');
    const add = async (name, definition) => { if (!columns[name]) await queryInterface.addColumn('stores', name, definition); };
    await add('province_code', { type: Sequelize.STRING(2), allowNull: true });
    await add('ward_code', { type: Sequelize.STRING(5), allowNull: true });
    await add('street_address', { type: Sequelize.STRING(255), allowNull: true });
    await add('full_address', { type: Sequelize.STRING(500), allowNull: true });
    await add('email', { type: Sequelize.STRING(150), allowNull: true });
    await add('opening_hours_json', { type: Sequelize.JSON, allowNull: true });
    await add('needs_review', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await add('geocode_source', { type: Sequelize.STRING(30), allowNull: true });
    await add('geocoded_at', { type: Sequelize.DATE, allowNull: true });
    await add('status', { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' });
    await queryInterface.sequelize.query("UPDATE stores SET province_code = '14', full_address = address, needs_review = 1 WHERE ward_code IS NULL");
    if (columns.district?.allowNull === false) {
      await queryInterface.changeColumn('stores', 'district', { type: Sequelize.STRING(100), allowNull: true });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('stores');
    for (const name of ['status', 'geocoded_at', 'geocode_source', 'needs_review', 'opening_hours_json', 'email', 'full_address', 'street_address', 'ward_code', 'province_code']) {
      if (columns[name]) await queryInterface.removeColumn('stores', name);
    }
    const tables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : table.tableName);
    if (tables.includes('wards')) await queryInterface.dropTable('wards');
    if (tables.includes('provinces')) await queryInterface.dropTable('provinces');
    await queryInterface.sequelize.query("UPDATE stores SET district = '' WHERE district IS NULL");
    await queryInterface.changeColumn('stores', 'district', { type: Sequelize.STRING(100), allowNull: false, defaultValue: '' });
  },
};
