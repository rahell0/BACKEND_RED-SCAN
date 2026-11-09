
import { Router } from 'express';

import {
  getPemesanan,
  addPemesanan,
  updateStatusPemesanan,
} from '../controllers/pemesananController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Mengambil semua data pemesanan
router.get('/', verifyAdmin, getPemesanan);

// Menambahkan transaksi dari aplikasi pelanggan
router.post('/', addPemesanan);

// Mengubah status pesanan dari web admin
router.put('/:id/status', verifyAdmin, updateStatusPemesanan);

export default router;
