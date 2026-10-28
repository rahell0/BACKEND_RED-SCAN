import { Request, Response } from 'express';
import db from '../config/db';

// REGISTER USER DENGAN VALIDASI
export const register = async (req: Request, res: Response) => {
  const { name, email, username, password } = req.body;

  // 1. Validasi Input Kosong
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nama, email, dan password wajib diisi!'
    });
  }

  // 2. Validasi Format Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Format email tidak valid!'
    });
  }

  // 3. Validasi Panjang Password (Min. 6 Karakter)
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password minimal terdiri dari 6 karakter!'
    });
  }

  try {
    // 4. Validasi Email Ganda
    const [existingUser]: any = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar!'
      });
    }

    // Simpan ke Database MySQL (tabel users)
    await db.query(
      'INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), username ? username.trim() : email.split('@')[0], password]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Registrasi berhasil!' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN USER
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password tidak boleh kosong!'
    });
  }

  try {
    // Sesuaikan SELECT menggunakan 'name' (bukan 'nama')
    const [rows]: any = await db.query(
      'SELECT id, name, email FROM users WHERE email = ? AND password = ?',
      [email.trim(), password]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      user: rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};