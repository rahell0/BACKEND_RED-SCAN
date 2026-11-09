import db from '../config/db';

// Mengambil semua data stok
export const getAllStok = async () => {
  const [rows] = await db.query(
    'SELECT * FROM stok ORDER BY id DESC'
  );

  return rows;
};

// Menambahkan stok baru
export const createStok = async (
  name: string,
  stock: number,
  unit: string
) => {
  const [result]: any = await db.query(
    'INSERT INTO stok (name, stock, unit) VALUES (?, ?, ?)',
    [name, stock, unit]
  );

  return result.insertId;
};

// Memperbarui stok berdasarkan ID
export const updateStokById = async (
  id: number,
  name: string,
  stock: number,
  unit: string
) => {
  const [result]: any = await db.query(
    'UPDATE stok SET name = ?, stock = ?, unit = ? WHERE id = ?',
    [name, stock, unit, id]
  );

  return result.affectedRows;
};

// Menghapus stok berdasarkan ID
export const deleteStokById = async (id: number) => {
  const [result]: any = await db.query(
    'DELETE FROM stok WHERE id = ?',
    [id]
  );

  return result.affectedRows;
};