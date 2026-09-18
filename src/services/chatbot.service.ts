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

function sanitizeMessage(message: string): string {
  return message
    .replace(/ignore\s+(all|any|previous|prior)\s+instructions?/gi, '')
    .replace(/system\s+prompt|developer\s+message/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, 2000);
}

function tokens(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2),
    ),
  ].slice(0, 12);
}

async function buildContext(question: string): Promise<string> {
  const searchTokens = tokens(question);
  const keyword = searchTokens.length ? `%${searchTokens.join('%')}%` : `%${question}%`;
  const [knowledge, solutions, packages, stores, news, sims] = await Promise.all([
    AiKnowledgeEntry.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { title: { [Op.like]: keyword } },
          { content: { [Op.like]: keyword } },
          { tags: { [Op.like]: keyword } },
        ],
      },
      order: [['updated_at', 'DESC']],
      limit: 5,
    }),
    Solution.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { name: { [Op.like]: keyword } },
          { summary: { [Op.like]: keyword } },
          { content: { [Op.like]: keyword } },
        ],
      },
      limit: 5,
    }),
    Package.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { name: { [Op.like]: keyword } },
          { code: { [Op.like]: keyword } },
          { description: { [Op.like]: keyword } },
        ],
      },
      limit: 5,
    }),
    Store.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: keyword } },
          { address: { [Op.like]: keyword } },
          { district: { [Op.like]: keyword } },
        ],
      },
      limit: 5,
    }),
    News.findAll({
      where: {
        status: 'published',
        [Op.or]: [
          { title: { [Op.like]: keyword } },
          { summary: { [Op.like]: keyword } },
          { content: { [Op.like]: keyword } },
        ],
      },
      order: [['published_at', 'DESC']],
      limit: 5,
    }),
    SimNumber.findAll({
      where: {
        status: 'available',
        [Op.or]: [{ phone_number: { [Op.like]: keyword } }, { sim_type: { [Op.like]: keyword } }],
      },
      order: [['price', 'ASC']],
      limit: 5,
    }),
  ]);
  const chunks = [
    ...knowledge.map((item) => `Tri thức chi nhánh: ${item.title}\n${item.content}`),
    ...solutions.map((item) => `Giải pháp: ${item.name}\n${item.summary ?? ''}\n${item.content}`),
    ...packages.map(
      (item) =>
        `Gói cước: ${item.name} (${item.code}) - ${item.price} VNĐ/${item.duration_value} ${item.duration_unit}. ${item.data_desc ?? ''}`,
    ),
    ...stores.map(
      (item) =>
        `Cửa hàng: ${item.name}, ${item.address}, ${item.district}. ${item.phone}. ${item.opening_hours ?? ''}`,
    ),
    ...news.map((item) => `Tin tức: ${item.title}\n${item.summary ?? item.content}`),
    ...sims.map((item) => `SIM đang có: ${item.phone_number}, ${item.price} VNĐ, ${item.sim_type}`),
  ];
  return chunks.length
    ? chunks.slice(0, 15).join('\n\n')
    : 'Không tìm thấy dữ liệu liên quan trong hệ thống.';
}

export const chatbotService = {
  async answerQuestion(
    sessionId: string,
    rawMessage: string,
    ipAddress: string,
  ): Promise<{ reply: string }> {
    const message = sanitizeMessage(rawMessage);
    if (message.length < 2) throw AppError.badRequest('Vui lòng nhập câu hỏi rõ hơn.');
    const config = await aiSettingsService.getPublicConfig();
    if (!config.enabled) throw AppError.badRequest('Chatbot AI hiện đang tạm ngưng hoạt động.');
    const dailyLimit = config.daily_limit > 0 ? config.daily_limit : 20;
    const today = todayDateStringVietnam();
    const todayCount = await AiChatLog.count({
      where: {
        [Op.or]: [{ ip_address: ipAddress }, { session_id: sessionId }],
        created_at: { [Op.gte]: new Date(`${today}T00:00:00`) },
      },
    });
    if (todayCount >= dailyLimit) {
      const hotline = (await settingService.getRawValue('hotline')) ?? '18001090';
      return {
        reply: `Bạn đã dùng hết ${dailyLimit} lượt hỏi hôm nay. Vui lòng gọi hotline ${hotline} để được hỗ trợ.`,
      };
    }
    try {
      const [context, historyRows, resolved] = await Promise.all([
        config.rag_enabled
          ? buildContext(message)
          : Promise.resolve('Không sử dụng dữ liệu bổ sung.'),
        AiChatLog.findAll({
          where: { session_id: sessionId },
          order: [['created_at', 'DESC']],
          limit: 6,
        }),
        aiSettingsService.resolveProvider(),
      ]);
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
      const safeReply =
        reply || (await settingService.getRawValue('ai_fallback_message')) || FALLBACK;
      await AiChatLog.create({
        session_id: sessionId,
        user_message: message,
        ai_response: safeReply,
        ip_address: ipAddress,
      });
      return { reply: safeReply };
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
      return { reply: fallback };
    }
  },
};
