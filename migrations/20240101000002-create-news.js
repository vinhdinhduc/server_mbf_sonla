module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('news', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(255), unique: true, allowNull: false },
      category: {
        type: Sequelize.ENUM('khuyen_mai', 'su_kien', 'thong_bao'),
        allowNull: false,
      },
      thumbnail: { type: Sequelize.STRING(255), allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      content: { type: Sequelize.TEXT('long'), allowNull: false },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      published_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('news');
  },
};
