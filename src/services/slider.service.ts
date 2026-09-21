import { SliderZone } from '../models/SliderZone.model';
import { SliderItem } from '../models/SliderItem.model';
import { AppError } from '../utils/AppError';
import {
  CreateSliderItemDto,
  UpdateSliderItemDto,
  UpdateSliderZoneDto,
} from '../validators/slider.validator';
import { attachImageUrls } from '../utils/buildImageUrl';

export const sliderService = {
  /** GET /api/public/sliders/:zoneCode - chi tra cac item dang duoc bat */
  async getPublicByZoneCode(zoneCode: string) {
    const zone = await SliderZone.findOne({ where: { code: zoneCode, status: 'active' } });
    if (!zone) throw AppError.notFound('Không tìm thấy khu vực slider');

    const items = await SliderItem.findAll({
      where: {
        zone_id: zone.id,
        status: 'active',
      },
      order: [['display_order', 'ASC']],
    });

    return {
      animation_type: zone.animation_type,
      autoplay_enabled: zone.autoplay_enabled,
      autoplay_speed_ms: zone.autoplay_speed_ms,
      items: items.map((i) => attachImageUrls(i.toJSON(), ['image_url'])),
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
    return items.map((item) => attachImageUrls(item.toJSON(), ['image_url']));
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
    await item.update(dto as any);
    return item;
  },

  async removeItem(id: number) {
    const item = await this.getItemById(id);
    await item.destroy();
  },
};
