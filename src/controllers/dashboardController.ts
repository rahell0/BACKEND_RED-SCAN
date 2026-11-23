
import { Request, Response } from 'express';
import db from '../config/db';

export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Total transaksi dan omzet yang sudah selesai
    const [totalRes]: any = await db.query(`
      SELECT
        COUNT(*) AS totalTransaksi,
        IFNULL(SUM(total_harga), 0) AS totalOmzet
      FROM pemesanan
      WHERE LOWER(status) = 'selesai'
    `);

    // 2. Omzet QRIS yang sudah selesai
    const [qrisRes]: any = await db.query(`
      SELECT
        IFNULL(SUM(total_harga), 0) AS qrisOmzet
      FROM pemesanan
      WHERE LOWER(status) = 'selesai'
        AND LOWER(metode_pembayaran) LIKE '%qris%'
    `);

    // 3. Omzet tunai yang sudah selesai
    const [tunaiRes]: any = await db.query(`
      SELECT
        IFNULL(SUM(total_harga), 0) AS tunaiOmzet
      FROM pemesanan
      WHERE LOWER(status) = 'selesai'
        AND LOWER(metode_pembayaran) LIKE '%tunai%'
    `);

    // 4. Pesanan yang sedang diproses
    const [pesananDiprosesRows]: any = await db.query(`
      SELECT
        COUNT(*) AS pesananDiproses
      FROM pemesanan
      WHERE LOWER(status) = 'diproses'
    `);

    // 5. Kirim data ke frontend
    res.status(200).json({
      success: true,
      stats: {
        totalTransaksi: Number(totalRes[0].totalTransaksi),
        totalOmzet: Number(totalRes[0].totalOmzet),
        qrisOmzet: Number(qrisRes[0].qrisOmzet),
        tunaiOmzet: Number(tunaiRes[0].tunaiOmzet),
        pesananDiproses: Number(
          pesananDiprosesRows[0].pesananDiproses
        ),
      },
    });

  } catch (error: any) {
    console.error(
      'Gagal mengambil statistik Dashboard:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik Dashboard.',
    });
  }
};
