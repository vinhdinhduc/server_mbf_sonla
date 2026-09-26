const add = async (queryInterface, table, name, definition) => { const columns = await queryInterface.describeTable(table); if (!columns[name]) await queryInterface.addColumn(table, name, definition); };
module.exports = {
  async up(queryInterface, Sequelize) {
    await add(queryInterface, 'contact_messages', 'code', { type: Sequelize.STRING(24), allowNull: true, unique: true });
    await add(queryInterface, 'contact_messages', 'topic', { type: Sequelize.STRING(50), allowNull: true });
    await add(queryInterface, 'contact_messages', 'store_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'stores', key: 'id' }, onDelete: 'SET NULL' });
    await add(queryInterface, 'contact_messages', 'consent_at', { type: Sequelize.DATE, allowNull: true });
    await add(queryInterface, 'contact_messages', 'assigned_to', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' });
    await add(queryInterface, 'contact_messages', 'internal_note', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('contact_messages', 'status', { type: Sequelize.ENUM('moi', 'dang_xu_ly', 'da_xu_ly', 'da_phan_hoi'), allowNull: false, defaultValue: 'moi' });
    await queryInterface.sequelize.query("UPDATE contact_messages SET status='da_phan_hoi' WHERE status='da_xu_ly'");
    await queryInterface.sequelize.query("UPDATE contact_messages SET code=CONCAT('LH-',DATE_FORMAT(created_at,'%y%m%d'),'-',LPAD(id,5,'0')) WHERE code IS NULL");

    await queryInterface.createTable('jobs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: false }, slug: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      category: { type: Sequelize.STRING(100), allowNull: false }, level: { type: Sequelize.STRING(80), allowNull: true }, employment_type: { type: Sequelize.STRING(50), allowNull: false },
      store_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'stores', key: 'id' }, onDelete: 'SET NULL' }, location: { type: Sequelize.STRING(255), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, salary_min: { type: Sequelize.DECIMAL(15,2), allowNull: true }, salary_max: { type: Sequelize.DECIMAL(15,2), allowNull: true }, salary_type: { type: Sequelize.ENUM('range','negotiable','hidden'), allowNull: false, defaultValue: 'negotiable' },
      description: { type: Sequelize.TEXT('long'), allowNull: false }, requirements: { type: Sequelize.TEXT('long'), allowNull: true }, benefits: { type: Sequelize.TEXT('long'), allowNull: true },
      deadline: { type: Sequelize.DATEONLY, allowNull: false }, is_hot: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, is_urgent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.ENUM('draft','recruiting','paused'), allowNull: false, defaultValue: 'draft' }, created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }, deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('jobs', ['status','deadline'], { name: 'idx_jobs_public' });
    await queryInterface.createTable('job_applications', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true }, code: { type: Sequelize.STRING(24), allowNull: false, unique: true },
      job_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'jobs', key: 'id' }, onDelete: 'SET NULL' }, full_name: { type: Sequelize.STRING(100), allowNull: false }, phone: { type: Sequelize.STRING(20), allowNull: false }, email: { type: Sequelize.STRING(150), allowNull: false }, introduction: { type: Sequelize.TEXT, allowNull: true },
      cv_path: { type: Sequelize.STRING(500), allowNull: false }, cv_original_name: { type: Sequelize.STRING(255), allowNull: false }, cv_mime: { type: Sequelize.STRING(100), allowNull: false }, consent_at: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.ENUM('new','screening','interview','accepted','rejected'), allowNull: false, defaultValue: 'new' }, internal_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('job_applications'); await queryInterface.dropTable('jobs');
    await queryInterface.changeColumn('contact_messages', 'status', { type: Sequelize.ENUM('moi','da_xu_ly'), allowNull: false, defaultValue: 'moi' });
    for (const name of ['internal_note','assigned_to','consent_at','store_id','topic','code']) await queryInterface.removeColumn('contact_messages', name).catch(() => {});
  },
};
