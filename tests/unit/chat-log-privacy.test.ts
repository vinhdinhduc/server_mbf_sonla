import { maskChatLogContactInfo, toAdminChatLogDto } from '../../src/utils/chatLogPrivacy';
import { aiController } from '../../src/controllers/ai.controller';
import { AiChatLog } from '../../src/models/AiChatLog.model';
import { Request, Response } from 'express';

afterEach(() => jest.restoreAllMocks());

test('masks formatted Vietnamese contacts with Unicode and invisible/control separators', () => {
  const phones = [
    '0912345672',
    '+84912345672',
    '+84 912 345 672',
    '(0912) 345-672',
    '0912\u00a0345\u00a0672',
    '0912\u202f345\u202f672',
    '0912\u200b345\u2060672',
    '0912\u200c345\u200d672',
    '0912\n345\t672',
    '0912\u0000345\u0001672',
  ];
  for (const phone of phones) {
    expect(maskChatLogContactInfo(`Gọi ${phone}, cảm ơn.`)).toBe('Gọi 0912 *** 672, cảm ơn.');
  }
  expect(maskChatLogContactInfo('0212 3758 758; Alice.Tag+sales@Gmail.com; a@example.vn')).toBe(
    '0212 *** 758; A***@Gmail.com; a***@example.vn',
  );
});

test('preserves ordinary text and does not mask digits inside longer identifiers', () => {
  const text = '<script>alert("x")</script> Gói TK135: 135.000đ/30 ngày; mã 12309123456720.';
  expect(maskChatLogContactInfo(text)).toBe(text);
  expect(maskChatLogContactInfo('0912 *** 672; a***@gmail.com')).toBe(
    '0912 *** 672; a***@gmail.com',
  );
});

test('whitelists DTO fields and never leaks private model metadata or raw feedback contacts', () => {
  const created = new Date('2026-10-06T15:00:00Z');
  const source = {
    id: '28',
    session_id: 'session-test',
    created_at: created,
    user_message: 'Gọi 0912\u00a0345\u00a0672 hoặc Alice@example.com',
    ai_response: '<img src=x onerror=alert(1)> Liên hệ 0212 3758 758',
    feedback_comment: 'Gửi kết quả đến Alice@example.com',
    was_helpful: false,
    flagged_for_review: true,
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    latency_ms: 2500,
    ip_address: '192.0.2.44',
    user_agent: 'Private device',
    device_id: 'private-device-id',
    agreed_terms_at: created,
    agreed_terms_version: 'v1',
    input_tokens: 125,
    output_tokens: 50,
    estimated_cost: 0.005,
    future_private_field: { secret: 'hidden' },
    toJSON: () => ({ confidential: 'A model method must not control the admin DTO.' }),
  };
  const result = toAdminChatLogDto(source);
  expect(Object.keys(result).sort()).toEqual(
    [
      'id',
      'session_id',
      'created_at',
      'user_message',
      'ai_response',
      'feedback_comment',
      'was_helpful',
      'flagged_for_review',
      'provider',
      'model',
      'latency_ms',
    ].sort(),
  );
  expect(result.user_message).toBe('Gọi 0912 *** 672 hoặc A***@example.com');
  expect(result.ai_response).toBe('<img src=x onerror=alert(1)> Liên hệ 0212 *** 758');
  expect(result.feedback_comment).toBe('Gửi kết quả đến A***@example.com');
  expect(result).toMatchObject({
    id: '28',
    session_id: 'session-test',
    was_helpful: false,
    flagged_for_review: true,
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    latency_ms: 2500,
  });
  expect(result.created_at).toBe(created);
  const wire = JSON.stringify(result);
  for (const privateValue of [
    '0912\u00a0345\u00a0672',
    'Alice@example.com',
    '192.0.2.44',
    'Private device',
    'private-device-id',
    'confidential',
    'future_private_field',
    'input_tokens',
  ]) {
    expect(wire).not.toContain(privateValue);
  }
  // Masking must not mutate persisted source content or customer feedback.
  expect(source.user_message).toContain('Alice@example.com');
  expect(source.feedback_comment).toContain('Alice@example.com');
});

test('preserves nullable customer feedback and null provider metadata', () => {
  expect(
    toAdminChatLogDto({
      id: 1,
      session_id: 'session-test',
      user_message: 'Xin chào',
      ai_response: 'Chào bạn',
      flagged_for_review: false,
      created_at: '2026-10-06T15:00:00Z',
    }),
  ).toMatchObject({
    was_helpful: null,
    feedback_comment: null,
    provider: null,
    model: null,
    latency_ms: null,
    flagged_for_review: false,
  });
});

test('contact session identifiers become stable opaque groups without merging distinct contacts', () => {
  const base = {
    id: 1,
    session_id: '',
    user_message: 'Xin chào',
    ai_response: 'Chào bạn',
    flagged_for_review: false,
    created_at: '2026-10-06T15:00:00Z',
  };
  // Both phone pairs/email pairs produce identical display masks; session groups must not merge.
  const originals = [
    '0912345672',
    '0912987672',
    'Alice@example.com',
    'Ann@example.com',
    '+84 912\u202f345\u202f672',
    'A***@example.com',
  ];
  const opaque = originals.map((session_id) => {
    const source = { ...base, session_id };
    const first = toAdminChatLogDto(source);
    const nextMessage = toAdminChatLogDto({ ...source, id: 2, user_message: 'Hỏi tiếp' });
    expect(first.session_id).toMatch(/^private-[a-f0-9]{24}$/);
    expect(nextMessage.session_id).toBe(first.session_id);
    expect(JSON.stringify(first)).not.toContain(session_id);
    expect(source.session_id).toBe(session_id);
    return first.session_id;
  });
  expect(new Set(opaque).size).toBe(originals.length);
  const normalIds = ['session-test', 'playground-12', 'd01013a1-4321-4c53-9e80-aa0912345672'];
  for (const session_id of normalIds) {
    expect(toAdminChatLogDto({ ...base, session_id }).session_id).toBe(session_id);
  }
});

function controllerResponse() {
  const json = jest.fn();
  const setHeader = jest.fn();
  const response = { json, setHeader, status: jest.fn() };
  response.status.mockReturnValue(response);
  return { response: response as unknown as Response, json, setHeader };
}

function storedLog() {
  return {
    id: 9,
    session_id: 'session-test',
    user_message: 'Tư vấn qua 0912\u202f345\u202f672',
    ai_response: 'Gửi email Alice@example.com',
    feedback_comment: 'SĐT +84 912 345 672',
    flagged_for_review: false,
    was_helpful: null,
    created_at: new Date('2026-10-06T15:00:00Z'),
    ip_address: '192.0.2.44',
    agreed_terms_at: new Date(),
    agreed_terms_version: 'v1',
    input_tokens: 100,
    output_tokens: 40,
    estimated_cost: 0.005,
    device_id: 'private-device',
    future_secret: 'should-never-be-exposed',
  };
}

test('legacy list endpoint keeps its array/filter contract while masking its actual JSON response', async () => {
  const log = storedLog();
  const findAll = jest.spyOn(AiChatLog, 'findAll').mockResolvedValue([log] as never);
  const { response, json, setHeader } = controllerResponse();
  await aiController.listLogs({ query: { flagged: 'true' } } as unknown as Request, response);
  expect(findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { flagged_for_review: true },
      limit: 100,
    }),
  );
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  const payload = json.mock.calls[0][0];
  expect(payload.success).toBe(true);
  expect(Array.isArray(payload.data)).toBe(true);
  expect(payload.data[0]).toMatchObject({
    id: 9,
    user_message: 'Tư vấn qua 0912 *** 672',
    ai_response: 'Gửi email A***@example.com',
    feedback_comment: 'SĐT 0912 *** 672',
  });
  expect(JSON.stringify(payload)).not.toMatch(
    /Alice@example|192\.0\.2\.44|private-device|future_secret|agreed_terms/,
  );
  expect(log.user_message).toBe('Tư vấn qua 0912\u202f345\u202f672');
});

test('legacy update endpoint persists the existing review flag and sanitizes its returned record', async () => {
  const log = { ...storedLog(), update: jest.fn() };
  log.update.mockImplementation(async (body) => Object.assign(log, body));
  jest.spyOn(AiChatLog, 'findByPk').mockResolvedValue(log as never);
  const { response, json, setHeader } = controllerResponse();
  await aiController.updateLog(
    { params: { id: '9' }, body: { flagged_for_review: true } } as unknown as Request,
    response,
  );
  expect(log.update).toHaveBeenCalledWith({ flagged_for_review: true });
  expect(log.flagged_for_review).toBe(true);
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  const payload = json.mock.calls[0][0];
  expect(payload.data.flagged_for_review).toBe(true);
  expect(payload.data.feedback_comment).toBe('SĐT 0912 *** 672');
  expect(JSON.stringify(payload)).not.toMatch(
    /Alice@example|192\.0\.2\.44|private-device|future_secret|agreed_terms/,
  );
  expect(log.feedback_comment).toBe('SĐT +84 912 345 672');
});
