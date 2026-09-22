module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = {
      hero_badge: { type: Sequelize.STRING(100), allowNull: true },
      hero_title: { type: Sequelize.STRING(255), allowNull: true },
      hero_subtitle: { type: Sequelize.TEXT, allowNull: true },
      cta_label: { type: Sequelize.STRING(100), allowNull: true },
      cta_url: { type: Sequelize.STRING(255), allowNull: true },
      audience_cards: { type: Sequelize.JSON, allowNull: true },
      section_visibility: { type: Sequelize.JSON, allowNull: true },
      seo_title: { type: Sequelize.STRING(60), allowNull: true },
      seo_description: { type: Sequelize.STRING(160), allowNull: true },
    };
    for (const [name, definition] of Object.entries(columns)) await queryInterface.addColumn('solutions', name, definition);
    await queryInterface.createTable('solution_steps', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'solutions', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      icon: { type: Sequelize.STRING(100), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('solution_steps');
    for (const name of ['hero_badge', 'hero_title', 'hero_subtitle', 'cta_label', 'cta_url', 'audience_cards', 'section_visibility', 'seo_title', 'seo_description']) await queryInterface.removeColumn('solutions', name);
  },
};
