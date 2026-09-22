module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = {
      mobile_image_url: { type: Sequelize.STRING(255), allowNull: true },
      alt_text: { type: Sequelize.STRING(255), allowNull: true },
      open_new_tab: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      image_width: { type: Sequelize.INTEGER, allowNull: true },
      image_height: { type: Sequelize.INTEGER, allowNull: true },
      image_bytes: { type: Sequelize.INTEGER, allowNull: true },
      person_name: { type: Sequelize.STRING(100), allowNull: true },
      job_title: { type: Sequelize.STRING(100), allowNull: true },
      rating: { type: Sequelize.INTEGER, allowNull: true },
    };
    for (const [name, definition] of Object.entries(columns)) await queryInterface.addColumn('slider_items', name, definition);
    await queryInterface.addIndex('slider_items', ['zone_id', 'status', 'start_date', 'end_date']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('slider_items', ['zone_id', 'status', 'start_date', 'end_date']);
    for (const name of ['mobile_image_url', 'alt_text', 'open_new_tab', 'image_width', 'image_height', 'image_bytes', 'person_name', 'job_title', 'rating']) await queryInterface.removeColumn('slider_items', name);
  },
};
