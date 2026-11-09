
import { Request, Response } from 'express';
import db from '../config/db';

export const getLaporanOmzet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
        const [debugRows]: any = await db.query(`
      SELECT
        DATABASE() AS databaseAktif,
        @@port AS portMySQL,
        COUNT(*) AS jumlahTransaksi,
        SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS transaksiSelesai
      FROM pemesanan
    `);

    console.log('DEBUG DATABASE OMZET:', debugRows);
    // Mengambil filter tanggal dari frontend
    const filterRange = String(req.query.range || 'hari_ini');

    // Menentukan filter tanggal
    let filterTanggal = '';

        switch (filterRange) {
      case 'semua':
        filterTanggal = '1=1';
        break;

      case 'kemarin':
        filterTanggal = 'DATE(created_at) = CURDATE() - INTERVAL 1 DAY';
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

    // Mengambil laporan omzet dari transaksi yang sudah selesai
    const [rows]: any = await db.query(`
      SELECT
        COUNT(*) AS totalTransaksi,

        COALESCE(SUM(total_harga), 0) AS totalOmzet,

        COALESCE(SUM(
          CASE
            WHEN LOWER(metode_pembayaran) = 'qris'
            THEN total_harga
            ELSE 0
          END
        ), 0) AS qrisOmzet,

        COALESCE(SUM(
          CASE
            WHEN LOWER(metode_pembayaran) IN ('tunai', 'cash')
            THEN total_harga
            ELSE 0
          END
        ), 0) AS tunaiOmzet

      FROM pemesanan

      WHERE LOWER(status) = 'selesai'
      AND ${filterTanggal}
    `);

    const laporan = rows[0];

    res.status(200).json({
      success: true,
      laporan: {
        totalTransaksi: Number(laporan.totalTransaksi),
        totalOmzet: Number(laporan.totalOmzet),
        qrisOmzet: Number(laporan.qrisOmzet),
        tunaiOmzet: Number(laporan.tunaiOmzet),
        rataRataTransaksi:
          laporan.totalTransaksi > 0
            ? Number(laporan.totalOmzet) /
              Number(laporan.totalTransaksi)
            : 0,
      },
    });
  } catch (error: any) {
    console.error('Error laporan omzet:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil laporan omzet',
      error: error.message,
    });
  }
};
