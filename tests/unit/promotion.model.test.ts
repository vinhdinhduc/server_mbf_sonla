import { Sequelize } from 'sequelize';
import { initPromotionModel, Promotion } from '../../src/models/Promotion.model';

describe('promotion JSON hydration', () => {
  const database = new Sequelize('hydration-test', 'test', '', { dialect: 'mysql', logging: false });
  beforeAll(() => { initPromotionModel(database); });
  afterAll(async () => { await database.close(); });

  test('MariaDB JSON text becomes an array and does not match home by substring', () => {
    const promotion = Promotion.build({ name: 'Test', title: 'Gift', content: 'Offer', target_pages: ['/kiem-thu-qua'] });
    promotion.setDataValue('target_pages', '["/kiem-thu-qua"]' as unknown as string[]);
    expect(promotion.target_pages).toEqual(['/kiem-thu-qua']);
    expect(promotion.target_pages.includes('/')).toBe(false);
    expect(promotion.toJSON().target_pages).toEqual(['/kiem-thu-qua']);
  });

  test('native MySQL JSON arrays and all-page arrays remain arrays', () => {
    const promotion = Promotion.build({ name: 'Test', title: 'Gift', content: 'Offer', target_pages: [] });
    expect(promotion.target_pages).toEqual([]);
    promotion.setDataValue('target_pages', ['/goi-cuoc']);
    expect(promotion.toJSON().target_pages).toEqual(['/goi-cuoc']);
  });

  test.each(['null', '{}', '[3]', 'broken JSON'])('malformed page metadata fails closed: %s', (value) => {
    const promotion = Promotion.build({ name: 'Test', title: 'Gift', content: 'Offer', target_pages: [] });
    promotion.setDataValue('target_pages', value as unknown as string[]);
    expect(() => promotion.target_pages).toThrow();
  });
});
