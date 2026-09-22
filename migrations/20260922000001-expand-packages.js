module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = {
      service_type: { type: Sequelize.ENUM('mobile', 'data', 'wifi_5g', 'combo'), allowNull: false, defaultValue: 'mobile' },
      subscription_type: { type: Sequelize.ENUM('prepaid', 'postpaid', 'none'), allowNull: false, defaultValue: 'none' },
      badges: { type: Sequelize.JSON, allowNull: true },
      data_per_day_gb: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      data_per_cycle_gb: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      unlimited_data: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      benefits: { type: Sequelize.JSON, allowNull: true },
      conditions: { type: Sequelize.TEXT, allowNull: true },
      audience: { type: Sequelize.STRING(255), allowNull: true },
      sms_syntax: { type: Sequelize.STRING(255), allowNull: true },
      image_url: { type: Sequelize.STRING(255), allowNull: true },
      effective_from: { type: Sequelize.DATE, allowNull: true },
      effective_to: { type: Sequelize.DATE, allowNull: true },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    };
    for (const [name, definition] of Object.entries(columns)) await queryInterface.addColumn('packages', name, definition);
    await queryInterface.changeColumn('packages', 'status', { type: Sequelize.ENUM('active', 'inactive', 'hidden'), allowNull: false, defaultValue: 'active' });
    await queryInterface.sequelize.query("UPDATE packages SET service_type = CASE WHEN group_type = 'wifi_5g' THEN 'wifi_5g' ELSE 'mobile' END, subscription_type = CASE WHEN group_type = 'tra_truoc' THEN 'prepaid' WHEN group_type = 'tra_sau' THEN 'postpaid' ELSE 'none' END, badges = CASE WHEN group_type = 'hot' THEN JSON_ARRAY('hot') ELSE JSON_ARRAY() END");
    await queryInterface.addIndex('packages', ['status', 'effective_from', 'effective_to']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('packages', ['status', 'effective_from', 'effective_to']);
    await queryInterface.changeColumn('packages', 'status', { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' });
    for (const name of ['service_type', 'subscription_type', 'badges', 'data_per_day_gb', 'data_per_cycle_gb', 'unlimited_data', 'benefits', 'conditions', 'audience', 'sms_syntax', 'image_url', 'effective_from', 'effective_to', 'deleted_at']) await queryInterface.removeColumn('packages', name);
  },
};
