'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      code: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      address: { type: Sequelize.STRING(500), allowNull: false },
      latitude: { type: Sequelize.DOUBLE, allowNull: false },
      longitude: { type: Sequelize.DOUBLE, allowNull: false },
      type: { type: Sequelize.ENUM('2G', '3G', '4G', '5G'), allowNull: false },
      status: {
        type: Sequelize.ENUM('active', 'warning', 'incident', 'maintenance'),
        allowNull: false,
        defaultValue: 'active',
      },
      power_watts: { type: Sequelize.DOUBLE, allowNull: true },
      coverage_radius_m: { type: Sequelize.INTEGER, allowNull: true },
      installed_at: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('stations', ['status', 'type']);
    await queryInterface.addIndex('stations', ['latitude', 'longitude']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('stations');
  },
};
