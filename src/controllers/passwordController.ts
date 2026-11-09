import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body;

    // 1. Validasi input wajib
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      typeof confirmPassword !== 'string' ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      res.status(400).json({
        success: false,
        message: 'Semua kolom password wajib diisi.'
      });
      return;
    }

    // 2. Validasi aturan password baru
    const passwordPattern =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=])[A-Za-z\d!@#$%^&*()_\-+=]{8,}$/;

    if (!passwordPattern.test(newPassword)) {
      res.status(400).json({
        success: false,
        message:
          'Password baru minimal 8 karakter dan harus memiliki huruf kapital, huruf kecil, angka, serta simbol (!@#$%^&*_-+=).'
      });
      return;
    }

    // 3. Validasi konfirmasi password
    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Konfirmasi password baru tidak cocok.'
      });
      return;
    }

    // 4. Pastikan password baru berbeda dari password lama
    if (newPassword === currentPassword) {
      res.status(400).json({
        success: false,
        message: 'Password baru harus berbeda dari password lama.'
      });
      return;
    }

    // 5. Pastikan identitas admin tersedia dari token
    const adminId = req.user?.id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Identitas admin tidak ditemukan. Silakan login kembali.'
      });
      return;
    }

    // 6. Ambil password admin dari database
    const [rows]: any = await db.query(
      'SELECT id, password FROM users WHERE id = ? LIMIT 1',
      [adminId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Akun admin tidak ditemukan.'
      });
      return;
    }

    const storedPassword: string = rows[0].password;

    // 7. Verifikasi password lama
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    const passwordMatches = isBcryptHash
      ? await bcrypt.compare(currentPassword, storedPassword)
      : currentPassword === storedPassword;

    if (!passwordMatches) {
      res.status(400).json({
        success: false,
        message: 'Password lama tidak sesuai.'
      });
      return;
    }

    // 8. Hash password baru sebelum disimpan
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, adminId]
    );

    // 9. Kirim respons berhasil
    res.status(200).json({
      success: true,
      message: 'Password berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
};