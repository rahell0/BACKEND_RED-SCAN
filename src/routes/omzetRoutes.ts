import { Router } from 'express';
import { getLaporanOmzet } from '../controllers/omzetController';

const router = Router();

router.get('/', getLaporanOmzet);

export default router;