import { Op } from 'sequelize';
import { Setting } from '../../src/models/Setting.model';
import { settingService } from '../../src/services/setting.service';

describe('general settings cannot expose AI credentials', () => {
  afterEach(() => jest.restoreAllMocks());
  test('admin settings excludes encrypted keys', async () => {
    const find = jest.spyOn(Setting, 'findAll').mockResolvedValue([]);
    await settingService.listAdmin();
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: { [Op.notLike]: '%encrypted%' } } }),
    );
  });
  test('cannot write ciphertext through the general settings route', async () => {
    const upsert = jest.spyOn(Setting, 'upsert').mockResolvedValue([] as never);
    await expect(
      settingService.updateByGroup(
        { group: 'ai', items: [{ key: 'ai_api_key_encrypted', value: 'raw-key' }] },
        1,
      ),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  test('updating another AI setting does not return stored credentials', async () => {
    jest.spyOn(Setting, 'upsert').mockResolvedValue([] as never);
    const find = jest.spyOn(Setting, 'findAll').mockResolvedValue([]);
    await settingService.updateByGroup(
      { group: 'ai', items: [{ key: 'ai_daily_limit', value: '20' }] },
      1,
    );
    expect(find).toHaveBeenCalledWith({
      where: { group: 'ai', key: { [Op.notLike]: '%encrypted%' } },
    });
  });
});
