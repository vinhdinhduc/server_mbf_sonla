import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { chatbotService, buildChatContext } from '../services/chatbot.service';
import { AiChatLog } from '../models/AiChatLog.model';
import { AiKnowledgeEntry } from '../models/AiKnowledgeEntry.model';
import { aiSettingsService, readAiValues, priceFor } from '../services/aiSettings.service';
import { providers } from '../services/llm/registry/providers';
import { profileKey } from '../services/llm/profiles';
import { listProviderModels } from '../services/llm/models';
import { createAiProvider, providerErrorCode } from '../services/aiProvider.service';
import { settingService } from '../services/setting.service';
import {
  aiSettingsSchema,
  aiTestConnectionSchema,
  chatLogUpdateSchema,
  knowledgeSchema,
  aiModelsSchema,
  aiPlaygroundSchema,
} from '../validators/ai.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { aiUsageService, estimateCost } from '../services/aiUsage.service';

function draftError(error: unknown) {
  if (error instanceof AppError) return error;
  const messages: Record<string, string> = {
    invalid_key: 'API key không hợp lệ hoặc đã hết hiệu lực.', access_denied: 'Key chưa có quyền truy cập model.',
    model_not_found: 'Không tìm thấy model hoặc endpoint.', quota_or_rate_limit: 'Đã hết hạn mức hoặc vượt giới hạn gọi API.',
    timeout: 'Nhà cung cấp phản hồi quá thời gian chờ 20 giây.', invalid_request: 'Model hoặc tham số chưa được chấp nhận.',
  };
  return AppError.badRequest(messages[providerErrorCode(error)] || 'Không thể nhận phản hồi. Kiểm tra key, model và endpoint rồi thử lại.');
}

export const aiController = {
  async providers(_req: Request, res: Response) { sendSuccess(res, providers); },
  async models(req: Request, res: Response) {
    const input = aiModelsSchema.parse({ ...req.body, provider: req.params.id });
    try {
      const key = input.api_key || await profileKey(input, await readAiValues());
      if (!key) throw AppError.badRequest('Vui lòng nhập API key để lấy danh sách model.');
      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, await listProviderModels(input.provider, key, input));
    } catch (error) { throw draftError(error); }
  },
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
    if (req.body.profile) {
      const input = aiPlaygroundSchema.parse(req.body);
      try {
        const values = await readAiValues();
        const key = await profileKey({ ...input.profile, profile_id: input.profile.id }, values);
        if (!key) throw AppError.badRequest('Vui lòng nhập API key cho profile đang thử.');
        const context = input.rag_enabled ? await buildChatContext(input.message) : { text: 'Không sử dụng dữ liệu bổ sung.', sources: [] };
        const price = priceFor(values, input.profile.provider, input.profile.model, input.profile.endpoint_id);
        const started = Date.now();
        const prompt = input.system_prompt.replace(/\{\{hotline\}\}/g, (await settingService.getRawValue('hotline')) || '18001090');
        const result = await createAiProvider(input.profile.provider, input.profile.model, key, price, input.profile).chat(prompt, context.text, input.history, input.message, { temperature: input.profile.temperature, maxTokens: input.profile.max_tokens, topP: input.profile.top_p });
        res.setHeader('Cache-Control', 'no-store');
        sendSuccess(res, { reply: result.text, model: result.model || input.profile.model, usage: result.usage, estimated_cost: estimateCost(result.usage, price), latency_ms: Date.now() - started });
        return;
      } catch (error) { throw draftError(error); }
    }
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
