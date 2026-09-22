import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { env, ALLOWED_ORIGINS_LIST } from '../config/env';
import { AuthUserPayload } from '../types/express';
import { AppError } from '../utils/AppError';
import { allocateNumber } from '../utils/registrationWorkflow';
import { vietnameseMoney } from '../utils/vietnameseMoney';
import { registrationService } from './registration.service';
import { RegistrationGroup } from '../models/RegistrationGroup.model';
import { settingService } from './setting.service';

interface ReceiptRow { number: string; issued_at: Date; checksum: string | null }
async function issue(groupId: number): Promise<ReceiptRow> {
  return sequelize.transaction(async (transaction) => {
    const group = await RegistrationGroup.findByPk(groupId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!group) throw AppError.notFound('Không tìm thấy đăng ký');
    const existing = await sequelize.query<ReceiptRow>('SELECT number,issued_at,checksum FROM registration_receipts WHERE registration_id=:id', { replacements: { id: groupId }, type: QueryTypes.SELECT, transaction });
    if (existing[0]) return existing[0];
    const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date());
    const sequence = await allocateNumber(`PD-${year}`, transaction);
    const number = `PD-${year}-${String(sequence).padStart(6, '0')}`;
    await sequelize.query('INSERT INTO registration_receipts(registration_id,number,issued_at) VALUES (:id,:number,NOW())', { replacements: { id: groupId, number }, transaction });
    return { number, issued_at: new Date(), checksum: null };
  });
}

export const receiptService = {
  async build(groupId: number, user?: AuthUserPayload, phone?: string) {
    const group = await RegistrationGroup.findByPk(groupId, { include: [{ association: 'items' }] });
    if (!group) throw AppError.notFound('Không tìm thấy đăng ký');
    if (user) await registrationService.getById(groupId, user);
    else if (!phone || phone !== group.phone) throw AppError.forbidden('Mã hoặc số điện thoại không đúng');
    const receipt = await issue(groupId);
    const [branch, hotline] = await Promise.all([settingService.getRawValue('site_name'), settingService.getRawValue('hotline')]);
    const doc = new PDFDocument({ size: 'A4', margin: 45, autoFirstPage: true });
    doc.font(path.resolve(process.cwd(), 'assets/NotoSans.ttf'));
    const parts: Buffer[] = [];
    doc.on('data', (part: Buffer) => parts.push(part));
    const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(parts))); doc.on('error', reject); });
    const line = (text: string, x = 45, y?: number, options: PDFKit.Mixins.TextOptions = {}) => { doc.fontSize(10).text(text, x, y, options); };
    doc.fontSize(17).text(branch || 'MobiFone Sơn La', { align: 'center' });
    doc.fontSize(15).text('PHIẾU ĐĂNG KÝ DỊCH VỤ / BIÊN NHẬN', { align: 'center' });
    doc.moveDown(0.5);
    line(`Số phiếu: ${receipt.number}`);
    line(`Ngày lập: ${new Date(receipt.issued_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    line(`Mã đăng ký: ${group.code || group.id}`);
    line(`Khách hàng: ${group.customer_name}    Điện thoại: ${group.phone}`);
    line(`Email: ${group.email || 'Không cung cấp'}`);
    line(`Hình thức nhận: ${group.delivery_method === 'store' ? group.delivery_store || 'Cửa hàng' : group.delivery_address}`);
    doc.moveDown();
    const startY = doc.y;
    doc.fontSize(9).text('STT', 45, startY).text('Sản phẩm', 80, startY).text('SL', 360, startY).text('Đơn giá', 395, startY).text('Thành tiền', 485, startY);
    doc.moveTo(45, startY + 20).lineTo(550, startY + 20).stroke();
    let y = startY + 28;
    let index = 1;
    for (const item of group.items || []) {
      const price = Number(item.price_snapshot || 0);
      const amount = price * Number(item.quantity || 1);
      doc.fontSize(9).text(String(index++), 45, y).text(item.reference_label, 80, y, { width: 270 }).text(String(item.quantity || 1), 360, y).text(price.toLocaleString('vi-VN'), 395, y).text(amount.toLocaleString('vi-VN'), 485, y);
      y += Math.max(24, doc.heightOfString(item.reference_label, { width: 270 }) + 8);
      if (item.fee_snapshot && Number(item.fee_snapshot) > 0) {
        const fee = Number(item.fee_snapshot);
        doc.fontSize(9).text(String(index++), 45, y).text('Phí hòa mạng: ' + item.reference_label, 80, y, { width: 270 }).text('1', 360, y).text(fee.toLocaleString('vi-VN'), 395, y).text(fee.toLocaleString('vi-VN'), 485, y);
        y += 25;
      }
      if (y > 640) { doc.addPage(); doc.font(path.resolve(process.cwd(), 'assets/NotoSans.ttf')); y = 50; }
    }
    doc.moveTo(45, y).lineTo(550, y).stroke();
    doc.fontSize(11).text(`Tổng cộng: ${Number(group.total_amount).toLocaleString('vi-VN')} ₫`, 300, y + 12, { align: 'right', width: 250 });
    line(`Bằng chữ: ${vietnameseMoney(Number(group.total_amount))}`, 45, y + 38, { width: 500 });
    const lookupUrl = `${env.PUBLIC_SITE_URL || ALLOWED_ORIGINS_LIST[0] || env.APP_BASE_URL}/tra-cuu?code=${encodeURIComponent(group.code || '')}`;
    const qr = await QRCode.toBuffer(lookupUrl, { type: 'png', margin: 0, width: 110 });
    doc.image(qr, 45, y + 75, { width: 90 });
    line('Quét mã để tra cứu. Cần nhập số điện thoại để xác thực.', 145, y + 90, { width: 380 });
    line('Khách hàng', 90, y + 205); line('Giao dịch viên', 390, y + 205);
    line(`Hotline: ${hotline || '18001090'}`, 45, 775);
    doc.end();
    const buffer = await done;
    const checksum = createHash('sha256').update(buffer).digest('hex');
    await sequelize.query('UPDATE registration_receipts SET checksum=:checksum WHERE registration_id=:id', { replacements: { checksum, id: groupId } });
    return { number: receipt.number, buffer };
  },
};
