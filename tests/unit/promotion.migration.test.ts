import { DataTypes } from 'sequelize';

const migration = require('../../migrations/20261013000001-create-promotions');

function database(initial: string[] = [], settings: Record<string, string> = {}) {
  const tables = new Set(initial);
  const indexes: { name: string }[] = [];
  const schemas = new Map<string, object>();
  let imported = false;
  return {
    showAllTables: jest.fn(async () => [...tables]),
    createTable: jest.fn(async (name: string, columns: object) => { tables.add(name); schemas.set(name, columns); }),
    describeTable: jest.fn(async (name: string) => schemas.get(name) || {}),
    showIndex: jest.fn(async () => indexes),
    addIndex: jest.fn(async (_table: string, _fields: string[], options: { name: string }) => { indexes.push(options); }),
    bulkInsert: jest.fn(async () => { imported = true; }),
    dropTable: jest.fn(async (table: string) => { tables.delete(table); }),
    sequelize: { query: jest.fn(async (sql: string) => sql.includes('FROM `settings`')
      ? Object.entries(settings).map(([key, value]) => ({ key, value })) : imported ? [{ id: 1 }] : []), },
  };
}

test('promotion migration creates deduplication key and cascades event deletion, safely resumes after DDL', async () => {
  const db = database();
  await migration.up(db, DataTypes);
  expect(db.createTable.mock.calls.map(([name]) => name)).toEqual(['promotions', 'promotion_events']);
  expect(db.addIndex).toHaveBeenCalledWith('promotion_events', ['promotion_id', 'visit_id', 'event'], { unique: true, name: 'promotion_event_visit_unique' });
  const columns = (db.createTable.mock.calls[1] as unknown as [string, Record<string, unknown>])[1];
  expect(columns.promotion_id).toEqual(expect.objectContaining({ references: { model: 'promotions', key: 'id' }, onDelete: 'CASCADE' }));
  await migration.up(db, DataTypes);
  expect(db.createTable).toHaveBeenCalledTimes(2);
  expect(db.addIndex).toHaveBeenCalledTimes(3);
  await migration.down(db);
  expect(db.dropTable.mock.calls.map(([name]) => name)).toEqual(['promotion_events', 'promotions']);
});

test('legacy popup configuration is preserved once and dangerous CTA is discarded', async () => {
  const db = database(['settings'], { promo_popup_enabled: 'true', promo_popup_title: 'Ưu đãi cũ', promo_popup_content: 'Giảm 20%', promo_popup_url: 'javascript:alert(1)' });
  await migration.up(db, DataTypes);
  expect(db.bulkInsert).toHaveBeenCalledWith('promotions', [expect.objectContaining({ title: 'Ưu đãi cũ', content: 'Giảm 20%', cta_link: null, cta_text: null, effect_type: 'popup', position: 'center', trigger_type: 'delay', trigger_value: 2, frequency: 'visit', target_pages: '[]', is_active: true })]);
  await migration.up(db, DataTypes);
  expect(db.bulkInsert).toHaveBeenCalledTimes(1);
});

test('legacy safe internal links and disabled state survive import', async () => {
  const db = database(['settings'], { promo_popup_enabled: 'false', promo_popup_title: 'Ưu đãi', promo_popup_url: '/goi-cuoc?gift=1' });
  await migration.up(db, DataTypes);
  expect(db.bulkInsert).toHaveBeenCalledWith('promotions', [expect.objectContaining({ cta_link: '/goi-cuoc?gift=1', cta_text: 'Xem ưu đãi', is_active: false })]);
});

test('empty or missing legacy settings do not manufacture an unwanted campaign', async () => {
  const db = database(['settings'], { promo_popup_enabled: 'true' });
  await migration.up(db, DataTypes);
  expect(db.bulkInsert).not.toHaveBeenCalled();
});

test('existing unrelated tables are rejected before changing schema', async () => {
  const db = database(['promotions']);
  await expect(migration.up(db, DataTypes)).rejects.toThrow('incompatible schema');
  expect(db.createTable).not.toHaveBeenCalled();
  expect(db.addIndex).not.toHaveBeenCalled();
});
