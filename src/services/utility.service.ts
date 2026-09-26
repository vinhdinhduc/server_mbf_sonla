/* eslint-disable @typescript-eslint/no-explicit-any, no-nested-ternary */
import QRCode from 'qrcode';
import { Op } from 'sequelize';
import { Download, Utility } from '../models';
import { AppError } from '../utils/AppError';
import { sanitizeContent } from '../utils/sanitizeContent';
import { attachImageUrls } from '../utils/buildImageUrl';

const present = (u: Utility) => attachImageUrls(u.toJSON(), ['card_image', 'hero_image']);
export const utilityService = {
  async publicList(limit?: number) {
    return (
      await Utility.findAll({
        where: { status: 'active' },
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
        limit,
      })
    ).map(present);
  },
  async publicDetail(slug: string) {
    const u = await Utility.findOne({ where: { slug, status: 'active' } });
    if (!u) throw AppError.notFound('Không tìm thấy tiện ích');
    return present(u);
  },
  async adminList() {
    return (await Utility.findAll({ order: [['sort_order', 'ASC']] })).map(present);
  },
  async get(id: number) {
    const u = await Utility.findByPk(id);
    if (!u) throw AppError.notFound('Không tìm thấy tiện ích');
    return u;
  },
  async create(dto: any) {
    if (await Utility.findOne({ where: { slug: dto.slug }, paranoid: false }))
      throw AppError.conflict('Slug đã tồn tại');
    return Utility.create({ ...dto, content: dto.content ? sanitizeContent(dto.content) : null });
  },
  async update(id: number, dto: any) {
    const u = await this.get(id);
    if (
      dto.slug &&
      dto.slug !== u.slug &&
      (await Utility.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } }, paranoid: false }))
    )
      throw AppError.conflict('Slug đã tồn tại');
    return u.update({ ...dto, ...(dto.content ? { content: sanitizeContent(dto.content) } : {}) });
  },
  async remove(id: number) {
    await (await this.get(id)).destroy();
  },
  async qr(id: number, platform: 'ios' | 'android' | 'website', format: 'png' | 'svg') {
    const u = await this.get(id);
    const link =
      platform === 'ios' ? u.ios_url : platform === 'android' ? u.android_url : u.website_url;
    if (!link) throw AppError.notFound('Tiện ích chưa có liên kết này');
    return format === 'svg'
      ? QRCode.toString(link, { type: 'svg', margin: 1 })
      : QRCode.toBuffer(link, { type: 'png', width: 512, margin: 1 });
  },
  async downloads() {
    return Download.findAll({
      where: { status: 'active' },
      order: [
        ['category', 'ASC'],
        ['sort_order', 'ASC'],
      ],
    });
  },
  async trackDownload(id: number) {
    const item = await Download.findByPk(id);
    if (!item || item.status !== 'active') throw AppError.notFound('Không tìm thấy tài liệu');
    await item.increment('download_count');
    return item.file_url;
  },
  async adminDownloads() {
    return Download.findAll({
      order: [
        ['category', 'ASC'],
        ['sort_order', 'ASC'],
      ],
    });
  },
  async createDownload(dto: any) {
    return Download.create(dto);
  },
  async updateDownload(id: number, dto: any) {
    const item = await Download.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy tài liệu');
    return item.update(dto);
  },
  async removeDownload(id: number) {
    const item = await Download.findByPk(id);
    if (!item) throw AppError.notFound('Không tìm thấy tài liệu');
    await item.destroy();
  },
};
