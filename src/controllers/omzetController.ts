
import { Request, Response } from 'express';
import db from '../config/db';

export const getLaporanOmzet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filterRange = String(req.query.range || 'hari_ini');

    // Filter tanggal berdasarkan pilihan frontend.
    // Semua kondisi di bawah adalah query tetap, bukan input SQL bebas.
    let filterTanggal = '';

    switch (filterRange) {
      case 'semua':
        filterTanggal = '1=1';
        break;

      case 'kemarin':
        filterTanggal = `
          DATE(created_at) = CURDATE() - INTERVAL 1 DAY
        `;
        break;

      case 'minggu_ini':
        filterTanggal = `
          YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
        `;
        break;

      case 'bulan_ini':
        filterTanggal = `
          YEAR(created_at) = YEAR(CURDATE())
          AND MONTH(created_at) = MONTH(CURDATE())
        `;
        break;

      case 'hari_ini':
      default:
        filterTanggal = 'DATE(created_at) = CURDATE()';
        break;
    }

    // Mengambil data transaksi yang sudah selesai.
    const [rows]: any = await db.query(`
      SELECT
        COUNT(*) AS totalTransaksi,

        COALESCE(SUM(total_harga), 0) AS totalOmzet,

        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(metode_pembayaran, '')) LIKE '%qris%'
            THEN total_harga
            ELSE 0
          END
        ), 0) AS qrisOmzet,

        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(metode_pembayaran, '')) LIKE '%tunai%'
              OR LOWER(COALESCE(metode_pembayaran, '')) LIKE '%cash%'
            THEN total_harga
            ELSE 0
          END
        ), 0) AS tunaiOmzet,

        COUNT(
          CASE
            WHEN LOWER(COALESCE(metode_pembayaran, '')) LIKE '%qris%'
            THEN 1
          END
        ) AS qrisTransaksi,

        COUNT(
          CASE
            WHEN LOWER(COALESCE(metode_pembayaran, '')) LIKE '%tunai%'
              OR LOWER(COALESCE(metode_pembayaran, '')) LIKE '%cash%'
            THEN 1
          END
        ) AS tunaiTransaksi

      FROM pemesanan

      WHERE LOWER(COALESCE(status, '')) = 'selesai'
      AND ${filterTanggal}
    `);

    const laporan = rows[0];

    const totalTransaksi = Number(laporan.totalTransaksi) || 0;
    const totalOmzet = Number(laporan.totalOmzet) || 0;
    const qrisOmzet = Number(laporan.qrisOmzet) || 0;
    const tunaiOmzet = Number(laporan.tunaiOmzet) || 0;

    res.status(200).json({
      success: true,
      laporan: {
        totalTransaksi,
        totalOmzet,
        qrisOmzet,
        tunaiOmzet,

        qrisTransaksi: Number(laporan.qrisTransaksi) || 0,
        tunaiTransaksi: Number(laporan.tunaiTransaksi) || 0,

        rataRataTransaksi:
          totalTransaksi > 0
            ? totalOmzet / totalTransaksi
            : 0,
      },
    });
  } catch (error: any) {
    console.error('Error laporan omzet:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data laporan omzet.',
      error: error.message,
    });
  }
};
