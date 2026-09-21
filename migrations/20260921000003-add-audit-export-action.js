module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('audit_logs', 'action', {
      type: Sequelize.ENUM('create', 'update', 'delete', 'login', 'logout', 'export'),
      allowNull: false,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query("UPDATE audit_logs SET action = 'create' WHERE action = 'export'");
    await queryInterface.changeColumn('audit_logs', 'action', {
      type: Sequelize.ENUM('create', 'update', 'delete', 'login', 'logout'),
      allowNull: false,
    });
  },
};
