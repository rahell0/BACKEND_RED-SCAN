import { Router } from 'express';
import { getPemesanan, addPemesanan } from '../controllers/pemesananController';

const router = Router();

router.get('/', getPemesanan);
router.post('/', addPemesanan);

export default router;