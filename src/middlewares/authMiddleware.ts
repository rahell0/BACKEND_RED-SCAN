import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AdminTokenPayload;
}

export const verifyAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Token tidak ditemukan. Silakan login terlebih dahulu.'
    });
    return;
  }

  const token = authorization.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    res.status(500).json({
      success: false,
      message: 'Konfigurasi JWT_SECRET belum tersedia.'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;

    if (decoded.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Hanya admin yang diperbolehkan.'
      });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.'
    });
  }
};