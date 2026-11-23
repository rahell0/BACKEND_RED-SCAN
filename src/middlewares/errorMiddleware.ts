
import { Request, Response, NextFunction } from 'express';

import {
  catatError,
  ambilInfoError,
} from '../utils/errorLogger';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Terjadi kesalahan:', err.message);

  // Mencatat error ke database
  const info = ambilInfoError(req);

  void catatError({
    user_id: null,
    level: 'error',
    pesan: err.message || 'Terjadi kesalahan pada server.',
    stack_trace: err.stack || null,
    method: info.method,
    endpoint: info.endpoint,
    status_code: 500,
    ip_address: info.ip_address,
  });

  // Jika response sudah dikirim, teruskan error
  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server.',
  });
};
