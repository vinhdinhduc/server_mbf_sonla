import { Request, Response } from 'express';
import fs from 'fs/promises';
import { constants } from 'fs';
import nodemailer from 'nodemailer';
import { sequelize } from '../config/database';
import { env } from '../config/env';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/apiResponse';

export const dashboardController = {
  async get(req: Request, res: Response) {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const storeId = typeof req.query.storeId === 'string' ? Number(req.query.storeId) : undefined;
    const data = await dashboardService.get(req.user!, from, to, storeId);
    return sendSuccess(res, data);
  },
  async health(_req: Request, res: Response) {
    const checked_at = new Date().toISOString();
    const [db, storage, smtp] = await Promise.all([
      sequelize.authenticate().then(() => 'ok').catch(() => 'error'),
      fs.access(env.UPLOAD_DIR, constants.W_OK).then(() => 'ok').catch(() => 'error'),
      nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 2500, greetingTimeout: 2500, socketTimeout: 2500 }).verify().then(() => 'ok').catch(() => 'error'),
    ]);
    return sendSuccess(res, {
      checked_at,
      services: {
        db,
        storage,
        smtp,
        ai: env.ANTHROPIC_API_KEY ? 'configured' : 'error',
      },
    });
  },
};
