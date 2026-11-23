
import { Router } from 'express';

import {
  getMenu,
  addMenu,
  updateMenu,
  deleteMenu,
  getResepMenu,
  simpanResepMenu,
} from '../controllers/menuController';

import { verifyAdmin } from '../middlewares/authMiddleware';
import uploadMenu from '../middlewares/uploadMenu';

const router = Router();

// ==========================================
// MENU
// ==========================================

// Daftar menu bisa diakses aplikasi pelanggan.
router.get('/', getMenu);

// Admin mengelola menu.
// upload.single('gambar') menerima satu file dengan nama field gambar.
router.post(
  '/',
  verifyAdmin,
  uploadMenu.single('gambar'),
  addMenu
);

router.put(
  '/:id',
  verifyAdmin,
  uploadMenu.single('gambar'),
  updateMenu
);

router.delete('/:id', verifyAdmin, deleteMenu);

// ==========================================
// RESEP MENU
// ==========================================

router.get('/:id/resep', verifyAdmin, getResepMenu);
router.put('/:id/resep', verifyAdmin, simpanResepMenu);

export default router;
