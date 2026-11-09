import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import {
  findUserByEmail,
  updateUserPassword
} from '../models/authModel';

// REGISTRASI PUBLIK DINONAKTIFKAN
// Akun admin hanya boleh dibuat melalui proses tepercaya.
export const register = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(403).json({
    success: false,
    message: 'Registrasi publik dinonaktifkan. Hubungi administrator.'
  });
};

// LOGIN ADMIN
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password } = req.body;

  // 1. Validasi input wajib
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

  // 2. Validasi format email Gmail
  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

  if (!gmailPattern.test(cleanEmail)) {
    res.status(400).json({
      success: false,
      message: 'Email harus menggunakan format @gmail.com.'
    });
    return;
  }

  try {
    // 3. Cari akun berdasarkan email
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
      return;
    }

    // 4. Pastikan akun memiliki role admin
    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Akun ini bukan admin.'
      });
      return;
    }

    // 5. Periksa password
    const storedPassword = user.password;

    // Mengenali hash bcrypt
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    let passwordMatches = false;

    if (isBcryptHash) {
      // Password tersimpan dalam bentuk hash bcrypt
      passwordMatches = await bcrypt.compare(
        password,
        storedPassword
      );
    } else {
      // Kompatibilitas sementara untuk akun lama
      // yang password-nya masih tersimpan sebagai teks biasa.
      passwordMatches = password === storedPassword;

      if (passwordMatches) {
        const newHash = await bcrypt.hash(password, 12);
        await updateUserPassword(user.id, newHash);
      }
    }

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
      return;
    }

    // 6. Pastikan secret JWT tersedia
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET belum diatur pada file .env');
    }

    // 7. Buat JWT Token
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

    // 8. Kirim respons login
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