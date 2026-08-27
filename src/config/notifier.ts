import { INotifier } from '../services/notification/INotifier';
import { EmailNotifier } from '../services/notification/email.notifier';

/**
 * Chon implementation INotifier dang dung. Giai doan 1 CHI dung EmailNotifier.
 * Khi co ZNS that trong tuong lai, chi can doi dong export nay sang ZnsNotifier
 * (hoac dieu kien theo bien moi truong) - khong phai sua bat ky noi nao khac
 * dang goi qua interface INotifier.
 */
export const activeNotifier: INotifier = new EmailNotifier();
