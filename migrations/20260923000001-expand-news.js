const addColumn = async (queryInterface, table, name, definition) => {
  const columns = await queryInterface.describeTable(table);
  if (!columns[name]) await queryInterface.addColumn(table, name, definition);
};

const addIndex = async (queryInterface, table, fields, options) => {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(table, fields, options);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_categories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    const [existingCategories] = await queryInterface.sequelize.query('SELECT slug FROM news_categories');
    const existingSlugs = new Set(existingCategories.map((category) => category.slug));
    const missingCategories = [
      { name: 'Khuyến mãi', slug: 'khuyen_mai', sort_order: 1, created_at: new Date(), updated_at: new Date() },
      { name: 'Sự kiện', slug: 'su_kien', sort_order: 2, created_at: new Date(), updated_at: new Date() },
      { name: 'Thông báo', slug: 'thong_bao', sort_order: 3, created_at: new Date(), updated_at: new Date() },
    ].filter((category) => !existingSlugs.has(category.slug));
    if (missingCategories.length) {
      await queryInterface.bulkInsert('news_categories', missingCategories);
    }
    await queryInterface.createTable('news_tags', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.createTable('news_tag_map', {
      news_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'news', key: 'id' }, onDelete: 'CASCADE' },
      tag_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'news_tags', key: 'id' }, onDelete: 'CASCADE' },
    });
    await queryInterface.createTable('news_slug_history', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      news_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'news', key: 'id' }, onDelete: 'CASCADE' },
      old_slug: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.createTable('news_views', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      news_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'news', key: 'id' }, onDelete: 'CASCADE' },
      visitor_hash: { type: Sequelize.STRING(64), allowNull: false },
      viewed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await addIndex(queryInterface, 'news_views', ['news_id', 'visitor_hash', 'viewed_at'], { name: 'idx_news_views_dedupe' });

    await addColumn(queryInterface, 'news', 'category_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'news_categories', key: 'id' }, onDelete: 'SET NULL' });
    await addColumn(queryInterface, 'news', 'cover_url', { type: Sequelize.STRING(500), allowNull: true });
    await addColumn(queryInterface, 'news', 'cover_alt', { type: Sequelize.STRING(255), allowNull: true });
    await addColumn(queryInterface, 'news', 'is_featured', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumn(queryInterface, 'news', 'is_pinned', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumn(queryInterface, 'news', 'view_count', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 });
    await addColumn(queryInterface, 'news', 'seo_title', { type: Sequelize.STRING(60), allowNull: true });
    await addColumn(queryInterface, 'news', 'seo_description', { type: Sequelize.STRING(160), allowNull: true });
    await addColumn(queryInterface, 'news', 'og_image_url', { type: Sequelize.STRING(500), allowNull: true });
    await addColumn(queryInterface, 'news', 'canonical_url', { type: Sequelize.STRING(500), allowNull: true });
    await addColumn(queryInterface, 'news', 'search_text', { type: Sequelize.TEXT, allowNull: true });
    await addColumn(queryInterface, 'news', 'autosave_content', { type: Sequelize.TEXT('long'), allowNull: true });
    await addColumn(queryInterface, 'news', 'preview_token', { type: Sequelize.STRING(64), allowNull: true, unique: true });
    await addColumn(queryInterface, 'news', 'deleted_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.changeColumn('news', 'status', { type: Sequelize.ENUM('draft', 'scheduled', 'published', 'archived'), allowNull: false, defaultValue: 'draft' });
    // Legacy and newly created tables can use different default collations.
    await queryInterface.sequelize.query(`
      UPDATE news n
      JOIN news_categories c
        ON CONVERT(c.slug USING utf8mb4) COLLATE utf8mb4_unicode_ci
         = CONVERT(n.category USING utf8mb4) COLLATE utf8mb4_unicode_ci
      SET n.category_id=COALESCE(n.category_id,c.id),
          n.cover_url=COALESCE(n.cover_url,n.thumbnail),
          n.search_text=COALESCE(n.search_text,LOWER(CONCAT_WS(' ',n.title,n.summary)))
    `);
    await addIndex(queryInterface, 'news', ['status', 'published_at'], { name: 'idx_news_publication' });
    await addIndex(queryInterface, 'news', ['is_featured', 'published_at'], { name: 'idx_news_featured' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('news', 'idx_news_featured').catch(() => {});
    await queryInterface.removeIndex('news', 'idx_news_publication').catch(() => {});
    await queryInterface.changeColumn('news', 'status', { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' });
    for (const column of ['deleted_at', 'preview_token', 'autosave_content', 'search_text', 'canonical_url', 'og_image_url', 'seo_description', 'seo_title', 'view_count', 'is_pinned', 'is_featured', 'cover_alt', 'cover_url', 'category_id']) {
      await queryInterface.removeColumn('news', column).catch(() => {});
    }
    await queryInterface.dropTable('news_views');
    await queryInterface.dropTable('news_slug_history');
    await queryInterface.dropTable('news_tag_map');
    await queryInterface.dropTable('news_tags');
    await queryInterface.dropTable('news_categories');
  },
};
