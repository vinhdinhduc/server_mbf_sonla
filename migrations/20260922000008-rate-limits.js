const defaults = [
  ['login', 5, 900, 900, 'ip_username'],
  ['contact', 5, 3600, 3600, 'ip'],
  ['registration_ip', 10, 3600, 3600, 'ip'],
  ['registration_phone', 3, 3600, 3600, 'phone'],
  ['appointment', 5, 3600, 3600, 'ip'],
  ['newsletter', 5, 3600, 3600, 'ip'],
  ['lookup', 10, 60, 60, 'ip'],
  ['sim_search', 120, 60, 60, 'ip'],
  ['public_general', 300, 60, 60, 'ip'],
  ['chat', 30, 60, 60, 'ip'],
  ['upload', 30, 60, 60, 'user'],
];
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rate_limit_policies', {
      key: { type: Sequelize.STRING(40), primaryKey: true },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      max_requests: { type: Sequelize.INTEGER, allowNull: false },
      window_seconds: { type: Sequelize.INTEGER, allowNull: false },
      block_seconds: { type: Sequelize.INTEGER, allowNull: false },
      key_by: { type: Sequelize.STRING(30), allowNull: false },
      message: { type: Sequelize.STRING(255), allowNull: false, defaultValue: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.bulkInsert('rate_limit_policies', defaults.map(([key, max_requests, window_seconds, block_seconds, key_by]) => ({ key, max_requests, window_seconds, block_seconds, key_by, enabled: true, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.', updated_at: new Date() })));
    await queryInterface.createTable('rate_limit_ip_rules', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      kind: { type: Sequelize.ENUM('allow', 'block'), allowNull: false },
      cidr: { type: Sequelize.STRING(64), allowNull: false },
      reason: { type: Sequelize.STRING(255), allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('rate_limit_ip_rules', ['kind', 'cidr'], { unique: true });
    await queryInterface.createTable('rate_limit_blocks', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      policy_key: { type: Sequelize.STRING(40), allowNull: false },
      ip: { type: Sequelize.STRING(45), allowNull: false },
      blocked_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('rate_limit_blocks', ['policy_key', 'blocked_at']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('rate_limit_blocks');
    await queryInterface.dropTable('rate_limit_ip_rules');
    await queryInterface.dropTable('rate_limit_policies');
  },
};
