
import db from '../config/db';

export interface PasswordReset {
  id: number;
  email: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  verified_at: Date | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  used_at: Date | null;
}

// Menonaktifkan OTP lama milik email tersebut.
export const invalidateOldResets = async (
  email: string
): Promise<void> => {
  await db.query(
    `UPDATE password_resets
     SET used_at = NOW()
     WHERE email = ? AND used_at IS NULL`,
    [email]
  );
};

// Menyimpan OTP baru.
export const createPasswordReset = async (
  email: string,
  otpHash: string
): Promise<void> => {
  await db.query(
    `INSERT INTO password_resets
      (email, otp_hash, expires_at, attempts)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0)`,
    [email, otpHash]
  );
};

// Mengambil OTP terbaru yang belum digunakan.
export const findLatestPasswordReset = async (
  email: string
): Promise<PasswordReset | null> => {
  const [rows]: any = await db.query(
    `SELECT *
     FROM password_resets
     WHERE email = ?
       AND used_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [email]
  );

  return rows.length > 0 ? rows[0] as PasswordReset : null;
};

// Menambah jumlah percobaan OTP.
export const incrementOtpAttempts = async (
  id: number
): Promise<void> => {
  await db.query(
    `UPDATE password_resets
     SET attempts = attempts + 1
     WHERE id = ?`,
    [id]
  );
};

// Menyimpan token reset setelah OTP benar.
export const saveResetToken = async (
  id: number,
  tokenHash: string
): Promise<void> => {
  await db.query(
    `UPDATE password_resets
     SET verified_at = NOW(),
         reset_token_hash = ?,
         reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
     WHERE id = ?`,
    [tokenHash, id]
  );
};

// Menandai OTP dan token reset sudah digunakan.
export const markPasswordResetUsed = async (
  id: number
): Promise<void> => {
  await db.query(
    `UPDATE password_resets
     SET used_at = NOW()
     WHERE id = ?`,
    [id]
  );
};
