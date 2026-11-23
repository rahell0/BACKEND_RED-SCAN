import { Request, Response } from 'express';
import db from '../config/db';

import { AuthRequest } from '../middlewares/authMiddleware';

import {
  catatAktivitas,
  ambilInfoAktivitas,
} from '../utils/activityLogger';

// ==========================================
// FUNGSI PEMBANTU: MENENTUKAN STATUS STOK
// ==========================================
const tentukanStatusStok = (
  jumlah: number,
  minimum: number
): 'Cukup' | 'Menipis' | 'Habis' => {
  if (jumlah <= 0) {
    return 'Habis';
  }

  if (jumlah <= minimum) {
    return 'Menipis';
  }

  return 'Cukup';
};

// ==========================================
// FUNGSI PEMBANTU: MEMBUAT NOTIFIKASI STOK
// ==========================================
const buatNotifikasiStok = async (
  connection: any,
  bahanId: number,
  namaBahan: string,
  jumlahStok: number,
  satuan: string,
  status: 'Cukup' | 'Menipis' | 'Habis'
) => {
  if (status === 'Cukup') {
    return;
  }

  const judul =
    status === 'Habis' ? 'Stok Habis' : 'Stok Menipis';

  const tipe =
    status === 'Habis' ? 'stok_habis' : 'stok_menipis';

  const pesan =
    status === 'Habis'
      ? `Stok bahan ${namaBahan} telah habis. Segera lakukan pengisian stok.`
      : `Stok bahan ${namaBahan} tersisa ${jumlahStok} ${satuan}. Segera lakukan pengisian stok.`;

  await connection.query(
    `INSERT INTO notifikasi
      (judul, pesan, tipe, referensi_id)
     VALUES (?, ?, ?, ?)`,
    [judul, pesan, tipe, bahanId]
  );
};

// ==========================================
// FUNGSI PEMBANTU: NOTIFIKASI SAAT STATUS BERUBAH
// ==========================================
const cekPerubahanStatusStok = async (
  connection: any,
  bahanId: number,
  namaBahan: string,
  jumlahStok: number,
  satuan: string,
  statusSebelum: string,
  statusSesudah: 'Cukup' | 'Menipis' | 'Habis'
) => {
  if (statusSebelum === statusSesudah) {
    return;
  }

  await buatNotifikasiStok(
    connection,
    bahanId,
    namaBahan,
    jumlahStok,
    satuan,
    statusSesudah
  );
};

// ==========================================
// 1. MENGAMBIL SEMUA DATA STOK
// ==========================================
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
        status_stok,
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

// ==========================================
// 2. MENAMBAHKAN BAHAN BARU
// ==========================================
export const addStok = async (req: AuthRequest, res: Response) => {
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
    !nama_bahan?.trim() ||
    !['Minuman', 'Makanan', 'Bumbu', 'Lainnya'].includes(kategori) ||
    !satuan?.trim() ||
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

  const status = tentukanStatusStok(jumlah, minimum);

  let connection: any;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result]: any = await connection.query(
      `INSERT INTO stok_bahan
        (
          kode_bahan,
          nama_bahan,
          kategori,
          jumlah_stok,
          satuan,
          stok_minimum,
          status_stok
        )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        kode_bahan?.trim() || null,
        nama_bahan.trim(),
        kategori,
        jumlah,
        satuan.trim(),
        minimum,
        status,
      ]
    );

    if (jumlah > 0) {
      await connection.query(
        `INSERT INTO riwayat_stok
          (
            bahan_id,
            jenis_transaksi,
            jumlah,
            stok_sebelum,
            stok_sesudah,
            keterangan
          )
         VALUES (?, 'masuk', ?, 0, ?, ?)`,
        [
          result.insertId,
          jumlah,
          jumlah,
          'Stok awal bahan',
        ]
      );
    }

    await buatNotifikasiStok(
      connection,
      result.insertId,
      nama_bahan.trim(),
      jumlah,
      satuan.trim(),
      status
    );

    await connection.commit();

    // ACTIVITY LOGGING
    const info = ambilInfoAktivitas(req);

    await catatAktivitas({
      user_id: req.user?.id,
      user_email: req.user?.email,
      aktivitas: 'TAMBAH_STOK',
      deskripsi: `Admin menambahkan bahan ${nama_bahan.trim()} dengan stok awal ${jumlah} ${satuan.trim()}.`,
      modul: 'Stok',
      referensi_id: String(result.insertId),
      ...info,
    });

    return res.status(201).json({
      success: true,
      message: 'Bahan berhasil ditambahkan.',
      data: {
        id: result.insertId,
        nama_bahan: nama_bahan.trim(),
        jumlah_stok: jumlah,
        stok_minimum: minimum,
        status_stok: status,
      },
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

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
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ==========================================
// 3. MENGEDIT INFORMASI DAN JUMLAH STOK
// ==========================================
export const updateStok = async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  const {
    kode_bahan,
    nama_bahan,
    kategori,
    jumlah_stok,
    satuan,
    stok_minimum,
  } = req.body;

  const jumlah = Number(jumlah_stok);
  const minimum = Number(stok_minimum);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !nama_bahan?.trim() ||
    !['Minuman', 'Makanan', 'Bumbu', 'Lainnya'].includes(kategori) ||
    !satuan?.trim() ||
    !Number.isFinite(jumlah) ||
    !Number.isFinite(minimum) ||
    jumlah < 0 ||
    minimum < 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Informasi bahan atau jumlah stok tidak valid.',
    });
  }

  const status = tentukanStatusStok(jumlah, minimum);

  let connection: any;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      `SELECT
        jumlah_stok,
        status_stok
       FROM stok_bahan
       WHERE id = ?
       FOR UPDATE`,
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
    const statusSebelum = rows[0].status_stok;
    const selisih = jumlah - stokSebelum;

    await connection.query(
      `UPDATE stok_bahan
       SET kode_bahan = ?,
           nama_bahan = ?,
           kategori = ?,
           jumlah_stok = ?,
           satuan = ?,
           stok_minimum = ?,
           status_stok = ?
       WHERE id = ?`,
      [
        kode_bahan?.trim() || null,
        nama_bahan.trim(),
        kategori,
        jumlah,
        satuan.trim(),
        minimum,
        status,
        id,
      ]
    );

    if (selisih !== 0) {
      await connection.query(
        `INSERT INTO riwayat_stok
          (
            bahan_id,
            jenis_transaksi,
            jumlah,
            stok_sebelum,
            stok_sesudah,
            keterangan
          )
         VALUES (?, 'penyesuaian', ?, ?, ?, ?)`,
        [
          id,
          Math.abs(selisih),
          stokSebelum,
          jumlah,
          'Penyesuaian jumlah stok melalui Edit Stok Bahan',
        ]
      );
    }

    await cekPerubahanStatusStok(
      connection,
      id,
      nama_bahan.trim(),
      jumlah,
      satuan.trim(),
      statusSebelum,
      status
    );

    await connection.commit();

    // ACTIVITY LOGGING
    const info = ambilInfoAktivitas(req);

    await catatAktivitas({
      user_id: req.user?.id,
      user_email: req.user?.email,
      aktivitas: 'EDIT_STOK',
      deskripsi: `Admin mengubah informasi bahan ${nama_bahan.trim()} dan jumlah stok menjadi ${jumlah} ${satuan.trim()}.`,
      modul: 'Stok',
      referensi_id: String(id),
      ...info,
    });

    return res.status(200).json({
      success: true,
      message: 'Informasi bahan dan jumlah stok berhasil diperbarui.',
      data: {
        jumlah_stok: jumlah,
        stok_minimum: minimum,
        status_stok: status,
      },
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

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
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ==========================================
// 4. STOK MASUK DAN STOK KELUAR
// ==========================================
export const updateJumlahStok = async (
  req: AuthRequest,
  res: Response
) => {
  const id = Number(req.params.id);

  const {
    jenis_transaksi,
    jumlah,
    keterangan,
  } = req.body;

  const nilaiJumlah = Number(jumlah);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
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

    const [rows]: any = await connection.query(
      `SELECT
        nama_bahan,
        jumlah_stok,
        satuan,
        stok_minimum,
        status_stok
       FROM stok_bahan
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Bahan tidak ditemukan.',
      });
    }

    const namaBahan = rows[0].nama_bahan;
    const stokSebelum = Number(rows[0].jumlah_stok);
    const satuan = rows[0].satuan;
    const minimum = Number(rows[0].stok_minimum);
    const statusSebelum = rows[0].status_stok;

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

    const status = tentukanStatusStok(stokSesudah, minimum);

    await connection.query(
      `UPDATE stok_bahan
       SET jumlah_stok = ?,
           status_stok = ?
       WHERE id = ?`,
      [stokSesudah, status, id]
    );

    await connection.query(
      `INSERT INTO riwayat_stok
        (
          bahan_id,
          jenis_transaksi,
          jumlah,
          stok_sebelum,
          stok_sesudah,
          keterangan
        )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        jenis_transaksi,
        nilaiJumlah,
        stokSebelum,
        stokSesudah,
        keterangan?.trim() || null,
      ]
    );

    await cekPerubahanStatusStok(
      connection,
      id,
      namaBahan,
      stokSesudah,
      satuan,
      statusSebelum,
      status
    );

    await connection.commit();

    // ACTIVITY LOGGING
    const info = ambilInfoAktivitas(req);

    await catatAktivitas({
      user_id: req.user?.id,
      user_email: req.user?.email,
      aktivitas: jenis_transaksi === 'masuk' ? 'STOK_MASUK' : 'STOK_KELUAR',
      deskripsi: `Admin mencatat stok ${jenis_transaksi} sebanyak ${nilaiJumlah} ${satuan} untuk bahan ${namaBahan}. Stok berubah dari ${stokSebelum} menjadi ${stokSesudah}.`,
      modul: 'Stok',
      referensi_id: String(id),
      ...info,
    });

    return res.status(200).json({
      success: true,
      message: 'Stok dan status berhasil diperbarui.',
      data: {
        stok_sebelum: stokSebelum,
        stok_sesudah: stokSesudah,
        status_stok: status,
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

// ==========================================
// 5. MELIHAT RIWAYAT STOK
// ==========================================
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

// ==========================================
// 6. MENGHAPUS BAHAN
// ==========================================
export const deleteStok = async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID bahan tidak valid.',
    });
  }

  try {
    const [rows]: any = await db.query(
      `SELECT id, nama_bahan
       FROM stok_bahan
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bahan tidak ditemukan.',
      });
    }

    await db.query(
      'DELETE FROM stok_bahan WHERE id = ?',
      [id]
    );

    // ACTIVITY LOGGING
    const info = ambilInfoAktivitas(req);

    await catatAktivitas({
      user_id: req.user?.id,
      user_email: req.user?.email,
      aktivitas: 'HAPUS_STOK',
      deskripsi: `Admin menghapus bahan ${rows[0].nama_bahan}.`,
      modul: 'Stok',
      referensi_id: String(id),
      ...info,
    });

    return res.status(200).json({
      success: true,
      message: `Bahan ${rows[0].nama_bahan} berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error('Gagal menghapus bahan:', error);

    if (
      error.code === 'ER_ROW_IS_REFERENCED_2' ||
      error.code === 'ER_ROW_IS_REFERENCED'
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Bahan masih digunakan dalam resep atau riwayat stok sehingga tidak bisa dihapus. Hapus atau ubah hubungan datanya terlebih dahulu.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus bahan.',
    });
  }
};