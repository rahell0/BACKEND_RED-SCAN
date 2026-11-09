import { Router } from 'express';

import { login, register } from '../controllers/authController';
import { changePassword } from '../controllers/passwordController';
import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', verifyAdmin, changePassword);

export default router;