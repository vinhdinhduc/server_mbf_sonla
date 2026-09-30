'use strict';

// Additive only. Use scripts/ai-migrate.cjs to create and verify a backup first.
module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    if (tables.includes('ai_provider_calls_rollback')) {
      if (tables.includes('ai_provider_calls'))
        throw new Error('Both active and rollback tables exist; inspect before migrating.');
      await q.renameTable('ai_provider_calls_rollback', 'ai_provider_calls');
    }
    if (!tables.includes('ai_provider_calls') && !tables.includes('ai_provider_calls_rollback'))
      await q.createTable('ai_provider_calls', {
        id: { type: S.BIGINT, autoIncrement: true, primaryKey: true },
        request_id: { type: S.STRING(36), allowNull: false },
        attempt: { type: S.INTEGER, allowNull: false },
        purpose: { type: S.STRING(30), allowNull: false },
        provider: { type: S.STRING(50), allowNull: false },
        model: { type: S.STRING(150), allowNull: false },
        input_tokens: { type: S.BIGINT, allowNull: true },
        output_tokens: { type: S.BIGINT, allowNull: true },
        estimated_cost: { type: S.DECIMAL(18, 8), allowNull: true },
        input_per_million: { type: S.DECIMAL(12, 6), allowNull: true },
        output_per_million: { type: S.DECIMAL(12, 6), allowNull: true },
        latency_ms: { type: S.INTEGER, allowNull: false },
        error_code: { type: S.STRING(40), allowNull: true },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      });
    const indexes = await q.showIndex('ai_provider_calls');
    if (!indexes.some((i) => i.name === 'ai_calls_request_attempt'))
      await q.addIndex('ai_provider_calls', ['request_id', 'attempt'], {
        unique: true,
        name: 'ai_calls_request_attempt',
      });
    if (!indexes.some((i) => i.name === 'ai_calls_retention'))
      await q.addIndex('ai_provider_calls', ['created_at'], { name: 'ai_calls_retention' });
    if (!indexes.some((i) => i.name === 'ai_calls_model_time'))
      await q.addIndex('ai_provider_calls', ['provider', 'model', 'created_at'], {
        name: 'ai_calls_model_time',
      });
  },
  async down(q) {
    const tables = await q.showAllTables();
    if (!tables.includes('ai_provider_calls')) return;
    if (tables.includes('ai_provider_calls_rollback')) {
      throw new Error('Rollback archive already exists; preserve it before retrying.');
    }
    // Preserve all usage data. A subsequent up restores this table and its indexes.
    await q.renameTable('ai_provider_calls', 'ai_provider_calls_rollback');
  },
};
