import { createContactSchema } from '../../src/validators/contact.validator';
import { chatbotFeedbackSchema } from '../../src/validators/chatbot.validator';
import { updateSettingsSchema } from '../../src/validators/setting.validator';
import { chatbotFeedbackService } from '../../src/services/chatbotFeedback.service';
import { contactService } from '../../src/services/contact.service';
import { AiChatLog } from '../../src/models/AiChatLog.model';
import { Contact } from '../../src/models/Contact.model';
import { emailService } from '../../src/services/email.service';
import { settingService } from '../../src/services/setting.service';

jest.mock('../../src/services/email.service', () => ({ emailService: { enqueue: jest.fn() } }));
jest.mock('../../src/services/setting.service', () => ({ settingService: { getRawValue: jest.fn() } }));

const contact = { name: 'Khách kiểm thử', phone: '0912345678', message: 'Tư vấn dịch vụ', topic: 'support', agreed_terms: true, recaptcha_token: 'test', source: 'chatbot' };
afterEach(() => jest.restoreAllMocks());

test('chatbot contact can omit email, website contact still requires it', () => {
  expect(createContactSchema.parse(contact)).toMatchObject({ source: 'chatbot', email: '' });
  expect(createContactSchema.safeParse({ ...contact, source: 'website' }).success).toBe(false);
  expect(createContactSchema.parse({ ...contact, source: undefined, email: 'customer@example.com' }).source).toBe('website');
  expect(createContactSchema.safeParse({ ...contact, email: 'invalid' }).success).toBe(false);
});
test.each([
  { phone: '123' }, { agreed_terms: false }, { agreed_terms: undefined },
  { website: 'spam' }, { recaptcha_token: '' }, { source: 'admin' },
])('chatbot contact still validates security and consent: %j', (override) => {
  expect(createContactSchema.safeParse({ ...contact, ...override }).success).toBe(false);
});
test('contact is stored with source and consent and queues staff email only without customer email', async () => {
  const update = jest.fn().mockResolvedValue({});
  jest.spyOn(Contact, 'create').mockResolvedValue({ id: 71, update } as never);
  jest.mocked(settingService.getRawValue).mockImplementation(async (key) => ({ notify_email: 'staff@example.com', site_name: 'MobiFone Sơn La', hotline: '02123758758' }[key] || null));
  jest.mocked(emailService.enqueue).mockReset().mockResolvedValue(undefined as never);
  const { recaptcha_token, ...input } = createContactSchema.parse(contact);
  await contactService.create(input);
  expect(Contact.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'chatbot', email: '', agreed_terms_version: 'v1.0', phone: contact.phone }));
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ code: expect.stringMatching(/^LH-/) }));
  expect(emailService.enqueue).toHaveBeenCalledTimes(1);
  expect(emailService.enqueue).toHaveBeenCalledWith('staff@example.com', 'contact_new_staff', expect.objectContaining({ customer_name: contact.name }), 'contact:71:staff');
});
test('website contact continues queuing staff and customer acknowledgements', async () => {
  jest.spyOn(Contact, 'create').mockResolvedValue({ id: 72, update: jest.fn() } as never);
  jest.mocked(emailService.enqueue).mockReset().mockResolvedValue(undefined as never);
  const { recaptcha_token, ...input } = createContactSchema.parse({ ...contact, source: 'website', email: 'customer@example.com' });
  await contactService.create(input);
  expect(emailService.enqueue).toHaveBeenCalledTimes(2);
  expect(emailService.enqueue).toHaveBeenCalledWith('customer@example.com', 'contact_received_customer', expect.any(Object), 'contact:72:customer');
});
test('feedback scopes writes to answer, session and IP; negative feedback flags review', async () => {
  const update = jest.fn();
  jest.spyOn(AiChatLog, 'findOne').mockResolvedValue({ update, flagged_for_review: false } as never);
  await chatbotFeedbackService.save({ session_id: 'session-a', answer_id: 11, was_helpful: false, comment: 'Cần cập nhật giá' }, '192.0.2.1');
  expect(AiChatLog.findOne).toHaveBeenCalledWith({ where: { id: 11, session_id: 'session-a', ip_address: '192.0.2.1' } });
  expect(update).toHaveBeenCalledWith({ was_helpful: false, feedback_comment: 'Cần cập nhật giá', flagged_for_review: true });
});
test('guessed answer ID or other visitor cannot update feedback', async () => {
  jest.spyOn(AiChatLog, 'findOne').mockResolvedValue(null);
  await expect(chatbotFeedbackService.save({ session_id: 'other-session', answer_id: 11, was_helpful: true }, '192.0.2.2')).rejects.toMatchObject({ statusCode: 404 });
});
test('positive feedback cannot erase an existing review flag', async () => {
  const update = jest.fn();
  jest.spyOn(AiChatLog, 'findOne').mockResolvedValue({ update, flagged_for_review: true } as never);
  await chatbotFeedbackService.save({ session_id: 's', answer_id: 11, was_helpful: true }, '192.0.2.1');
  expect(update).toHaveBeenCalledWith({ was_helpful: true, feedback_comment: null, flagged_for_review: true });
});
test.each([
  { answer_id: -1 }, { answer_id: 'NaN' }, { was_helpful: 'false' }, { comment: 'a'.repeat(501) }, { session_id: '' },
])('invalid feedback fails validation: %j', (override) => {
  expect(chatbotFeedbackSchema.safeParse({ session_id: 's', answer_id: 1, was_helpful: false, ...override }).success).toBe(false);
});
test('suggestions accept at most eight short questions and reject malformed settings', () => {
  const parse = (value: string) => updateSettingsSchema.safeParse({ group: 'general', items: [{ key: 'ai_chatbot_quick_replies', value }] }).success;
  expect(parse('["Đăng ký SIM/gói cước","Giờ làm việc"]')).toBe(true);
  for (const invalid of ['not JSON', '{}', '[]', '[1]', '[""]', JSON.stringify(['a'.repeat(101)]), JSON.stringify(Array(9).fill('Câu hỏi'))]) expect(parse(invalid)).toBe(false);
});
