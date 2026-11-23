
import db from '../config/db';
import { Request } from 'express';

interface ErrorLogData {
  user_id?: number | null;
  level?: string;
  pesan: string;
  stack_trace?: string | null;
  method?: string | null;
  endpoint?: string | null;
  status_code?: number | null;
  ip_address?: string | null;
}

export const catatError = async (
  data: ErrorLogData
): Promise<void> => {
  try {
    await db.execute(
      `INSERT INTO error_logs
      (
        user_id,
        level,
        pesan,
        stack_trace,
        method,
        endpoint,
        status_code,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id ?? null,
        data.level ?? 'error',
        data.pesan,
        data.stack_trace ?? null,
        data.method ?? null,
        data.endpoint ?? null,
        data.status_code ?? null,
        data.ip_address ?? null,
      ]
    );
  } catch (error) {
    console.error('Gagal menyimpan error log:', error);
  }
};

export const ambilInfoError = (req: Request) => {
  return {
    method: req.method,
    endpoint: req.originalUrl,
    ip_address: req.ip,
  };
};
