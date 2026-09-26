/* eslint-disable no-control-regex */
import { Op } from 'sequelize';
import { AiChatLog } from '../models/AiChatLog.model';
import { AiKnowledgeEntry } from '../models/AiKnowledgeEntry.model';
import { Package } from '../models/Package.model';
import { SimNumber } from '../models/SimNumber.model';
import { News } from '../models/News.model';
import { Solution } from '../models/Solution.model';
import { Store } from '../models/Store.model';
import { AppError } from '../utils/AppError';
import { settingService } from './setting.service';
import { aiSettingsService } from './aiSettings.service';
import { todayDateStringVietnam } from '../utils/vietnamTime';

const FALLBACK =
  'Hiện chatbot chưa thể trả lời. Vui lòng gọi hotline MobiFone Sơn La để được hỗ trợ.';

export interface ChatSource {
  title: string;
  href: string;
}

export interface ChatAnswer {
  reply: string;
  status: 'answered' | 'unavailable' | 'limited' | 'restricted';
  sources: ChatSource[];
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/ignore\s+(all|any|previous|prior)\s+instructions?/gi, '')
    .replace(/system\s+prompt|developer\s+message/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, 2000);
}

export function containsPromptAttack(message: string): boolean {
  return /(ignore|bỏ qua).{0,40}(instruction|chỉ dẫn|hướng dẫn)|system\s+prompt|developer\s+message|api[_ -]?key|mật khẩu|secret|JWT_SECRET|DB_PASSWORD/i.test(
    message,
  );
}

function normalize(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

const STOP_WORDS = new Set([
  'toi',
  'minh',
  'ban',
  'cho',
  'nao',
  'voi',
  'cua',
  'can',
  'muon',
  'khong',
  'nhung',
  'cac',
  'duoc',
  'giup',
  'hay',
]);

function tokens(question: string): string[] {
  return [
    ...new Set(
      normalize(question)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
    ),
  ].slice(0, 12);
}

export function retrievalQuestion(message: string, previousQuestions: string[]): string {
  const normalized = normalize(message);
  // Carry the topic into short follow-ups, but let an explicit new topic stand alone.
  if (/\bsim\b|goi cuoc|goi data|cua hang|giai phap|tin tuc|doanh nghiep/.test(normalized))
    return message;
  if (
    /goi (do|nay)|con |bao nhieu|dang ky|cach nao|the nao|chi tiet|dieu kien|gia|o dau|duoc khong/.test(
      normalized,
    )
  ) {
    return [...previousQuestions.slice(0, 2).reverse(), message].join(' ').slice(-3000);
  }
  return message;
}

export async function buildChatContext(
  question: string,
): Promise<{ text: string; sources: ChatSource[] }> {
  const searchTokens = tokens(question);
  const search = (fields: string[]) => ({
    [Op.or]: (searchTokens.length ? searchTokens : ['__no_match__']).flatMap((token) =>
      fields.map((field) => ({ [field]: { [Op.like]: `%${token}%` } })),
    ),
  });
  const normalized = normalize(question);
  const productCodes = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => /^(?:[a-z]+|4g|5g)\d+[a-z0-9]*$/.test(token));
  let packageSearch = /goi cuoc|goi data|4g|5g/.test(normalized)
    ? {}
    : search(['name', 'code', 'description']);
  if (productCodes.length) packageSearch = { code: { [Op.in]: productCodes } };
  const now = new Date();
  const [knowledge, solutions, packages, stores, news, sims] = await Promise.all([
    AiKnowledgeEntry.findAll({
      where: {
        status: 'active',
        ...search(['title', 'content', 'tags']),
      },
      order: [['updated_at', 'DESC']],
      limit: 5,
    }),
    Solution.findAll({
      where: {
        status: 'active',
        ...(/giai phap|doanh nghiep/.test(normalized)
          ? {}
          : search(['name', 'summary', 'content'])),
      },
      limit: 5,
    }),
    Package.findAll({
      where: {
        status: 'active',
        deleted_at: null,
        [Op.and]: [
          { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: now } }] },
          { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: now } }] },
        ],
        ...packageSearch,
      },
      order: [['price', 'ASC']],
      limit: 5,
    }),
    Store.findAll({
      where: {
        status: 'active',
        ...(/cua hang|diem giao dich/.test(normalized)
          ? {}
          : search(['name', 'address', 'district'])),
      },
      limit: 5,
    }),
    News.findAll({
      where: {
        status: 'published',
        published_at: { [Op.lte]: now },
        ...search(['title', 'summary', 'content']),
      },
      order: [['published_at', 'DESC']],
      limit: 5,
    }),
    SimNumber.findAll({
      where: {
        status: 'available',
        ...(/\bsim\b/.test(normalized) && !/\d{3,}/.test(normalized)
          ? {}
          : search(['phone_number', 'sim_type'])),
      },
      order: [['price', 'ASC']],
      limit: 5,
    }),
  ]);
  const chunks = [
    ...knowledge.map((item) => `Tri thức chi nhánh: ${item.title}\n${item.content.slice(0, 1200)}`),
    ...solutions.map(
      (item) =>
        `Giải pháp: ${item.name}\n${item.summary ?? ''}\n${(item.content ?? '').slice(0, 1200)}\nTrang: /giai-phap-so/${item.slug}`,
    ),
    ...packages.map(
      (item) =>
        `Gói cước: ${item.name} (${item.code}) - ${item.price} VNĐ/${item.duration_value} ${item.duration_unit}. ${item.data_desc ?? ''}. Điều kiện: ${item.conditions ?? 'Chưa có thông tin'}. Cú pháp: ${item.sms_syntax ?? 'Chưa có thông tin'}. Trang: /goi-cuoc/${item.slug}`,
    ),
    ...stores.map(
      (item) =>
        `Cửa hàng: ${item.name}, ${item.full_address || item.address}, ${item.district ?? ''}. ${item.phone}. ${item.opening_hours ?? ''}. Trang: /cua-hang`,
    ),
    ...news.map(
      (item) =>
        `Tin tức: ${item.title}\n${(item.summary ?? item.content).slice(0, 1000)}\nTrang: /tin-tuc/${item.slug}`,
    ),
    ...sims.map(
      (item) =>
        `SIM đang có: ${item.phone_number}, ${item.price} VNĐ, ${item.sim_type}. Trang: /sim-so-dep/${item.id}`,
    ),
  ];
  const sources = [
    ...packages.map((item) => ({ title: `Gói cước ${item.name}`, href: `/goi-cuoc/${item.slug}` })),
    ...sims.map((item) => ({ title: `SIM ${item.phone_number}`, href: `/sim-so-dep/${item.id}` })),
    ...solutions.map((item) => ({ title: item.name, href: `/giai-phap-so/${item.slug}` })),
    ...(stores.length ? [{ title: 'Địa chỉ và giờ mở cửa', href: '/cua-hang' }] : []),
    ...news.map((item) => ({ title: item.title, href: `/tin-tuc/${item.slug}` })),
  ].slice(0, 6);
  const text = chunks.length
    ? chunks
        .map((chunk) => chunk.replace(/<[^>]*>/g, ' ').slice(0, 1600))
        .join('\n\n')
        .slice(0, 24000)
    : 'Không tìm thấy dữ liệu liên quan trong hệ thống.';
  return { text, sources };
}

export async function buildContext(question: string): Promise<string> {
  return (await buildChatContext(question)).text;
}

export const chatbotService = {
  async answerQuestion(
    sessionId: string,
    rawMessage: string,
    ipAddress: string,
  ): Promise<ChatAnswer> {
    const message = sanitizeMessage(rawMessage);
    if (message.length < 2) throw AppError.badRequest('Vui lòng nhập câu hỏi rõ hơn.');
    if (containsPromptAttack(rawMessage)) {
      const reply =
        'Tôi không thể cung cấp chỉ dẫn hệ thống, khóa API, mật khẩu hoặc dữ liệu bí mật. Tôi có thể hỗ trợ thông tin dịch vụ MobiFone Sơn La.';
      await AiChatLog.create({
        session_id: sessionId,
        user_message: message || '[nội dung bị chặn]',
        ai_response: reply,
        ip_address: ipAddress,
        flagged_for_review: true,
      });
      return { reply, status: 'restricted', sources: [] };
    }
    const config = await aiSettingsService.getPublicConfig();
    if (!config.enabled) throw AppError.badRequest('Chatbot AI hiện đang tạm ngưng hoạt động.');
    const dailyLimit = config.daily_limit > 0 ? config.daily_limit : 20;
    const today = todayDateStringVietnam();
    const todayCount = await AiChatLog.count({
      where: {
        [Op.or]: [{ ip_address: ipAddress }, { session_id: sessionId }],
        created_at: { [Op.gte]: new Date(`${today}T00:00:00+07:00`) },
      },
    });
    if (todayCount >= dailyLimit) {
      const hotline = (await settingService.getRawValue('hotline')) ?? '18001090';
      return {
        reply: `Bạn đã dùng hết ${dailyLimit} lượt hỏi hôm nay. Vui lòng gọi hotline ${hotline} để được hỗ trợ.`,
        status: 'limited',
        sources: [],
      };
    }
    try {
      const started = Date.now();
      const [historyRows, resolved] = await Promise.all([
        AiChatLog.findAll({
          where: { session_id: sessionId, ip_address: ipAddress, flagged_for_review: false },
          order: [['created_at', 'DESC']],
          limit: 6,
        }),
        aiSettingsService.resolveProvider(),
      ]);
      const retrieved = config.rag_enabled
        ? await buildChatContext(
            retrievalQuestion(
              message,
              historyRows.map((row) => row.user_message),
            ),
          )
        : { text: 'Không sử dụng dữ liệu bổ sung.', sources: [] };
      const context = retrieved.text;
      const history = historyRows.reverse().flatMap((row) => [
        { role: 'user' as const, content: row.user_message },
        { role: 'assistant' as const, content: row.ai_response },
      ]);
      const reply = await resolved.provider.chat(
        resolved.prompt,
        context,
        history,
        message,
        resolved.params,
      );
      if (!reply.trim()) throw new Error('AI provider returned an empty reply');
      const safeReply = reply.trim();
      const inputTokens = Math.ceil(
        (message.length +
          context.length +
          history.reduce((sum, item) => sum + item.content.length, 0)) /
          4,
      );
      const outputTokens = Math.ceil(safeReply.length / 4);
      await AiChatLog.create({
        session_id: sessionId,
        user_message: message,
        ai_response: safeReply,
        ip_address: ipAddress,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost: Number((inputTokens * 0.000001 + outputTokens * 0.000005).toFixed(6)),
        provider: resolved.config.ai_provider || 'anthropic',
        model: resolved.config.ai_model || null,
        latency_ms: Date.now() - started,
      });
      return { reply: safeReply, status: 'answered', sources: retrieved.sources };
    } catch (error) {
      console.error(
        'AI provider request failed',
        error instanceof Error ? error.message : 'unknown error',
      );
      const fallback = (await settingService.getRawValue('ai_fallback_message')) || FALLBACK;
      await AiChatLog.create({
        session_id: sessionId,
        user_message: message,
        ai_response: fallback,
        ip_address: ipAddress,
      });
      return { reply: fallback, status: 'unavailable', sources: [] };
    }
  },
};
