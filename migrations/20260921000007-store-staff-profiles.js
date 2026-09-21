/** M06/M09: additive staff-store relationship; legacy unassigned tellers stay unassigned. */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('users');
    const add = async (name, definition) => { if (!columns[name]) await queryInterface.addColumn('users', name, definition); };
    await add('store_id', { type: Sequelize.INTEGER, allowNull: true });
    await add('job_title', { type: Sequelize.STRING(100), allowNull: true });
    await add('is_public_profile', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await add('public_phone', { type: Sequelize.STRING(20), allowNull: true });
    await add('public_zalo', { type: Sequelize.STRING(20), allowNull: true });
    const indexes = await queryInterface.showIndex('users');
    if (!indexes.some((index) => index.name === 'users_store_id_idx')) {
      await queryInterface.addIndex('users', ['store_id'], { name: 'users_store_id_idx' });
    }
  },
  down: async (queryInterface) => {
    const indexes = await queryInterface.showIndex('users');
    if (indexes.some((index) => index.name === 'users_store_id_idx')) await queryInterface.removeIndex('users', 'users_store_id_idx');
    const columns = await queryInterface.describeTable('users');
    for (const name of ['public_zalo', 'public_phone', 'is_public_profile', 'job_title', 'store_id']) {
      if (columns[name]) await queryInterface.removeColumn('users', name);
    }
  },
};
