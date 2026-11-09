import { Router } from 'express';

import {
  getNotifikasi,
  getNotifikasiBelumDibaca,
  tandaiNotifikasiDibaca,
  tandaiSemuaNotifikasiDibaca,
  hapusNotifikasi,
} from '../controllers/notifikasiController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Semua endpoint notifikasi hanya untuk admin
router.use(verifyAdmin);

router.get('/', getNotifikasi);

router.get('/belum-dibaca', getNotifikasiBelumDibaca);

router.patch('/baca-semua', tandaiSemuaNotifikasiDibaca);

router.patch('/:id/baca', tandaiNotifikasiDibaca);

router.delete('/:id', hapusNotifikasi);

export default router;