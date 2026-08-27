module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('slider_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      zone_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'slider_zones', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      image_url: { type: Sequelize.STRING(255), allowNull: false },
      link_url: { type: Sequelize.STRING(255), allowNull: true },
      title: { type: Sequelize.STRING(255), allowNull: true },
      caption: { type: Sequelize.TEXT, allowNull: true },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      start_date: { type: Sequelize.DATE, allowNull: true },
      end_date: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('slider_items');
  },
};
