import { Request, Response } from 'express';
import db from '../config/db';

// 1. Ambil Semua Data Pemesanan
export const getPemesanan = async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query('SELECT * FROM pemesanan ORDER BY id DESC');
    res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Tambah Transaksi Pemesanan Baru
export const addPemesanan = async (req: Request, res: Response) => {
  const { total_harga, metode_pembayaran } = req.body;
  const kode_transaksi = `TRX-${Date.now()}`;

  try {
    const [result]: any = await db.query(
      'INSERT INTO pemesanan (kode_transaksi, total_harga, metode_pembayaran, status) VALUES (?, ?, ?, ?)',
      [kode_transaksi, total_harga, metode_pembayaran, 'selesai']
    );

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: {
        id: result.insertId,
        kode_transaksi,
        total_harga,
        metode_pembayaran
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};