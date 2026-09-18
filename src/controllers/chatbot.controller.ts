import { Request, Response } from 'express';
import { chatbotService } from '../services/chatbot.service';
import { chatbotMessageSchema } from '../validators/chatbot.validator';
import { sendSuccess } from '../utils/apiResponse';

export const chatbotController = {
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
