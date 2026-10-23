import { Request, Response } from 'express';
import { db } from '../config/db';

// 1. LOGIKA REGISTER
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, username, password } = req.body;
    await db.query(
      'INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)',
      [name, email, username, password]
    );
    res.status(201).json({ message: 'Registrasi berhasil!' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal registrasi', error: error.message });
  }
};

// 2. LOGIKA LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const [rows]: any = await db.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?',
      [username, username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    res.json({ message: 'Login berhasil!', user: rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal login', error: error.message });
  }
};

// 3. LOGIKA FORGOT PASSWORD
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    const [result]: any = await db.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [newPassword, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Email tidak ditemukan!' });
    }

    res.json({ message: 'Password berhasil diperbarui!' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mereset password', error: error.message });
  }
};