import { NextFunction, Request, Response } from 'express';
import { consumeRateLimit } from '../services/rateLimit.service';

export function dynamicRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  consumeRateLimit(req.method, req.originalUrl.split('?')[0], ip, req.body || {}, req.user?.id)
    .then((result) => {
      if (!result) return next();
      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.reset));
      if (result.blocked) {
        res.setHeader('Retry-After', String(result.retryAfter));
        return res.status(429).json({ success: false, data: null, message: result.message });
      }
      return next();
    })
    .catch(next);
}
