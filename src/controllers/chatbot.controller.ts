import { Request, Response } from 'express';
import { chatbotService } from '../services/chatbot.service';
import { chatbotMessageSchema, chatbotFeedbackSchema } from '../validators/chatbot.validator';
import { chatbotFeedbackService } from '../services/chatbotFeedback.service';
import { sendSuccess } from '../utils/apiResponse';

export const chatbotController = {
  async feedback(req: Request, res: Response) {
    const dto = chatbotFeedbackSchema.parse(req.body);
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    sendSuccess(res, await chatbotFeedbackService.save(dto, ip));
  },
  async messageResult(sessionId: string, message: string, ip: string) {
    return chatbotService.answerQuestion(sessionId, message, ip);
  },
  async message(req: Request, res: Response) {
    const dto = chatbotMessageSchema.parse(req.body);
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const result = await chatbotController.messageResult(dto.session_id, dto.message, ip);
    sendSuccess(res, result);
  },
};
