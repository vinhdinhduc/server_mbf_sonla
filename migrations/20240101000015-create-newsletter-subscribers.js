module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('newsletter_subscribers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: Sequelize.STRING(100), unique: true, allowNull: false },
      status: {
        type: Sequelize.ENUM('subscribed', 'unsubscribed'),
        allowNull: false,
        defaultValue: 'subscribed',
      },
      subscribed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('newsletter_subscribers');
  },
};
