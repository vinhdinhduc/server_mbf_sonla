import { AiChatLog } from '../models/AiChatLog.model';
import { AppError } from '../utils/AppError';

export const chatbotFeedbackService = {
  async save(input: { session_id: string; answer_id: number; was_helpful: boolean; comment?: string }, ip: string) {
    // Do not expose a log or allow updates by guessing its numeric ID.
    const log = await AiChatLog.findOne({ where: { id: input.answer_id, session_id: input.session_id, ip_address: ip } });
    if (!log) throw AppError.notFound('Không tìm thấy câu trả lời trong phiên này.');
    await log.update({
      was_helpful: input.was_helpful,
      feedback_comment: input.was_helpful ? null : input.comment || null,
      flagged_for_review: log.flagged_for_review || !input.was_helpful,
    });
    return { saved: true };
  },
};
