import { Request, Response } from 'express';
import db from '../config/db';

// 1. Mengambil semua notifikasi
export const getNotifikasi = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [rows]: any = await db.query(`
      SELECT *
      FROM notifikasi
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error mengambil notifikasi:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil notifikasi',
    });
  }
};

// 2. Mengambil notifikasi yang belum dibaca
export const getNotifikasiBelumDibaca = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [rows]: any = await db.query(`
      SELECT *
      FROM notifikasi
      WHERE sudah_dibaca = 0
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      success: true,
      jumlah: rows.length,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error mengambil notifikasi belum dibaca:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil notifikasi',
    });
  }
};

// 3. Menandai satu notifikasi sebagai sudah dibaca
export const tandaiNotifikasiDibaca = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'ID notifikasi tidak valid',
      });
      return;
    }

    const [result]: any = await db.query(
      `UPDATE notifikasi SET sudah_dibaca = 1 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({
        success: false,
        message: 'Notifikasi tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notifikasi berhasil ditandai sudah dibaca',
    });
  } catch (error: any) {
    console.error('Error memperbarui notifikasi:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui notifikasi',
    });
  }
};

// 4. Menandai semua notifikasi sebagai sudah dibaca
export const tandaiSemuaNotifikasiDibaca = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await db.query(`
      UPDATE notifikasi
      SET sudah_dibaca = 1
      WHERE sudah_dibaca = 0
    `);

    res.status(200).json({
      success: true,
      message: 'Semua notifikasi berhasil ditandai sudah dibaca',
    });
  } catch (error: any) {
    console.error('Error memperbarui semua notifikasi:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui notifikasi',
    });
  }
};

// 5. Menghapus satu notifikasi
export const hapusNotifikasi = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'ID notifikasi tidak valid',
      });
      return;
    }

    const [result]: any = await db.query(
      `DELETE FROM notifikasi WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({
        success: false,
        message: 'Notifikasi tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notifikasi berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error menghapus notifikasi:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal menghapus notifikasi',
    });
  }
};