import { Router } from 'express';

import {
  getPemesanan,
  getRiwayatPemesanan,
  addPemesanan,
  updateStatusPemesanan,
} from '../controllers/pemesananController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Riwayat pesanan pelanggan berdasarkan nomor HP
router.get('/riwayat/:nomor_hp', getRiwayatPemesanan);

// Mengambil semua data pemesanan untuk admin
router.get('/', verifyAdmin, getPemesanan);

// Menambahkan transaksi dari aplikasi pelanggan
router.post('/', addPemesanan);

// Mengubah status pesanan dari website admin
router.put('/:id/status', verifyAdmin, updateStatusPemesanan);

export default router;