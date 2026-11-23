
import db from '../config/db';

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  password: string;
  role: string;
}

// MENCARI USER BERDASARKAN EMAIL
export const findUserByEmail = async (
  email: string
): Promise<User | null> => {
  const [rows]: any = await db.query(
    `SELECT id, name, email, username, password, role
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows.length > 0 ? rows[0] as User : null;
};

// MEMBUAT USER
export const createUser = async (
  name: string,
  email: string,
  username: string,
  hashedPassword: string
): Promise<void> => {
  await db.query(
    `INSERT INTO users (name, email, username, password, role)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, username, hashedPassword, 'admin']
  );
};

// MEMPERBARUI PASSWORD
export const updateUserPassword = async (
  userId: number,
  hashedPassword: string
): Promise<void> => {
  await db.query(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, userId]
  );
};

// MENGAMBIL DATA USER BERDASARKAN ID
export const findUserById = async (
  userId: number
): Promise<Omit<User, 'password'> | null> => {
  const [rows]: any = await db.query(
    `SELECT id, name, email, username, role
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return rows.length > 0 ? rows[0] : null;
};

// MEMERIKSA EMAIL YANG DIGUNAKAN AKUN LAIN
export const isEmailUsedByAnotherUser = async (
  email: string,
  userId: number
): Promise<boolean> => {
  const [rows]: any = await db.query(
    `SELECT id
     FROM users
     WHERE email = ? AND id != ?
     LIMIT 1`,
    [email, userId]
  );

  return rows.length > 0;
};

// MEMPERBARUI NAMA DAN EMAIL PROFIL
export const updateUserProfile = async (
  userId: number,
  name: string,
  email: string
): Promise<void> => {
  await db.query(
    `UPDATE users
     SET name = ?, email = ?
     WHERE id = ?`,
    [name, email, userId]
  );
};
