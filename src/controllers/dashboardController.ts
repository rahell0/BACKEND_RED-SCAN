import { Request, Response } from 'express';
import db from '../config/db';

export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Menghitung jumlah transaksi dan total omzet
    const [totalRes]: any = await db.query(`
      SELECT
        COUNT(*) AS totalTransaksi,
        IFNULL(SUM(total_harga), 0) AS totalOmzet
      FROM pemesanan
    `);

    // Menghitung omzet dari pembayaran QRIS
    const [qrisRes]: any = await db.query(`
      SELECT IFNULL(SUM(total_harga), 0) AS qrisOmzet
      FROM pemesanan
      WHERE LOWER(metode_pembayaran) = 'qris'
    `);

    // Menghitung omzet dari pembayaran tunai
    const [tunaiRes]: any = await db.query(`
      SELECT IFNULL(SUM(total_harga), 0) AS tunaiOmzet
      FROM pemesanan
      WHERE LOWER(metode_pembayaran) = 'tunai'
    `);

    // Menghitung pesanan yang masih antre
    const [pesananDiprosesRows]: any = await db.query(`
    SELECT COUNT(*) AS pesananDiproses
    FROM pemesanan
    WHERE LOWER(status) = 'diproses'
  `);
    res.status(200).json({
      success: true,
      stats: {
        totalTransaksi: Number(totalRes[0].totalTransaksi),
        totalOmzet: Number(totalRes[0].totalOmzet),
        qrisOmzet: Number(qrisRes[0].qrisOmzet),
        tunaiOmzet: Number(tunaiRes[0].tunaiOmzet),
        pesananDiproses: pesananDiprosesRows[0].pesananDiproses,
      }
    });
  } catch (error: any) {
    console.error('Gagal mengambil statistik dashboard:', error);

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik dashboard.'
    });
  }
};