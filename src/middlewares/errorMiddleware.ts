import { Request, Response, NextFunction } from 'express';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Terjadi kesalahan:', err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server.'
  });
};