
import { Request, Response } from 'express';
import db from '../config/db';

// ==========================================
// MENGAMBIL LOG AKTIVITAS
// ==========================================

export const getActivityLogs = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        user_id,
        user_email,
        aktivitas,
        deskripsi,
        modul,
        referensi_id,
        ip_address,
        user_agent,
        created_at
      FROM activity_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 100`
    );

    res.status(200).json({
      success: true,
      message: 'Data log aktivitas berhasil diambil.',
      data: rows,
    });
  } catch (error) {
    console.error('Gagal mengambil log aktivitas:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data log aktivitas.',
    });
  }
};

// ==========================================
// MENGAMBIL LOG ERROR
// ==========================================

export const getErrorLogs = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        user_id,
        level,
        pesan,
        stack_trace,
        method,
        endpoint,
        status_code,
        ip_address,
        created_at
      FROM error_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 100`
    );

    res.status(200).json({
      success: true,
      message: 'Data log error berhasil diambil.',
      data: rows,
    });
  } catch (error) {
    console.error('Gagal mengambil log error:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data log error.',
    });
  }
};
