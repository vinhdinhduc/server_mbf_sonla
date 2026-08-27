import { NextFunction, Request, Response } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Express 4 khong tu dong bat loi tu async/await trong controller.
 * Wrapper nay dam bao moi loi (kể cả AppError, ZodError) duoc forward
 * vao errorHandler.middleware.ts thay vi lam crash process.
 */
export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
