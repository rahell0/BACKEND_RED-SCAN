
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import sendOtpEmail from '../config/mailer';

import {
  findUserByEmail,
  updateUserPassword,
} from '../models/authModel';

import {
  invalidateOldResets,
  createPasswordReset,
  findLatestPasswordReset,
  incrementOtpAttempts,
  saveResetToken,
  markPasswordResetUsed,
} from '../models/passwordResetModel';

// ==========================================
// HELPER: HASH OTP DAN TOKEN
// ==========================================
const hashValue = (value: string): string => {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
};

// ==========================================
// HELPER: VALIDASI EMAIL GMAIL
// ==========================================
const isValidGmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
};

// ==========================================
// HELPER: VALIDASI PASSWORD
// ==========================================
const isValidPassword = (password: string): boolean => {
  const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  return passwordPattern.test(password);
};

// ==========================================
// 1. KIRIM OTP KE EMAIL
// POST /api/auth/forgot-password
// ==========================================
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (
      typeof email !== 'string' ||
      !email.trim()
    ) {
      res.status(400).json({
        success: false,
        message: 'Email wajib diisi.',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidGmail(cleanEmail)) {
      res.status(400).json({
        success: false,
        message: 'Gunakan alamat email Gmail yang valid.',
      });
      return;
    }

    // Cari akun berdasarkan email.
    const user = await findUserByEmail(cleanEmail);

    // Tidak membocorkan apakah email terdaftar.
    if (!user || user.role !== 'admin') {
      res.status(200).json({
        success: true,
        message:
          'Jika email terdaftar sebagai admin, kode OTP akan dikirim.',
      });
      return;
    }

    // Buat OTP 6 digit.
    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    // Hash OTP sebelum disimpan.
    const otpHash = hashValue(
      `${cleanEmail}:${otp}`
    );

    // Nonaktifkan OTP lama.
    await invalidateOldResets(cleanEmail);

    // Simpan OTP baru dengan masa berlaku 10 menit.
    await createPasswordReset(
      cleanEmail,
      otpHash
    );

    // Kirim OTP ke email admin.
    try {
      await sendOtpEmail(cleanEmail, otp);
    } catch (emailError) {
      await invalidateOldResets(cleanEmail);
      throw emailError;
    }

    res.status(200).json({
      success: true,
      message: 'Kode OTP berhasil dikirim ke email kamu.',
    });

  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. VERIFIKASI OTP
// POST /api/auth/verify-otp
// ==========================================
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (
      typeof email !== 'string' ||
      typeof otp !== 'string' ||
      !email.trim() ||
      !/^\d{6}$/.test(otp)
    ) {
      res.status(400).json({
        success: false,
        message: 'Email dan OTP 6 digit wajib diisi.',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Pastikan akun merupakan admin.
    const user = await findUserByEmail(cleanEmail);

    if (!user || user.role !== 'admin') {
      res.status(400).json({
        success: false,
        message: 'OTP tidak valid atau sudah kedaluwarsa.',
      });
      return;
    }

    // Ambil OTP terbaru.
    const reset = await findLatestPasswordReset(cleanEmail);

    if (
      !reset ||
      reset.used_at ||
      reset.verified_at ||
      new Date(reset.expires_at).getTime() <= Date.now()
    ) {
      res.status(400).json({
        success: false,
        message: 'OTP tidak valid atau sudah kedaluwarsa.',
      });
      return;
    }

    // Maksimal 5 percobaan.
    if (Number(reset.attempts) >= 5) {
      await markPasswordResetUsed(reset.id);

      res.status(429).json({
        success: false,
        message:
          'Batas percobaan OTP habis. Silakan minta kode baru.',
      });
      return;
    }

    // Catat percobaan.
    await incrementOtpAttempts(reset.id);

    // Bandingkan hash OTP.
    const submittedHash = hashValue(
      `${cleanEmail}:${otp}`
    );

    if (submittedHash !== reset.otp_hash) {
      res.status(400).json({
        success: false,
        message: 'Kode OTP yang kamu masukkan salah.',
      });
      return;
    }

    // Buat token khusus untuk reset password.
    const resetToken = crypto
      .randomBytes(32)
      .toString('hex');

    const resetTokenHash = hashValue(resetToken);

    // Simpan hash token dengan masa berlaku 10 menit.
    await saveResetToken(
      reset.id,
      resetTokenHash
    );

    res.status(200).json({
      success: true,
      message: 'OTP berhasil diverifikasi.',
      resetToken,
    });

  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. RESET KATA SANDI
// POST /api/auth/reset-password
// ==========================================
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      email,
      resetToken,
      newPassword,
      confirmPassword,
    } = req.body;

    // Validasi input.
    if (
      typeof email !== 'string' ||
      typeof resetToken !== 'string' ||
      typeof newPassword !== 'string' ||
      typeof confirmPassword !== 'string' ||
      !email.trim() ||
      !resetToken ||
      !newPassword ||
      !confirmPassword
    ) {
      res.status(400).json({
        success: false,
        message: 'Semua data wajib diisi.',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Periksa konfirmasi password.
    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Konfirmasi kata sandi tidak cocok.',
      });
      return;
    }

    // Periksa aturan password.
    if (!isValidPassword(newPassword)) {
      res.status(400).json({
        success: false,
        message:
          'Kata sandi minimal 8 karakter dan harus memiliki huruf besar, huruf kecil, angka, serta simbol.',
      });
      return;
    }

    // Pastikan akun adalah admin.
    const user = await findUserByEmail(cleanEmail);

    if (!user || user.role !== 'admin') {
      res.status(400).json({
        success: false,
        message: 'Permintaan reset kata sandi tidak valid.',
      });
      return;
    }

    // Ambil data reset terbaru.
    const reset = await findLatestPasswordReset(cleanEmail);

    if (
      !reset ||
      reset.used_at ||
      !reset.verified_at ||
      !reset.reset_token_hash ||
      !reset.reset_token_expires_at ||
      new Date(reset.reset_token_expires_at).getTime() <= Date.now()
    ) {
      res.status(400).json({
        success: false,
        message:
          'Sesi reset tidak valid atau sudah kedaluwarsa. Ulangi proses.',
      });
      return;
    }

    // Periksa token reset.
    const submittedTokenHash = hashValue(resetToken);

    if (submittedTokenHash !== reset.reset_token_hash) {
      res.status(400).json({
        success: false,
        message: 'Token reset tidak valid.',
      });
      return;
    }

    // Hash password baru.
    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    // Perbarui password admin.
    await updateUserPassword(
      user.id,
      hashedPassword
    );

    // Tandai proses reset sudah digunakan.
    await markPasswordResetUsed(reset.id);

    res.status(200).json({
      success: true,
      message:
        'Kata sandi berhasil diubah. Silakan login kembali.',
    });

  } catch (error) {
    next(error);
  }
};
