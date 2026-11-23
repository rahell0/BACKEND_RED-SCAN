
import db from '../config/db';
import { Request } from 'express';

interface ActivityLogData {
  user_id?: number | null;
  user_email?: string | null;
  aktivitas: string;
  deskripsi: string;
  modul?: string | null;
  referensi_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export const catatAktivitas = async (
  data: ActivityLogData
): Promise<void> => {
  try {
    await db.execute(
      `INSERT INTO activity_logs
      (
        user_id,
        user_email,
        aktivitas,
        deskripsi,
        modul,
        referensi_id,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id ?? null,
        data.user_email ?? null,
        data.aktivitas,
        data.deskripsi,
        data.modul ?? null,
        data.referensi_id ?? null,
        data.ip_address ?? null,
        data.user_agent ?? null,
      ]
    );
  } catch (error) {
    console.error('Gagal menyimpan activity log:', error);
  }
};

export const ambilInfoAktivitas = (req: Request) => {
  return {
    ip_address: req.ip,
    user_agent: req.get('user-agent') || null,
  };
};
