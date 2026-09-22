module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('registration_groups', ['created_at', 'status'], { name: 'idx_registration_created_status' });
    await queryInterface.addIndex('store_appointments', ['store_id', 'appointment_date'], { name: 'idx_appointment_store_date' });
    await queryInterface.addIndex('contact_messages', ['created_at', 'status'], { name: 'idx_contact_created_status' });
    await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'idx_audit_created' });
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('audit_logs', 'idx_audit_created');
    await queryInterface.removeIndex('contact_messages', 'idx_contact_created_status');
    await queryInterface.removeIndex('store_appointments', 'idx_appointment_store_date');
    await queryInterface.removeIndex('registration_groups', 'idx_registration_created_status');
  },
};
