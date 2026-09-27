import { createContactSchema } from '../../src/validators/contact.validator';
import { submitCartSchema } from '../../src/validators/registration.validator';
import { createAppointmentSchema } from '../../src/validators/appointment.validator';
import { subscribeNewsletterSchema } from '../../src/validators/newsletter.validator';
import { applyJobSchema } from '../../src/validators/job.validator';
import { chatbotMessageSchema } from '../../src/validators/chatbot.validator';
import { consentAudit } from '../../src/utils/legalConsent';

const forms = [
  [
    createContactSchema,
    {
      name: 'A',
      phone: '0912345678',
      email: 'a@example.com',
      topic: 'support',
      message: 'Hỗ trợ',
      recaptcha_token: 'x',
    },
  ],
  [
    submitCartSchema,
    {
      customer_name: 'A',
      phone: '0912345678',
      email: '',
      province: 'Sơn La',
      ward: 'Tô Hiệu',
      delivery_address: 'A',
      delivery_method: 'address',
      sim_type: 'physical',
      items: [{ type: 'sim', reference_id: 1 }],
      recaptcha_token: 'x',
    },
  ],
  [
    createAppointmentSchema,
    {
      customer_name: 'A',
      phone: '0912345678',
      store_id: 1,
      appointment_date: '2026-10-01',
      appointment_time: '09:00',
    },
  ],
  [subscribeNewsletterSchema, { email: 'a@example.com' }],
  [
    applyJobSchema,
    { full_name: 'A', phone: '0912345678', email: 'a@example.com', recaptcha_token: 'x' },
  ],
  [chatbotMessageSchema, { session_id: 'session', message: 'Hỗ trợ' }],
] as const;
it.each(forms)('requires explicit consent in each public collection schema %#', (schema, input) => {
  for (const agreed_terms of [undefined, false, 'false', 0, 1, null]) {
    expect(schema.safeParse({ ...input, consent: true, agreed_terms }).success).toBe(false);
  }
  expect(schema.safeParse({ ...input, agreed_terms: true }).success).toBe(true);
});
it('derives consent metadata on the server and leaves client-supplied audit fields out', () => {
  const parsed = subscribeNewsletterSchema.parse({
    email: 'a@example.com',
    agreed_terms: true,
    agreed_terms_at: '2000-01-01',
    agreed_terms_version: 'fake',
  });
  expect(parsed).not.toHaveProperty('agreed_terms_at');
  expect(parsed).not.toHaveProperty('agreed_terms_version');
  expect(consentAudit()).toEqual({
    agreed_terms_at: expect.any(Date),
    agreed_terms_version: 'v1.0',
  });
});
