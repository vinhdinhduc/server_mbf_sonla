module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('solutions', 'category', {
      type: Sequelize.ENUM('sme', 'ubnd', 'ho_kinh_doanh', 'cuc_nganh', 'chuyen_doi_so'),
      allowNull: false,
    });
    await queryInterface.addColumn('solutions', 'target_customers', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('solutions', 'legal_basis', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('solutions', 'brochure_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('solutions', 'video_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    const solutionForeignKey = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'solutions', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    };
    await queryInterface.createTable('solution_features', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: solutionForeignKey,
      icon: { type: Sequelize.STRING(100), allowNull: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
    await queryInterface.createTable('solution_pricing', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: solutionForeignKey,
      package_code: { type: Sequelize.STRING(50), allowNull: false },
      package_name: { type: Sequelize.STRING(255), allowNull: false },
      price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      cycle_months: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      condition_note: { type: Sequelize.STRING(255), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
    await queryInterface.createTable('solution_faqs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: solutionForeignKey,
      question: { type: Sequelize.STRING(500), allowNull: false },
      answer: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
    await queryInterface.createTable('solution_gallery', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: solutionForeignKey,
      image_url: { type: Sequelize.STRING(255), allowNull: false },
      caption: { type: Sequelize.STRING(255), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('solution_gallery');
    await queryInterface.dropTable('solution_faqs');
    await queryInterface.dropTable('solution_pricing');
    await queryInterface.dropTable('solution_features');
    await queryInterface.removeColumn('solutions', 'video_url');
    await queryInterface.removeColumn('solutions', 'brochure_url');
    await queryInterface.removeColumn('solutions', 'legal_basis');
    await queryInterface.removeColumn('solutions', 'target_customers');
    await queryInterface.changeColumn('solutions', 'category', {
      type: Sequelize.ENUM('sme', 'ubnd', 'ho_kinh_doanh', 'cuc_nganh'),
      allowNull: false,
    });
  },
};
