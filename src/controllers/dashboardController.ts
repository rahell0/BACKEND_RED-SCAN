import { Request, Response } from 'express';
import db from '../config/db';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Hitung total transaksi dan total omzet dari MySQL
    const [totalRes]: any = await db.query('SELECT COUNT(*) as totalTransaksi, IFNULL(SUM(total_harga), 0) as totalOmzet FROM pemesanan');
    const [qrisRes]: any = await db.query("SELECT IFNULL(SUM(total_harga), 0) as qrisOmzet FROM pemesanan WHERE metode_pembayaran = 'qris'");
    const [tunaiRes]: any = await db.query("SELECT IFNULL(SUM(total_harga), 0) as tunaiOmzet FROM pemesanan WHERE metode_pembayaran = 'tunai'");

    res.status(200).json({
      success: true,
      stats: {
        totalTransaksi: totalRes[0].totalTransaksi,
        totalOmzet: Number(totalRes[0].totalOmzet),
        qrisOmzet: Number(qrisRes[0].qrisOmzet),
        tunaiOmzet: Number(tunaiRes[0].tunaiOmzet),
        pesananAntre: 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};