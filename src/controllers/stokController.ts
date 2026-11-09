
import { Request, Response } from 'express';
import db from '../config/db';

// 1. MENGAMBIL SEMUA DATA STOK
export const getStok = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT
        id,
        kode_bahan,
        nama_bahan,
        kategori,
        jumlah_stok,
        satuan,
        stok_minimum,
        CASE
          WHEN jumlah_stok <= 0 THEN 'Habis'
          WHEN jumlah_stok <= stok_minimum THEN 'Menipis'
          ELSE 'Aman'
        END AS status_stok,
        created_at,
        updated_at
      FROM stok_bahan
      ORDER BY id DESC
    `);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Gagal mengambil data stok:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data stok bahan.',
    });
  }
};

// 2. MENAMBAHKAN BAHAN BARU
export const addStok = async (req: Request, res: Response) => {
  const {
    kode_bahan,
    nama_bahan,
    kategori,
    jumlah_stok,
    satuan,
    stok_minimum,
  } = req.body;

  const jumlah = Number(jumlah_stok ?? 0);
  const minimum = Number(stok_minimum ?? 0);

  if (
    !nama_bahan ||
    !kategori ||
    !satuan ||
    !Number.isFinite(jumlah) ||
    !Number.isFinite(minimum) ||
    jumlah < 0 ||
    minimum < 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Data bahan tidak valid atau belum lengkap.',
    });
  }

  try {
    const [result]: any = await db.query(
      `INSERT INTO stok_bahan
      (kode_bahan, nama_bahan, kategori, jumlah_stok, satuan, stok_minimum)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        kode_bahan || null,
        nama_bahan,
        kategori,
        jumlah,
        satuan,
        minimum,
      ]
    );

    // Catat stok awal jika jumlahnya lebih dari 0
    if (jumlah > 0) {
      await db.query(
        `INSERT INTO riwayat_stok
        (bahan_id, jenis_transaksi, jumlah, stok_sebelum, stok_sesudah, keterangan)
        VALUES (?, 'masuk', ?, 0, ?, ?)`,
        [
          result.insertId,
          jumlah,
          jumlah,
          'Stok awal bahan',
        ]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Bahan berhasil ditambahkan.',
      data: {
        id: result.insertId,
        nama_bahan,
        jumlah_stok: jumlah,
      },
    });
  } catch (error: any) {
    console.error('Gagal menambahkan bahan:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Kode bahan sudah digunakan.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan bahan.',
    });
  }
};

// 3. MENGEDIT INFORMASI BAHAN
export const updateStok = async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    kode_bahan,
    nama_bahan,
    kategori,
    satuan,
    stok_minimum,
  } = req.body;

  const minimum = Number(stok_minimum);

  if (
    !nama_bahan ||
    !kategori ||
    !satuan ||
    !Number.isFinite(minimum) ||
    minimum < 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Informasi bahan tidak valid.',
    });
  }

  try {
    const [result]: any = await db.query(
      `UPDATE stok_bahan
       SET kode_bahan = ?,
           nama_bahan = ?,
           kategori = ?,
           satuan = ?,
           stok_minimum = ?
       WHERE id = ?`,
      [
        kode_bahan || null,
        nama_bahan,
        kategori,
        satuan,
        minimum,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bahan tidak ditemukan.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Informasi bahan berhasil diperbarui.',
    });
  } catch (error: any) {
    console.error('Gagal mengedit bahan:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Kode bahan sudah digunakan.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui informasi bahan.',
    });
  }
};

// 4. MENAMBAHKAN STOK MASUK ATAU MENCATAT STOK KELUAR
export const updateJumlahStok = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const { jenis_transaksi, jumlah, keterangan } = req.body;

  const nilaiJumlah = Number(jumlah);

  if (
    !['masuk', 'keluar'].includes(jenis_transaksi) ||
    !Number.isFinite(nilaiJumlah) ||
    nilaiJumlah <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Jenis transaksi atau jumlah stok tidak valid.',
    });
  }

  let connection: any;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ambil stok dan kunci baris agar tidak berubah bersamaan
    const [rows]: any = await connection.query(
      'SELECT jumlah_stok FROM stok_bahan WHERE id = ? FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Bahan tidak ditemukan.',
      });
    }

    const stokSebelum = Number(rows[0].jumlah_stok);

    const stokSesudah =
      jenis_transaksi === 'masuk'
        ? stokSebelum + nilaiJumlah
        : stokSebelum - nilaiJumlah;

    if (stokSesudah < 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Stok tidak mencukupi untuk pengeluaran tersebut.',
      });
    }

    // Perbarui jumlah stok
    await connection.query(
      'UPDATE stok_bahan SET jumlah_stok = ? WHERE id = ?',
      [stokSesudah, id]
    );

    // Simpan riwayat perubahan stok
    await connection.query(
      `INSERT INTO riwayat_stok
      (bahan_id, jenis_transaksi, jumlah, stok_sebelum, stok_sesudah, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        jenis_transaksi,
        nilaiJumlah,
        stokSebelum,
        stokSesudah,
        keterangan || null,
      ]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Stok berhasil diperbarui.',
      data: {
        stok_sebelum: stokSebelum,
        stok_sesudah: stokSesudah,
      },
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Gagal memperbarui jumlah stok:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui jumlah stok.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// 5. MELIHAT RIWAYAT STOK
export const getRiwayatStok = async (
  req: Request,
  res: Response
) => {
  try {
    const [rows]: any = await db.query(`
      SELECT
        r.id,
        r.bahan_id,
        b.nama_bahan,
        b.satuan,
        r.jenis_transaksi,
        r.jumlah,
        r.stok_sebelum,
        r.stok_sesudah,
        r.keterangan,
        r.created_at
      FROM riwayat_stok r
      JOIN stok_bahan b ON r.bahan_id = b.id
      ORDER BY r.id DESC
    `);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Gagal mengambil riwayat stok:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat stok.',
    });
  }
};
