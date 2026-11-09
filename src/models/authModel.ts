import db from '../config/db';

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  password: string;
  role: string;
}

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

export const updateUserPassword = async (
  userId: number,
  hashedPassword: string
): Promise<void> => {
  await db.query(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, userId]
  );
};