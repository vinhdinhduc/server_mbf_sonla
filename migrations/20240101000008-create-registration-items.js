module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('registration_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      registration_group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'registration_groups', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: { type: Sequelize.ENUM('sim', 'goi_cuoc', 'giai_phap'), allowNull: false },
      reference_id: { type: Sequelize.INTEGER, allowNull: false },
      reference_label: { type: Sequelize.STRING(255), allowNull: false },
      price_snapshot: { type: Sequelize.DECIMAL(12, 0), allowNull: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('registration_items');
  },
};
