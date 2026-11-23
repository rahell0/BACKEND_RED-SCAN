
import { Router } from 'express';

import {
  login,
  register,
  updateProfile
} from '../controllers/authController';

import { changePassword } from '../controllers/passwordController';

import {
  forgotPassword,
  verifyOtp,
  resetPassword
} from '../controllers/forgotPasswordController';

import { verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);

// UPDATE PROFIL ADMIN
router.put('/profile', verifyAdmin, updateProfile);

// UBAH PASSWORD
router.post('/change-password', verifyAdmin, changePassword);

// FORGOT PASSWORD
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

export default router;
