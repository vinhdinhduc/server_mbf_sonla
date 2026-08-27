import Anthropic from '@anthropic-ai/sdk';
import { Op } from 'sequelize';
import { AiChatLog } from '../models/AiChatLog.model';
import { Package } from '../models/Package.model';
import { SimNumber } from '../models/SimNumber.model';
import { News } from '../models/News.model';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { settingService } from './setting.service';
import { todayDateStringVietnam } from '../utils/vietnamTime';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Buoc 2 cua luong RAG (muc 7): truy van nhanh MySQL lay du lieu lien quan
 * theo tu khoa trong cau hoi. KHONG dung vector DB o quy mo nay.
 */
async function buildContext(question: string): Promise<string> {
  const lower = question.toLowerCase();
  const contextParts: string[] = [];

  if (lower.includes('gói cước') || lower.includes('goi cuoc') || lower.includes('gói')) {
    const packages = await Package.findAll({
      where: { status: 'active' },
      order: [['display_order', 'ASC']],
      limit: 5,
    });
    if (packages.length) {
      contextParts.push(
        `Danh sach goi cuoc dang active:\n${packages
          .map(
            (p) =>
              `- ${p.name} (${p.code}): ${p.price}d/${p.duration_value} ${p.duration_unit}, ${p.data_desc ?? ''}`,
          )
          .join('\n')}`,
      );
    }
  }

  if (lower.includes('sim') || lower.includes('số đẹp') || lower.includes('so dep')) {
    const sims = await SimNumber.findAll({
      where: { status: 'available' },
      order: [['price', 'ASC']],
      limit: 5,
    });
    if (sims.length) {
      contextParts.push(
        `Mot vai so sim dang co san:\n${sims
          .map((s) => `- ${s.phone_number}: ${s.price}d (${s.sim_type})`)
          .join('\n')}`,
      );
    }
  }

  if (
    lower.includes('tin tức') ||
    lower.includes('tin tuc') ||
    lower.includes('khuyến mãi') ||
    lower.includes('khuyen mai')
  ) {
    const news = await News.findAll({
      where: { status: 'published' },
      order: [['published_at', 'DESC']],
      limit: 3,
    });
    if (news.length) {
      contextParts.push(
        `Tin tuc/khuyen mai gan day:\n${news.map((n) => `- ${n.title}`).join('\n')}`,
      );
    }
  }

  return contextParts.length > 0
    ? contextParts.join('\n\n')
    : 'Khong tim thay du lieu lien quan truc tiep trong he thong cho cau hoi nay.';
}

export const chatbotService = {
  async answerQuestion(
    sessionId: string,
    message: string,
    ipAddress: string,
  ): Promise<{ reply: string }> {
    // Middleware gioi han BAT BUOC: kiem tra so luot hoi trong ngay theo IP
    // truoc khi goi Anthropic API (muc 7). Neu vuot, tra loi 400, KHONG goi API.
    const dailyLimitRaw = await settingService.getRawValue('ai_daily_limit');
    const dailyLimit = dailyLimitRaw ? Number(dailyLimitRaw) : 20;

    const today = todayDateStringVietnam();
    const todayCount = await AiChatLog.count({
      where: {
        ip_address: ipAddress,
        created_at: { [Op.gte]: new Date(`${today}T00:00:00`) },
      },
    });

    if (todayCount >= dailyLimit) {
      throw AppError.badRequest(
        `Ban da dat gioi han ${dailyLimit} cau hoi/ngay cho chatbot. Vui long thu lai vao ngay mai hoac lien he hotline.`,
      );
    }

    const chatbotEnabled = await settingService.getRawValue('ai_chatbot_enabled');
    if (chatbotEnabled === 'false' || chatbotEnabled === '0') {
      throw AppError.badRequest('Chatbot AI hien dang tam ngung hoat dong');
    }

    const systemPrompt =
      (await settingService.getRawValue('ai_system_prompt')) ||
      'Ban la tro ly ao cua MobiFone chi nhanh Son La, tra loi ngan gon, lich su, chi dua tren du lieu duoc cung cap.';

    const context = await buildContext(message);

    const response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 500,
      system: `${systemPrompt}\n\nDu lieu tham khao tu he thong:\n${context}`,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const reply =
      textBlock && 'text' in textBlock
        ? textBlock.text
        : 'Xin loi, toi chua co cau tra loi phu hop.';

    await AiChatLog.create({
      session_id: sessionId,
      user_message: message,
      ai_response: reply,
      ip_address: ipAddress,
    });

    return { reply };
  },
};
