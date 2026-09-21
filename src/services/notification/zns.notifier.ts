import { INotifier } from './INotifier';

/**
 * ZnsNotifier - CHUA trien khai o giai doan 1.
 *
 * Day chi la khung (scaffold) de san sang cam them tich hop Zalo ZNS that
 * trong tuong lai khi du an mo rong sang Zalo Mini App, KHONG duoc yeu cau
 * code logic that o giai doan nay (muc 10 cua thiet ke).
 *
 * Khi trien khai that, class nay se:
 *  - Goi Zalo Notification Service API (gui tin nhan ZNS toi so dien thoai)
 *  - Doc ZALO_ZNS_ACCESS_TOKEN / ZALO_ZNS_TEMPLATE_ID tu bien moi truong
 *  - Map templateCode sang ZNS template ID tuong ung
 */
export class ZnsNotifier implements INotifier {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(recipient: string, templateCode: string, data: Record<string, any>): Promise<void> {
    throw new Error(
      'ZnsNotifier chưa được triển khai. Vui lòng dùng EmailNotifier (xem config/notifier.ts).',
    );
  }
}
