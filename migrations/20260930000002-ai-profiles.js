'use strict';

module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    if (tables.includes('ai_profiles_rollback') && !tables.includes('ai_profiles')) {
      await q.renameTable('ai_profiles_rollback', 'ai_profiles');
      return;
    }
    if (tables.includes('ai_profiles')) return;
    await q.createTable('ai_profiles', {
      id: { type: S.STRING(36), primaryKey: true },
      position: { type: S.INTEGER, allowNull: false },
      config: { type: S.JSON, allowNull: false },
      api_key_encrypted: { type: S.TEXT, allowNull: true },
      updated_by: { type: S.INTEGER, allowNull: true },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    // Legacy settings stay intact. They are exposed as a virtual profile until the first save.
  },
  async down(q) {
    const tables = await q.showAllTables();
    if (!tables.includes('ai_profiles')) return;
    if (tables.includes('ai_profiles_rollback')) throw new Error('Profile rollback archive already exists');
    await q.renameTable('ai_profiles', 'ai_profiles_rollback');
  },
};
