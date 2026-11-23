
import { Router } from 'express';

import {
  getActivityLogs,
  getErrorLogs,
} from '../controllers/logController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Semua endpoint log hanya bisa diakses admin.
router.use(verifyAdmin);

// Log Aktivitas
router.get('/activity', getActivityLogs);

// Log Error
router.get('/errors', getErrorLogs);

export default router;
