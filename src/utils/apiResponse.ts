import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message = '', statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data, message });
}

export function sendCreated<T>(res: Response, data: T, message = ''): Response {
  return sendSuccess(res, data, message, 201);
}
