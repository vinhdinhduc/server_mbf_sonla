module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('sim_numbers', 'subscription_type', {
      type: Sequelize.ENUM('prepaid', 'postpaid'),
      allowNull: true,
    });
    await queryInterface.addColumn('sim_numbers', 'needs_review', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('sim_numbers', 'reserved_until', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('sim_numbers', 'reserved_registration_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('sim_numbers', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('sim_numbers', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      "UPDATE sim_numbers SET subscription_type = CASE WHEN catalog = 'tra_truoc' THEN 'prepaid' ELSE 'postpaid' END, needs_review = CASE WHEN catalog = 'tra_truoc' THEN 0 ELSE 1 END",
    );
    await queryInterface.changeColumn('sim_numbers', 'subscription_type', {
      type: Sequelize.ENUM('prepaid', 'postpaid'),
      allowNull: false,
    });
    await queryInterface.changeColumn('sim_numbers', 'price', {
      type: Sequelize.DECIMAL(12, 0),
      allowNull: true,
    });
    await queryInterface.addIndex('sim_numbers', ['subscription_type', 'status'], {
      name: 'idx_sim_subscription_status',
    });
    await queryInterface.bulkInsert(
      'settings',
      [
        { key: 'sim_activation_fee_prepaid', value: '50000', group: 'general', updated_at: new Date() },
        { key: 'sim_activation_fee_postpaid', value: '60000', group: 'general', updated_at: new Date() },
      ],
      { ignoreDuplicates: true },
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('sim_numbers', 'idx_sim_subscription_status');
    await queryInterface.changeColumn('sim_numbers', 'price', {
      type: Sequelize.DECIMAL(12, 0),
      allowNull: false,
    });
    await queryInterface.removeColumn('sim_numbers', 'deleted_at');
    await queryInterface.removeColumn('sim_numbers', 'updated_at');
    await queryInterface.removeColumn('sim_numbers', 'reserved_registration_id');
    await queryInterface.removeColumn('sim_numbers', 'reserved_until');
    await queryInterface.removeColumn('sim_numbers', 'needs_review');
    await queryInterface.removeColumn('sim_numbers', 'subscription_type');
    await queryInterface.bulkDelete('settings', {
      key: ['sim_activation_fee_prepaid', 'sim_activation_fee_postpaid'],
    });
  },
};
