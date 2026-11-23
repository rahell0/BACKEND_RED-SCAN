
import { Router } from 'express';

import {
  getStok,
  addStok,
  updateStok,
  updateJumlahStok,
  getRiwayatStok,
  deleteStok,
} from '../controllers/stokController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Semua endpoint stok hanya bisa diakses admin.
router.use(verifyAdmin);

// Mengambil semua bahan
router.get('/', getStok);

// Mengambil riwayat stok
router.get('/riwayat', getRiwayatStok);

// Menambahkan bahan
router.post('/', addStok);

// Mengedit informasi bahan
router.put('/:id', updateStok);

// Mengubah jumlah stok
router.patch('/:id/jumlah', updateJumlahStok);

// Menghapus bahan
router.delete('/:id', deleteStok);

export default router;
