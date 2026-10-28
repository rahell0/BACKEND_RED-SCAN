import { Request, Response } from 'express';
import db from '../config/db';

export const getStok = async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query('SELECT * FROM stok ORDER BY id DESC');
    res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addStok = async (req: Request, res: Response) => {
  const { name, stock, unit } = req.body;
  try {
    const [result]: any = await db.query(
      'INSERT INTO stok (name, stock, unit) VALUES (?, ?, ?)',
      [name, stock, unit]
    );
    res.status(201).json({ success: true, message: 'Stok berhasil ditambahkan', id: result.insertId });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStok = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, stock, unit } = req.body;
  try {
    await db.query(
      'UPDATE stok SET name = ?, stock = ?, unit = ? WHERE id = ?',
      [name, stock, unit, id]
    );
    res.status(200).json({ success: true, message: 'Stok berhasil diperbarui' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStok = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM stok WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Stok berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};