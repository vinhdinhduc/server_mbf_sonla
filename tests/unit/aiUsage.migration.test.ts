import { DataTypes } from 'sequelize';
const migration = require('../../migrations/20260930000001-ai-provider-usage');

describe('AI usage migration preserves existing data', () => {
  function database(initial: string[] = []) {
    const tables = new Set(initial);
    const indexes: { name: string }[] = [];
    return {
      tables,
      showAllTables: jest.fn(async () => [...tables]),
      createTable: jest.fn(async (name: string) => {
        tables.add(name);
      }),
      renameTable: jest.fn(async (from: string, to: string) => {
        tables.delete(from);
        tables.add(to);
      }),
      showIndex: jest.fn(async () => indexes),
      addIndex: jest.fn(async (_table: string, _fields: string[], options: { name: string }) => {
        indexes.push(options);
      }),
    };
  }
  test('up/down/up creates indexes, archives usage, then restores it', async () => {
    const db = database(['settings', 'ai_chat_logs']);
    await migration.up(db, DataTypes);
    expect(db.addIndex).toHaveBeenCalledTimes(3);
    const columns = (db.createTable.mock.calls[0] as unknown as [string, object])[1];
    expect(Object.keys(columns)).not.toEqual(
      expect.arrayContaining(['user_message', 'ai_response', 'api_key']),
    );
    await migration.down(db);
    expect(db.tables.has('ai_provider_calls_rollback')).toBe(true);
    expect(db.tables.has('ai_chat_logs')).toBe(true);
    await migration.up(db, DataTypes);
    expect(db.createTable).toHaveBeenCalledTimes(1);
    expect(db.addIndex).toHaveBeenCalledTimes(3);
    expect(db.tables.has('ai_provider_calls')).toBe(true);
  });
  test('resumes missing indexes after partial DDL failure', async () => {
    const db = database(['ai_provider_calls']);
    await migration.up(db, DataTypes);
    expect(db.createTable).not.toHaveBeenCalled();
    expect(db.addIndex).toHaveBeenCalledTimes(3);
  });
  test('never overwrites an existing rollback archive', async () => {
    const db = database(['ai_provider_calls', 'ai_provider_calls_rollback']);
    await expect(migration.down(db)).rejects.toThrow('archive already exists');
    expect(db.renameTable).not.toHaveBeenCalled();
  });
});
