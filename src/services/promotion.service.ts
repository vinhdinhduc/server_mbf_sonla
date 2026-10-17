import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { Promotion } from '../models/Promotion.model';
import { PromotionEvent } from '../models/PromotionEvent.model';
import { AppError } from '../utils/AppError';
import {
  CreatePromotionDto, PromotionEventDto, PublicPromotionQuery, UpdatePromotionDto,
  normalizePromotionPath, promotionBoundsSchema,
} from '../validators/promotion.validator';

const publicAttributes = [
  'id', 'title', 'content', 'image_url', 'coupon_code', 'cta_text', 'cta_link',
  'effect_type', 'position', 'trigger_type', 'trigger_value', 'target_pages',
  'frequency', 'device', 'start_at', 'end_at', 'is_active',
];

export function promotionIsCurrent(
  promotion: { is_active: boolean; start_at: Date | null; end_at: Date | null },
  now = new Date(),
) {
  return promotion.is_active && (!promotion.start_at || new Date(promotion.start_at) <= now)
    && (!promotion.end_at || new Date(promotion.end_at) > now);
}

let lastEventCleanup = 0;
async function cleanExpiredEvents() {
  const now = Date.now();
  if (now - lastEventCleanup < 60_000) return;
  lastEventCleanup = now;
  // Retain retry deduplication for 90 days; cap each cleanup batch to avoid locking a large table.
  await PromotionEvent.destroy({
    where: { created_at: { [Op.lt]: new Date(now - 90 * 86400_000) } },
    limit: 1000,
  }).catch(() => { lastEventCleanup = 0; });
}

export const promotionService = {
  async list() {
    return Promotion.findAll({ order: [['created_at', 'DESC'], ['id', 'DESC']] });
  },
  async get(id: number) {
    const promotion = await Promotion.findByPk(id);
    if (!promotion) throw AppError.notFound('Không tìm thấy chương trình khuyến mại');
    return promotion;
  },
  async create(dto: CreatePromotionDto) {
    return Promotion.create(dto);
  },
  async update(id: number, dto: UpdatePromotionDto) {
    return sequelize.transaction(async (transaction) => {
      const promotion = await Promotion.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!promotion) throw AppError.notFound('Không tìm thấy chương trình khuyến mại');
      const previous = promotion.toJSON();
      promotionBoundsSchema.parse({ ...previous, ...dto });
      await promotion.update(dto, { transaction });
      return { promotion, previous };
    });
  },
  async remove(id: number) {
    const promotion = await this.get(id);
    const previous = promotion.toJSON();
    // The migration foreign key cascades deduplication records on removal.
    await promotion.destroy();
    return previous;
  },
  async listPublic(query: PublicPromotionQuery) {
    const now = new Date();
    const rows = await Promotion.findAll({
      attributes: publicAttributes,
      where: {
        is_active: true,
        device: { [Op.in]: ['all', query.device] },
        [Op.and]: [
          { [Op.or]: [{ start_at: null }, { start_at: { [Op.lte]: now } }] },
          { [Op.or]: [{ end_at: null }, { end_at: { [Op.gt]: now } }] },
        ],
      },
      order: [['created_at', 'DESC'], ['id', 'DESC']],
    });
    const path = normalizePromotionPath(query.path);
    return rows.filter((promotion) => !promotion.target_pages.length || promotion.target_pages.includes(path))
      .map((promotion) => {
        const values = promotion.toJSON() as Record<string, unknown>;
        // Explicit projection also protects public responses if the model changes later.
        return Object.fromEntries(publicAttributes.map((field) => [field, values[field]]));
      });
  },
  async recordEvent(id: number, dto: PromotionEventDto) {
    const result = await sequelize.transaction(async (transaction) => {
      // Serialize event creation against updates/deletion on this promotion. Counters use SQL increments.
      const promotion = await Promotion.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!promotion || !promotionIsCurrent(promotion)) {
        throw AppError.notFound('Chương trình khuyến mại không còn hiệu lực');
      }
      const where = { promotion_id: id, visit_id: dto.visit_id, event: dto.event };
      if (await PromotionEvent.findOne({ where, transaction })) return { recorded: false };
      await PromotionEvent.create(where, { transaction });
      const counter = { impression: 'impression_count', open: 'open_count', cta: 'cta_count' } as const;
      await promotion.increment(counter[dto.event], { by: 1, transaction, silent: true });
      return { recorded: true };
    });
    void cleanExpiredEvents();
    return result;
  },
};
