'use strict';

const { QueryTypes } = require('sequelize');

function safeLegacyLink(value) {
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return null;
  if (!value.startsWith('/') && !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value, 'https://promotion.invalid');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

async function preserveLegacyPopup(queryInterface, tables) {
  if (!tables.has('settings')) return;
  const rows = await queryInterface.sequelize.query(
    'SELECT `key`, `value` FROM `settings` WHERE `key` IN (:keys)',
    {
      replacements: { keys: ['promo_popup_enabled', 'promo_popup_title', 'promo_popup_content', 'promo_popup_url'] },
      type: QueryTypes.SELECT,
    },
  );
  const values = Object.fromEntries(rows.map((row) => [row.key, String(row.value || '').trim()]));
  if (!values.promo_popup_title && !values.promo_popup_content) return;
  const name = 'Popup khuyến mại hiện có';
  const existing = await queryInterface.sequelize.query(
    'SELECT `id` FROM `promotions` WHERE `name` = :name LIMIT 1',
    { replacements: { name }, type: QueryTypes.SELECT },
  );
  if (existing.length) return;
  const link = safeLegacyLink(values.promo_popup_url);
  const now = new Date();
  await queryInterface.bulkInsert('promotions', [{
    name,
    title: (values.promo_popup_title || 'Ưu đãi dành cho bạn').slice(0, 255),
    content: (values.promo_popup_content || values.promo_popup_title).slice(0, 10000),
    image_url: null,
    coupon_code: null,
    cta_text: link ? 'Xem ưu đãi' : null,
    cta_link: link,
    effect_type: 'popup',
    position: 'center',
    trigger_type: 'delay',
    trigger_value: 2,
    target_pages: JSON.stringify([]),
    frequency: 'visit',
    device: 'all',
    start_at: null,
    end_at: null,
    is_active: values.promo_popup_enabled === 'true',
    impression_count: 0,
    open_count: 0,
    cta_count: 0,
    created_at: now,
    updated_at: now,
  }]);
}

async function ensureIndex(queryInterface, table, fields, options) {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(table, fields, options);
  }
}

async function requireCompatibleTable(queryInterface, table, columns) {
  const existing = await queryInterface.describeTable(table);
  const missing = columns.filter((column) => !Object.prototype.hasOwnProperty.call(existing, column));
  if (missing.length) throw new Error(`Existing ${table} table has incompatible schema; missing: ${missing.join(', ')}`);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = new Set(await queryInterface.showAllTables());
    if (tables.has('promotions')) await requireCompatibleTable(queryInterface, 'promotions', [
      'id', 'name', 'title', 'content', 'image_url', 'coupon_code', 'cta_text', 'cta_link',
      'effect_type', 'position', 'trigger_type', 'trigger_value', 'target_pages', 'frequency',
      'device', 'start_at', 'end_at', 'is_active', 'impression_count', 'open_count', 'cta_count',
      'created_at', 'updated_at',
    ]);
    if (tables.has('promotion_events')) await requireCompatibleTable(queryInterface, 'promotion_events', [
      'id', 'promotion_id', 'visit_id', 'event', 'created_at',
    ]);
    if (!tables.has('promotions')) await queryInterface.createTable('promotions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(160), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      image_url: { type: Sequelize.STRING(2000), allowNull: true },
      coupon_code: { type: Sequelize.STRING(100), allowNull: true },
      cta_text: { type: Sequelize.STRING(100), allowNull: true },
      cta_link: { type: Sequelize.STRING(2000), allowNull: true },
      effect_type: { type: Sequelize.ENUM('bounce', 'shake', 'popup'), allowNull: false, defaultValue: 'bounce' },
      position: { type: Sequelize.ENUM('center', 'bottom_right', 'bottom_left'), allowNull: false, defaultValue: 'bottom_right' },
      trigger_type: { type: Sequelize.ENUM('immediate', 'delay', 'scroll'), allowNull: false, defaultValue: 'delay' },
      trigger_value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      target_pages: { type: Sequelize.JSON, allowNull: false },
      frequency: { type: Sequelize.ENUM('visit', 'daily', 'once'), allowNull: false, defaultValue: 'daily' },
      device: { type: Sequelize.ENUM('desktop', 'mobile', 'all'), allowNull: false, defaultValue: 'all' },
      start_at: { type: Sequelize.DATE, allowNull: true },
      end_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      impression_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      open_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      cta_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await ensureIndex(queryInterface, 'promotions', ['is_active', 'start_at', 'end_at'], { name: 'promotions_schedule' });
    if (!tables.has('promotion_events')) await queryInterface.createTable('promotion_events', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      promotion_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'promotions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE',
      },
      visit_id: { type: Sequelize.UUID, allowNull: false },
      event: { type: Sequelize.ENUM('impression', 'open', 'cta'), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await ensureIndex(queryInterface, 'promotion_events', ['promotion_id', 'visit_id', 'event'], {
      unique: true, name: 'promotion_event_visit_unique',
    });
    await ensureIndex(queryInterface, 'promotion_events', ['created_at'], { name: 'promotion_events_created_at' });
    await preserveLegacyPopup(queryInterface, tables);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('promotion_events');
    await queryInterface.dropTable('promotions');
  },
};
