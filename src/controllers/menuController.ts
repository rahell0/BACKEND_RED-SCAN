
import { Request, Response } from 'express';
import db from '../config/db';

// ==========================================
// 1. MENGAMBIL SEMUA MENU
// URUTAN ID 1, 2, 3, ... 56
// MENU TERBARU TAMPIL PALING BAWAH
// ==========================================
export const getMenu = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT
        id,
        nama_menu,
        kategori,
        harga,
        deskripsi,
        gambar,
        created_at
      FROM menu
      ORDER BY id ASC
    `);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Gagal mengambil menu:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data menu.',
    });
  }
};

// ==========================================
// 2. MENAMBAHKAN MENU
// MENDUKUNG UPLOAD GAMBAR DENGAN MULTER
// ==========================================
export const addMenu = async (req: Request, res: Response) => {
  const {
    nama_menu,
    kategori,
    harga,
    deskripsi,
  } = req.body;

  // Mengambil gambar dari file yang diupload.
  // Jika tidak ada file, gunakan gambar dari request body.
  const gambar = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.gambar || null;

  const nilaiHarga = Number(harga);

  // Validasi data menu
  if (
    !nama_menu?.trim() ||
    !kategori ||
    harga === undefined ||
    !Number.isFinite(nilaiHarga) ||
    nilaiHarga < 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Nama, kategori, dan harga menu wajib diisi dengan benar.',
    });
  }

  try {
    const [result]: any = await db.query(
      `INSERT INTO menu
        (nama_menu, kategori, harga, deskripsi, gambar)
       VALUES (?, ?, ?, ?, ?)`,
      [
        nama_menu.trim(),
        kategori,
        nilaiHarga,
        deskripsi || null,
        gambar,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Menu berhasil ditambahkan.',
      data: {
        id: result.insertId,
        nama_menu: nama_menu.trim(),
        kategori,
        harga: nilaiHarga,
        deskripsi: deskripsi || null,
        gambar,
      },
    });
  } catch (error: any) {
    console.error('Gagal menambahkan menu:', error);

    if (
      error.code === 'WARN_DATA_TRUNCATED' ||
      error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Kategori menu tidak sesuai dengan pilihan database.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan menu.',
    });
  }
};

// ==========================================
// 3. MENGEDIT MENU
// MENDUKUNG PENGGANTIAN GAMBAR
// ==========================================
export const updateMenu = async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    nama_menu,
    kategori,
    harga,
    deskripsi,
  } = req.body;

  // Jika admin mengupload gambar baru, gunakan gambar baru.
  // Jika tidak, pertahankan gambar lama dari frontend.
  const gambar = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.gambar || null;

  const nilaiHarga = Number(harga);

  // Validasi data menu
  if (
    !nama_menu?.trim() ||
    !kategori ||
    harga === undefined ||
    !Number.isFinite(nilaiHarga) ||
    nilaiHarga < 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Data menu tidak valid atau belum lengkap.',
    });
  }

  try {
    const [result]: any = await db.query(
      `UPDATE menu
       SET nama_menu = ?,
           kategori = ?,
           harga = ?,
           deskripsi = ?,
           gambar = ?
       WHERE id = ?`,
      [
        nama_menu.trim(),
        kategori,
        nilaiHarga,
        deskripsi || null,
        gambar,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      const [rows]: any = await db.query(
        'SELECT id FROM menu WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Menu tidak ditemukan.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Menu berhasil diperbarui.',
    });
  } catch (error: any) {
    console.error('Gagal mengedit menu:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui menu.',
    });
  }
};

// ==========================================
// 4. MENGHAPUS MENU
// ==========================================
export const deleteMenu = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [result]: any = await db.query(
      'DELETE FROM menu WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu tidak ditemukan.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Menu berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Gagal menghapus menu:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message:
          'Menu masih digunakan pada data resep atau transaksi sehingga tidak bisa dihapus.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus menu.',
    });
  }
};

// ==========================================
// 5. MENGAMBIL RESEP DAN BAHAN BAKU MENU
// ==========================================
export const getResepMenu = async (req: Request, res: Response) => {
  const menuId = Number(req.params.id);

  if (!Number.isInteger(menuId) || menuId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID menu tidak valid.',
    });
  }

  try {
    const [menuRows]: any = await db.query(
      `SELECT id, nama_menu, harga
       FROM menu
       WHERE id = ?`,
      [menuId]
    );

    if (menuRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu tidak ditemukan.',
      });
    }

    const [bahanRows]: any = await db.query(`
      SELECT
        id,
        nama_bahan,
        kategori,
        jumlah_stok,
        satuan,
        stok_minimum
      FROM stok_bahan
      ORDER BY nama_bahan ASC
    `);

    const [resepRows]: any = await db.query(
      `SELECT
        r.id,
        r.menu_id,
        r.bahan_id,
        r.jumlah_pemakaian,
        r.satuan,
        b.nama_bahan,
        b.jumlah_stok,
        b.satuan AS satuan_stok
      FROM detail_resep r
      JOIN stok_bahan b ON r.bahan_id = b.id
      WHERE r.menu_id = ?
      ORDER BY r.id ASC`,
      [menuId]
    );

    return res.status(200).json({
      success: true,
      data: {
        menu: menuRows[0],
        bahan: bahanRows,
        resep: resepRows,
      },
    });
  } catch (error: any) {
    console.error('Gagal mengambil resep menu:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data resep menu.',
    });
  }
};

// ==========================================
// 6. MENYIMPAN / MEMPERBARUI RESEP MENU
// ==========================================
export const simpanResepMenu = async (req: Request, res: Response) => {
  const menuId = Number(req.params.id);
  const { items } = req.body;

  if (!Number.isInteger(menuId) || menuId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID menu tidak valid.',
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Resep harus memiliki minimal satu bahan baku.',
    });
  }

  const bahanTerpakai = new Set<number>();

  for (const item of items) {
    const bahanId = Number(item.bahan_id);
    const jumlah = Number(item.jumlah_pemakaian);

    if (
      !Number.isInteger(bahanId) ||
      bahanId <= 0 ||
      !Number.isFinite(jumlah) ||
      jumlah <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Bahan atau jumlah pemakaian tidak valid.',
      });
    }

    if (bahanTerpakai.has(bahanId)) {
      return res.status(400).json({
        success: false,
        message: 'Bahan yang sama tidak boleh dimasukkan dua kali.',
      });
    }

    bahanTerpakai.add(bahanId);
  }

  let connection: any;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [menuRows]: any = await connection.query(
      'SELECT id FROM menu WHERE id = ?',
      [menuId]
    );

    if (menuRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Menu tidak ditemukan.',
      });
    }

    const resepBaru: any[] = [];

    for (const item of items) {
      const bahanId = Number(item.bahan_id);
      const jumlah = Number(item.jumlah_pemakaian);

      const [bahanRows]: any = await connection.query(
        'SELECT id, satuan FROM stok_bahan WHERE id = ?',
        [bahanId]
      );

      if (bahanRows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: `Bahan dengan ID ${bahanId} tidak ditemukan.`,
        });
      }

      resepBaru.push({
        bahan_id: bahanId,
        jumlah_pemakaian: jumlah,
        satuan: bahanRows[0].satuan,
      });
    }

    // Menghapus resep lama setelah semua bahan tervalidasi.
    await connection.query(
      'DELETE FROM detail_resep WHERE menu_id = ?',
      [menuId]
    );

    // Menyimpan resep baru.
    for (const item of resepBaru) {
      await connection.query(
        `INSERT INTO detail_resep
          (menu_id, bahan_id, jumlah_pemakaian, satuan)
         VALUES (?, ?, ?, ?)`,
        [
          menuId,
          item.bahan_id,
          item.jumlah_pemakaian,
          item.satuan,
        ]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Resep menu berhasil disimpan.',
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Gagal menyimpan resep menu:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan resep menu.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
