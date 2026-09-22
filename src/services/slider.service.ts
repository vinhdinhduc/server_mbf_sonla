import { SliderZone } from '../models/SliderZone.model';
import { SliderItem } from '../models/SliderItem.model';
import { AppError } from '../utils/AppError';
import {
  CreateSliderItemDto,
  UpdateSliderItemDto,
  UpdateSliderZoneDto,
} from '../validators/slider.validator';
import { attachImageUrls } from '../utils/buildImageUrl';
import { Op } from 'sequelize';
import { sliderEffectiveStatus } from '../utils/sliderStatus';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { Package } from '../models/Package.model';
import { Solution } from '../models/Solution.model';
import { News } from '../models/News.model';

function withEffectiveStatus<T extends { status: string; start_date: Date | null; end_date: Date | null }>(item: T) {
  const effective_status = sliderEffectiveStatus(item);
  return { ...item, effective_status };
}

async function removeUnusedUpload(value: string | null) {
  if (!value?.startsWith('/uploads/')) return;
  const references = await Promise.all([
    SliderItem.count({ where: { [Op.or]: [{ image_url: value }, { mobile_image_url: value }] } }),
    Package.count({ where: { image_url: value } }),
    Solution.count({ where: { thumbnail: value } }),
    News.count({ where: { thumbnail: value } }),
  ]);
  if (references.some(Boolean)) return;
  const name = path.basename(value);
  if (!/^[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg|gif)$/.test(name)) return;
  const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const names = name.endsWith('-optimized.webp') ? [name, name.replace('-optimized.webp', '-480.webp'), name.replace('-optimized.webp', '-960.webp')] : [name];
  await Promise.all(names.map((filename) => fs.unlink(path.join(root, filename)).catch(() => undefined)));
}

export const sliderService = {
  /** GET /api/public/sliders/:zoneCode - chi tra cac item dang duoc bat */
  async getPublicByZoneCode(zoneCode: string) {
    const zone = await SliderZone.findOne({ where: { code: zoneCode, status: 'active' } });
    if (!zone) throw AppError.notFound('Không tìm thấy khu vực slider');

    const items = await SliderItem.findAll({
      where: {
        zone_id: zone.id,
        status: 'active',
        [Op.and]: [
          { [Op.or]: [{ start_date: null }, { start_date: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: new Date() } }] },
        ],
      },
      order: [['display_order', 'ASC']],
    });

    return {
      animation_type: zone.animation_type,
      autoplay_enabled: zone.autoplay_enabled,
      autoplay_speed_ms: zone.autoplay_speed_ms,
      items: items.map((i) => withEffectiveStatus(attachImageUrls(i.toJSON(), ['image_url', 'mobile_image_url']))),
    };
  },

  // --- Admin: Zones - CHI xem & cap nhat cau hinh, KHONG tao/xoa zone (muc 5.17) ---
  async listZones() {
    return SliderZone.findAll({ order: [['id', 'ASC']] });
  },

  async updateZone(id: number, dto: UpdateSliderZoneDto) {
    const zone = await SliderZone.findByPk(id);
    if (!zone) throw AppError.notFound('Không tìm thấy khu vực slider');
    await zone.update(dto);
    return zone;
  },

  // --- Admin: Items - CRUD day du trong 1 zone ---
  async listItems(zoneId: number) {
    const items = await SliderItem.findAll({
      where: { zone_id: zoneId },
      order: [['display_order', 'ASC']],
    });
    return items.map((item) => withEffectiveStatus(attachImageUrls(item.toJSON(), ['image_url', 'mobile_image_url'])));
  },

  async getItemById(id: number) {
    const item = await SliderItem.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy slide');
    return item;
  },

  async createItem(dto: CreateSliderItemDto) {
    const zone = await SliderZone.findByPk(dto.zone_id);
    if (!zone) throw AppError.badRequest('Khu vực slider không hợp lệ');
    return SliderItem.create(dto as any);
  },

  async updateItem(id: number, dto: UpdateSliderItemDto) {
    const item = await this.getItemById(id);
    const previous = [item.image_url, item.mobile_image_url];
    await item.update(dto as any);
    await Promise.all(previous.filter((value) => value && value !== item.image_url && value !== item.mobile_image_url).map((value) => removeUnusedUpload(value)));
    return item;
  },

  async removeItem(id: number) {
    const item = await this.getItemById(id);
    const images = [item.image_url, item.mobile_image_url];
    await item.destroy();
    await Promise.all(images.map((image) => removeUnusedUpload(image)));
  },
};
