'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sim_numbers', 'committed_monthly_fee', {
      type: Sequelize.DECIMAL(12, 0),
      allowNull: true,
      defaultValue: null,
      comment: 'Mức cước cam kết tối thiểu hàng tháng (đồng), chỉ áp dụng SIM trả sau',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('sim_numbers', 'committed_monthly_fee');
  },
};
