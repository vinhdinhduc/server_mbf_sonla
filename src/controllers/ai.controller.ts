import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { chatbotService } from '../services/chatbot.service';
import { AiChatLog } from '../models/AiChatLog.model';
import { AiKnowledgeEntry } from '../models/AiKnowledgeEntry.model';
import { aiSettingsService } from '../services/aiSettings.service';
import {
  aiSettingsSchema,
  aiTestConnectionSchema,
  chatLogUpdateSchema,
  knowledgeSchema,
} from '../validators/ai.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { aiUsageService } from '../services/aiUsage.service';

export const aiController = {
  async getSettings(_req: Request, res: Response) {
    sendSuccess(res, await aiSettingsService.getAdminConfig());
  },
  async updateSettings(req: Request, res: Response) {
    const dto = aiSettingsSchema.parse(req.body);
    sendSuccess(res, await aiSettingsService.update(dto, req.user!.id), 'Đã lưu cấu hình AI');
  },
  async testConnection(req: Request, res: Response) {
    sendSuccess(
      res,
      await aiSettingsService.testConnection(aiTestConnectionSchema.parse(req.body)),
    );
  },
  async listKnowledge(req: Request, res: Response) {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const where = search
      ? {
          [Op.or]: [
            { title: { [Op.like]: `%${search}%` } },
            { content: { [Op.like]: `%${search}%` } },
            { tags: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;
    sendSuccess(res, await AiKnowledgeEntry.findAll({ where, order: [['updated_at', 'DESC']] }));
  },
  async createKnowledge(req: Request, res: Response) {
    const dto = knowledgeSchema.parse(req.body);
    sendCreated(
      res,
      await AiKnowledgeEntry.create({ ...dto, created_by: req.user!.id, updated_at: new Date() }),
      'Đã thêm tri thức',
    );
  },
  async updateKnowledge(req: Request, res: Response) {
    const item = await AiKnowledgeEntry.findByPk(Number(req.params.id));
    if (!item) throw AppError.notFound('Không tìm thấy tri thức');
    await item.update({ ...knowledgeSchema.partial().parse(req.body), updated_at: new Date() });
    sendSuccess(res, item, 'Đã cập nhật tri thức');
  },
  async deleteKnowledge(req: Request, res: Response) {
    const item = await AiKnowledgeEntry.findByPk(Number(req.params.id));
    if (!item) throw AppError.notFound('Không tìm thấy tri thức');
    await item.destroy();
    sendSuccess(res, null, 'Đã xóa tri thức');
  },
  async listLogs(req: Request, res: Response) {
    const flagged = req.query.flagged === 'true';
    sendSuccess(
      res,
      await AiChatLog.findAll({
        where: flagged ? { flagged_for_review: true } : undefined,
        order: [['created_at', 'DESC']],
        limit: 100,
      }),
    );
  },
  async updateLog(req: Request, res: Response) {
    const item = await AiChatLog.findByPk(Number(req.params.id));
    if (!item) throw AppError.notFound('Không tìm thấy hội thoại');
    await item.update(chatLogUpdateSchema.parse(req.body));
    sendSuccess(res, item, 'Đã cập nhật đánh giá hội thoại');
  },
  async stats(_req: Request, res: Response) {
    const rows = await sequelize.query(
      'SELECT COUNT(*) conversations,COALESCE(SUM(flagged_for_review=1),0) flagged FROM ai_chat_logs WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)',
      { type: QueryTypes.SELECT },
    );
    sendSuccess(res, { ...(rows[0] as object), ...(await aiUsageService.stats()) });
  },
  async playground(req: Request, res: Response) {
    sendSuccess(
      res,
      await chatbotService.answerQuestion(
        `playground-${req.user!.id}`,
        String(req.body.message || ''),
        `admin:${req.user!.id}`,
      ),
    );
  },
};
