
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import {
  findUserByEmail,
  updateUserPassword,
  findUserById,
  isEmailUsedByAnotherUser,
  updateUserProfile
} from '../models/authModel';

import { AuthRequest } from '../middlewares/authMiddleware';

import {
  catatAktivitas,
  ambilInfoAktivitas
} from '../utils/activityLogger';

// ==========================================
// REGISTRASI PUBLIK DINONAKTIFKAN
// ==========================================
export const register = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(403).json({
    success: false,
    message: 'Registrasi publik dinonaktifkan. Hubungi administrator.'
  });
};

// ==========================================
// LOGIN ADMIN
// ==========================================
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const body = req.body ?? {};
  const { email, password } = body;

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi.'
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

  if (!gmailPattern.test(cleanEmail)) {
    res.status(400).json({
      success: false,
      message: 'Email harus menggunakan format @gmail.com.'
    });
    return;
  }

  try {
    const info = ambilInfoAktivitas(req);

    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      await catatAktivitas({
        user_id: null,
        user_email: cleanEmail,
        aktivitas: 'LOGIN_GAGAL',
        deskripsi: 'Percobaan login gagal karena email tidak ditemukan.',
        modul: 'Autentikasi',
        ...info
      });

      res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
      return;
    }

    if (user.role !== 'admin') {
      await catatAktivitas({
        user_id: user.id,
        user_email: user.email,
        aktivitas: 'LOGIN_DITOLAK',
        deskripsi: 'Login ditolak karena akun bukan admin.',
        modul: 'Autentikasi',
        ...info
      });

      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Akun ini bukan admin.'
      });
      return;
    }

    const storedPassword = user.password;

    const isBcryptHash =
      /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    let passwordMatches = false;

    if (isBcryptHash) {
      passwordMatches = await bcrypt.compare(
        password,
        storedPassword
      );
    } else {
      // Kompatibilitas sementara untuk password akun lama.
      passwordMatches = password === storedPassword;

      if (passwordMatches) {
        const newHash = await bcrypt.hash(password, 12);
        await updateUserPassword(user.id, newHash);
      }
    }

    if (!passwordMatches) {
      await catatAktivitas({
        user_id: user.id,
        user_email: user.email,
        aktivitas: 'LOGIN_GAGAL',
        deskripsi: 'Percobaan login gagal karena password salah.',
        modul: 'Autentikasi',
        ...info
      });

      res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET belum diatur pada file .env');
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      {
        expiresIn: '8h'
      }
    );

    await catatAktivitas({
      user_id: user.id,
      user_email: user.email,
      aktivitas: 'LOGIN_BERHASIL',
      deskripsi: 'Admin berhasil login ke website REDScan.',
      modul: 'Autentikasi',
      ...info
    });

    res.status(200).json({
      success: true,
      message: 'Login admin berhasil.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UPDATE PROFIL ADMIN
// ==========================================
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    const body = req.body ?? {};
    const { name, email } = body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Silakan login terlebih dahulu.'
      });
      return;
    }

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      !name.trim() ||
      !email.trim()
    ) {
      res.status(400).json({
        success: false,
        message: 'Nama lengkap dan email wajib diisi.'
      });
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Nama harus terdiri dari 2 sampai 100 karakter.'
      });
      return;
    }

    const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

    if (!gmailPattern.test(cleanEmail)) {
      res.status(400).json({
        success: false,
        message: 'Email harus menggunakan format @gmail.com.'
      });
      return;
    }

    const emailUsed = await isEmailUsedByAnotherUser(
      cleanEmail,
      userId
    );

    if (emailUsed) {
      res.status(409).json({
        success: false,
        message: 'Email sudah digunakan oleh akun lain.'
      });
      return;
    }

    await updateUserProfile(
      userId,
      cleanName,
      cleanEmail
    );

    const updatedUser = await findUserById(userId);

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'Data admin tidak ditemukan.'
      });
      return;
    }

    await catatAktivitas({
      user_id: userId,
      user_email: updatedUser.email,
      aktivitas: 'UPDATE_PROFIL',
      deskripsi: 'Admin memperbarui informasi profil.',
      modul: 'Profil',
      referensi_id: String(userId),
      ...ambilInfoAktivitas(req)
    });

    res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};
