import nodemailer from 'nodemailer';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../src/models';
import { emailService, processEmailOutbox } from '../../src/services/email.service';

const isolated = process.env.E2E_DB_ISOLATED === '1' && process.env.DB_NAME === 'mobifone_sonla_e2e';
(isolated ? describe : describe.skip)('TC-30: durable email outbox', () => {
  const key = `e2e-email-${Date.now()}`;
  afterAll(async () => { await sequelize.query('DELETE FROM email_outbox WHERE idempotency_key=:key', { replacements: { key } }); await sequelize.close(); });
  it('keeps the request queued when SMTP fails and sends on retry', async () => {
    await emailService.enqueue('e2e@example.com', 'registration_new_staff', { customer_name: 'Khách thử', registration_code: 'DK-260922-0001' }, key);
    const transport = jest.spyOn(nodemailer, 'createTransport');
    try {
      transport.mockReturnValue({ sendMail: jest.fn().mockRejectedValue(Object.assign(new Error('offline'), { code: 'ECONNECTION' })) } as any);
      await processEmailOutbox();
      let rows = await sequelize.query<{ status: string; attempts: number }>('SELECT status,attempts FROM email_outbox WHERE idempotency_key=:key', { replacements: { key }, type: QueryTypes.SELECT });
      expect(rows[0]).toMatchObject({ status: 'queued', attempts: 1 });
      await sequelize.query('UPDATE email_outbox SET next_attempt_at=NOW() WHERE idempotency_key=:key', { replacements: { key } });
      transport.mockReturnValue({ sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }) } as any);
      await processEmailOutbox();
      rows = await sequelize.query<{ status: string; attempts: number }>('SELECT status,attempts FROM email_outbox WHERE idempotency_key=:key', { replacements: { key }, type: QueryTypes.SELECT });
      expect(rows[0]).toMatchObject({ status: 'sent', attempts: 2 });
    } finally { transport.mockRestore(); }
  });
});
