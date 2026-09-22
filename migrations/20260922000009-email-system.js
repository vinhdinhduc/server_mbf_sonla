const templates = [
  ['registration_received_customer', 'Xác nhận đăng ký {{registration_code}}', '<p>Chào {{customer_name}},</p><p>Chúng tôi đã nhận đăng ký <strong>{{registration_code}}</strong> của bạn và sẽ liên hệ sớm.</p>'],
  ['registration_new_staff', 'Đăng ký mới {{registration_code}}', '<p>Có đăng ký mới {{registration_code}} từ {{customer_name}} ({{phone}}).</p>'],
  ['registration_status_changed', 'Cập nhật đăng ký {{registration_code}}', '<p>Đăng ký {{registration_code}} của bạn đã chuyển sang trạng thái {{status}}.</p>'],
  ['contact_new_staff', 'Liên hệ mới từ {{customer_name}}', '<p>{{customer_name}} ({{phone}}) gửi liên hệ: {{message}}</p>'],
  ['contact_received_customer', 'Đã nhận liên hệ của bạn', '<p>Chào {{customer_name}}, chúng tôi đã nhận nội dung của bạn.</p>'],
  ['appointment_confirmed', 'Xác nhận lịch hẹn tại {{store_name}}', '<p>Chào {{customer_name}}, lịch hẹn của bạn tại {{store_name}} đã được ghi nhận.</p>'],
  ['appointment_new_staff', 'Lịch hẹn mới tại {{store_name}}', '<p>Có lịch hẹn mới của {{customer_name}} tại {{store_name}}.</p>'],
  ['account_created', 'Tài khoản quản trị đã được tạo', '<p>Chào {{customer_name}}, tài khoản của bạn đã được tạo.</p>'],
];
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('store_appointments', 'email', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.createTable('email_smtp_settings', {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      host: { type: Sequelize.STRING(255), allowNull: false },
      port: { type: Sequelize.INTEGER, allowNull: false },
      security: { type: Sequelize.ENUM('none', 'starttls', 'ssl'), allowNull: false },
      username: { type: Sequelize.STRING(255), allowNull: false },
      password_enc: { type: Sequelize.TEXT, allowNull: true },
      from_name: { type: Sequelize.STRING(100), allowNull: false },
      from_email: { type: Sequelize.STRING(255), allowNull: false },
      reply_to: { type: Sequelize.STRING(255), allowNull: true },
      bcc: { type: Sequelize.STRING(255), allowNull: true },
      send_limit_hour: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 200 },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.createTable('email_templates', {
      key: { type: Sequelize.STRING(80), primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      subject: { type: Sequelize.STRING(255), allowNull: false },
      html: { type: Sequelize.TEXT, allowNull: false },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.bulkInsert('email_templates', templates.map(([key, subject, html]) => ({ key, name: key, subject, html, enabled: true, updated_at: new Date() })));
    await queryInterface.createTable('email_outbox', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      idempotency_key: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      recipient: { type: Sequelize.STRING(255), allowNull: false },
      template_key: { type: Sequelize.STRING(80), allowNull: false },
      data_json: { type: Sequelize.JSON, allowNull: false },
      status: { type: Sequelize.ENUM('queued', 'processing', 'sent', 'failed', 'suppressed'), allowNull: false, defaultValue: 'queued' },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      next_attempt_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      locked_at: { type: Sequelize.DATE, allowNull: true },
      claim_token: { type: Sequelize.STRING(36), allowNull: true },
      last_error: { type: Sequelize.STRING(500), allowNull: true },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('email_outbox', ['status', 'next_attempt_at']);
    await queryInterface.createTable('email_suppressions', {
      email: { type: Sequelize.STRING(255), primaryKey: true },
      reason: { type: Sequelize.STRING(100), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('email_suppressions');
    await queryInterface.dropTable('email_outbox');
    await queryInterface.dropTable('email_templates');
    await queryInterface.dropTable('email_smtp_settings');
    await queryInterface.removeColumn('store_appointments', 'email');
  },
};
