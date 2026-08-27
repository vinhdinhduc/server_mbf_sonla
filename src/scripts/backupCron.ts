import cron from 'node-cron';
import { runBackup } from './backup';

/**
 * Lich chay tu dong: moi Chu nhat luc 23:00 (muc 13).
 * cron expression: '0 23 * * 0' (phut=0, gio=23, moi ngay-trong-thang, moi thang, thu=0/Chu nhat)
 */
export function scheduleBackupCron(): void {
  cron.schedule(
    '0 23 * * 0',
    () => {
      runBackup().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('❌ Backup tu dong (cron) that bai:', err);
      });
    },
    { timezone: 'Asia/Ho_Chi_Minh' },
  );
  // eslint-disable-next-line no-console
  console.log('🕐 Da lich backup tu dong: moi Chu nhat luc 23:00 (Asia/Ho_Chi_Minh)');
}
