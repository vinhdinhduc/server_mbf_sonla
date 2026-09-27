'use strict';

const tables = [
  'registration_groups',
  'contact_messages',
  'newsletter_subscribers',
  'store_appointments',
  'job_applications',
  'ai_chat_logs',
];
module.exports = {
  async up(q, S) {
    for (const table of tables) {
      // Historical records have no evidence of accepting v1.0: leave them NULL.
      await q.addColumn(table, 'agreed_terms_at', { type: S.DATE, allowNull: true });
      await q.addColumn(table, 'agreed_terms_version', { type: S.STRING(20), allowNull: true });
    }
    await q.addColumn('users', 'session_version', {
      type: S.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await q.createTable('password_reset_otp', {
      id: { type: S.STRING(64), primaryKey: true, allowNull: false },
      user_id: {
        type: S.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      otp_code: { type: S.STRING(64), allowNull: false }, // HMAC, never plaintext
      expires_at: { type: S.DATE, allowNull: false },
      is_used: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      attempts: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      reset_token_hash: { type: S.STRING(64), allowNull: true },
      created_at: { type: S.DATE, allowNull: false },
    });
    await q.addIndex('password_reset_otp', ['user_id', 'created_at']);
    await q.addIndex('password_reset_otp', ['expires_at']);
    await q.createTable('password_reset_limits', {
      key: { type: S.STRING(64), primaryKey: true, allowNull: false },
      hits: { type: S.TEXT, allowNull: false },
      updated_at: { type: S.DATE, allowNull: false },
    });
  },
  async down(q) {
    await q.dropTable('password_reset_limits');
    await q.dropTable('password_reset_otp');
    await q.removeColumn('users', 'session_version');
    for (const table of tables) {
      await q.removeColumn(table, 'agreed_terms_version');
      await q.removeColumn(table, 'agreed_terms_at');
    }
  },
};
