import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Hanya admin dengan token valid yang bisa melihat statistik dashboard
router.get('/stats', verifyAdmin, getDashboardStats);

export default router;