module.exports = {
  up: async (queryInterface, Sequelize) => {
    const fields = {
      code: { type: Sequelize.STRING(24), allowNull: true, unique: true },
      customer_type: { type: Sequelize.ENUM('individual', 'business'), allowNull: false, defaultValue: 'individual' },
      store_id: { type: Sequelize.INTEGER, allowNull: true },
      total_amount: { type: Sequelize.DECIMAL(14, 0), allowNull: false, defaultValue: 0 },
      source_utm: { type: Sequelize.JSON, allowNull: true },
      consent_at: { type: Sequelize.DATE, allowNull: true },
      idempotency_key: { type: Sequelize.STRING(100), allowNull: true, unique: true },
    };
    for (const [name, field] of Object.entries(fields)) await queryInterface.addColumn('registration_groups', name, field);
    await queryInterface.addColumn('registration_items', 'fee_snapshot', { type: Sequelize.DECIMAL(12, 0), allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn('registration_items', 'quantity', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    await queryInterface.sequelize.query("UPDATE registration_items SET fee_snapshot=COALESCE(price_snapshot,0), price_snapshot=0 WHERE type='sim'");
    await queryInterface.sequelize.query("UPDATE registration_groups g SET code=CONCAT('DK-',DATE_FORMAT(g.created_at,'%y%m%d'),'-',LPAD(g.id,6,'0')), total_amount=(SELECT COALESCE(SUM((COALESCE(i.price_snapshot,0)+i.fee_snapshot)*i.quantity),0) FROM registration_items i WHERE i.registration_group_id=g.id)");
    await queryInterface.createTable('registration_counters', {
      bucket: { type: Sequelize.STRING(24), primaryKey: true },
      counter: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
    await queryInterface.createTable('registration_events', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      registration_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'registration_groups', key: 'id' }, onDelete: 'CASCADE' },
      from_status: { type: Sequelize.STRING(24), allowNull: true },
      to_status: { type: Sequelize.STRING(24), allowNull: false },
      actor_id: { type: Sequelize.INTEGER, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('registration_events', ['registration_id', 'created_at']);
    await queryInterface.createTable('registration_receipts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      registration_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'registration_groups', key: 'id' }, onDelete: 'RESTRICT' },
      number: { type: Sequelize.STRING(24), allowNull: false, unique: true },
      issued_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      checksum: { type: Sequelize.STRING(64), allowNull: true },
    });
    await queryInterface.addIndex('registration_groups', ['store_id', 'status', 'created_at']);
    await queryInterface.addIndex('registration_groups', ['phone', 'created_at']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('registration_receipts');
    await queryInterface.dropTable('registration_events');
    await queryInterface.dropTable('registration_counters');
    await queryInterface.removeColumn('registration_items', 'quantity');
    await queryInterface.removeColumn('registration_items', 'fee_snapshot');
    for (const name of ['idempotency_key', 'consent_at', 'source_utm', 'total_amount', 'store_id', 'customer_type', 'code']) await queryInterface.removeColumn('registration_groups', name);
  },
};
