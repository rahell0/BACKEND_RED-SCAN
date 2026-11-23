import { Request, Response } from 'express';
import db from '../config/db';

import { AuthRequest } from '../middlewares/authMiddleware';

import {
  catatAktivitas,
  ambilInfoAktivitas,
} from '../utils/activityLogger';

// ==========================================
// HELPER: FORMAT DETAIL PRODUK
// ==========================================
const formatDetail = (detailRows: any[], pemesananId: number) => {
  return detailRows
    .filter(
      (detail: any) =>
        Number(detail.pemesanan_id) === Number(pemesananId)
    )
    .map((detail: any) => ({
      id: detail.id,
      menu_id: detail.menu_id,
      nama_menu: detail.nama_menu,
      harga: Number(detail.harga),
      jumlah: Number(detail.jumlah),
      subtotal: Number(detail.subtotal),
    }));
};

// ==========================================
// HELPER: AMBIL DETAIL SEMUA PESANAN
// ==========================================
const ambilDetailPesanan = async (orderRows: any[]) => {
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((order: any) => order.id);

  const [detailRows]: any = await db.query(
    `SELECT
      id,
      pemesanan_id,
      menu_id,
      nama_menu,
      harga,
      jumlah,
      subtotal
     FROM detail_pemesanan
     WHERE pemesanan_id IN (?)
     ORDER BY id ASC`,
    [orderIds]
  );

  return orderRows.map((order: any) => ({
    ...order,
    total_harga: Number(order.total_harga),
    detail: formatDetail(detailRows, order.id),
  }));
};

// ==========================================
// HELPER: MENENTUKAN STATUS STOK
// ==========================================
const tentukanStatusStokPesanan = (
  jumlah: number,
  minimum: number
): string => {
  if (jumlah <= 0) return 'Habis';
  if (jumlah <= minimum) return 'Menipis';
  return 'Cukup';
};

// ==========================================
// HELPER: MEMBUAT NOTIFIKASI
// ==========================================
const buatNotifikasi = async (
  connection: any,
  judul: string,
  pesan: string,
  tipe: string,
  referensiId: number
) => {
  await connection.query(
    `INSERT INTO notifikasi
     (judul, pesan, tipe, referensi_id)
     VALUES (?, ?, ?, ?)`,
    [judul, pesan, tipe, referensiId]
  );
};

// ==========================================
// 1. MENGAMBIL SEMUA PEMESANAN UNTUK ADMIN
// ==========================================
export const getPemesanan = async (
  req: Request,
  res: Response
) => {
  try {
    const [orderRows]: any = await db.query(
      'SELECT * FROM pemesanan ORDER BY id DESC'
    );

    const formattedOrders = await ambilDetailPesanan(orderRows);

    return res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  } catch (error: any) {
    console.error('Gagal mengambil data pemesanan:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// 2. MENGAMBIL RIWAYAT BERDASARKAN NOMOR HP
// ==========================================
export const getRiwayatPemesanan = async (
  req: Request,
  res: Response
) => {
  try {
    const nomorHp = String(req.params.nomor_hp || '').replace(/\D/g, '');

    if (!/^[0-9]{10,15}$/.test(nomorHp)) {
      return res.status(400).json({
        success: false,
        message: 'Nomor HP harus terdiri dari 10 sampai 15 digit.',
      });
    }

    const [orderRows]: any = await db.query(
      `SELECT *
       FROM pemesanan
       WHERE nomor_hp = ?
       ORDER BY id DESC`,
      [nomorHp]
    );

    const formattedOrders = await ambilDetailPesanan(orderRows);

    return res.status(200).json({
      success: true,
      message: orderRows.length > 0
        ? 'Riwayat pesanan berhasil ditemukan.'
        : 'Belum ada pesanan untuk nomor HP ini.',
      data: formattedOrders,
    });
  } catch (error: any) {
    console.error('Gagal mengambil riwayat pesanan:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat pesanan.',
    });
  }
};

// ==========================================
// 3. MENAMBAHKAN TRANSAKSI DARI MOBILE
// ==========================================
export const addPemesanan = async (
  req: Request,
  res: Response
) => {
  const {
    nama_pelanggan,
    nomor_hp,
    metode_pembayaran,
    items,
  } = req.body;

  if (
    !nama_pelanggan ||
    typeof nama_pelanggan !== 'string' ||
    !nama_pelanggan.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'Nama pelanggan wajib diisi.',
    });
  }

  const nomorHp = String(nomor_hp || '').replace(/\D/g, '');

  if (!/^[0-9]{10,15}$/.test(nomorHp)) {
    return res.status(400).json({
      success: false,
      message: 'Nomor HP wajib diisi dengan 10 sampai 15 digit.',
    });
  }

  const metode = String(metode_pembayaran || '').trim();

  const metodeValid = ['Tunai (Cash)', 'QRIS Dinamis'];

  if (!metodeValid.includes(metode)) {
    return res.status(400).json({
      success: false,
      message: 'Metode pembayaran tidak valid.',
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Keranjang produk masih kosong.',
    });
  }

  let connection: any;

  try {
    connection = await db.getConnection();

    await connection.beginTransaction();

    let subtotal = 0;
    const detailProduk: any[] = [];

    // Ambil harga dan nama produk dari database
    for (const item of items) {
      const menuId = Number(item.menu_id);
      const jumlah = Number(item.jumlah);

      if (
        !Number.isInteger(menuId) ||
        menuId <= 0 ||
        !Number.isInteger(jumlah) ||
        jumlah <= 0
      ) {
        throw new Error('Data produk atau jumlah tidak valid.');
      }

      const [menuRows]: any = await connection.query(
        `SELECT id, nama_menu, harga
         FROM menu
         WHERE id = ?
         LIMIT 1`,
        [menuId]
      );

      if (menuRows.length === 0) {
        throw new Error(`Menu dengan ID ${menuId} tidak ditemukan.`);
      }

      const menu = menuRows[0];

      const harga = Number(menu.harga);
      const totalProduk = harga * jumlah;

      if (!Number.isFinite(harga) || harga < 0) {
        throw new Error(`Harga menu ${menu.nama_menu} tidak valid.`);
      }

      subtotal += totalProduk;

      detailProduk.push({
        menu_id: menu.id,
        nama_menu: menu.nama_menu,
        harga,
        jumlah,
        subtotal: totalProduk,
      });
    }

    // Pajak restoran 10%
    const pajak = Math.round(subtotal * 0.10);
    const totalHarga = subtotal + pajak;

    const kodeTransaksi = `TRX-${Date.now()}`;
    const statusAwal = 'menunggu';

    // Simpan transaksi utama
    const [result]: any = await connection.query(
      `INSERT INTO pemesanan
       (
         kode_transaksi,
         nama_pelanggan,
         nomor_hp,
         total_harga,
         metode_pembayaran,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        kodeTransaksi,
        nama_pelanggan.trim(),
        nomorHp,
        totalHarga,
        metode,
        statusAwal,
      ]
    );

    const pemesananId = result.insertId;

    // Simpan detail produk
    for (const produk of detailProduk) {
      await connection.query(
        `INSERT INTO detail_pemesanan
         (
           pemesanan_id,
           menu_id,
           nama_menu,
           harga,
           jumlah,
           subtotal
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          pemesananId,
          produk.menu_id,
          produk.nama_menu,
          produk.harga,
          produk.jumlah,
          produk.subtotal,
        ]
      );
    }

    // Notifikasi pesanan baru
    const pesanNotifikasi =
      `Pesanan baru dari ${nama_pelanggan.trim()} ` +
      `dengan kode ${kodeTransaksi}. ` +
      `Total pembayaran Rp${totalHarga.toLocaleString('id-ID')}.`;

    await buatNotifikasi(
      connection,
      'Pesanan Baru',
      pesanNotifikasi,
      'pesanan_baru',
      pemesananId
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil disimpan.',
      data: {
        id: pemesananId,
        kode_transaksi: kodeTransaksi,
        nama_pelanggan: nama_pelanggan.trim(),
        nomor_hp: nomorHp,
        subtotal,
        pajak,
        total_harga: totalHarga,
        metode_pembayaran: metode,
        status: statusAwal,
        detail: detailProduk,
      },
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Gagal menyimpan pesanan:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Gagal menyimpan pesanan.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ==========================================
// 4. MENGUBAH STATUS PESANAN DARI ADMIN
// ALUR: MENUNGGU -> DIPROSES -> SELESAI
// ==========================================
export const updateStatusPemesanan = async (
  req: AuthRequest,
  res: Response
) => {
  const id = Number(req.params.id);
  const statusBaru = String(req.body.status || '').toLowerCase();

  const statusTujuanValid = [
    'diproses',
    'selesai',
    'dibatalkan',
  ];

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID pesanan tidak valid.',
    });
  }

  if (!statusTujuanValid.includes(statusBaru)) {
    return res.status(400).json({
      success: false,
      message: 'Status tujuan tidak valid.',
    });
  }

  let connection: any;
  let jumlahBahanDikembalikan = 0;

  try {
    connection = await db.getConnection();

    await connection.beginTransaction();

    // 1. AMBIL DAN KUNCI PESANAN
    const [pesananRows]: any = await connection.query(
      `SELECT
         id,
         kode_transaksi,
         nama_pelanggan,
         metode_pembayaran,
         status
       FROM pemesanan
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (pesananRows.length === 0) {
      throw Object.assign(
        new Error('Pesanan tidak ditemukan.'),
        { statusCode: 404 }
      );
    }

    const pesanan = pesananRows[0];
    const statusLama = String(pesanan.status).toLowerCase();

    // 2. CEGAH UPDATE STATUS BERULANG
    if (statusLama === statusBaru) {
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: `Pesanan yang sudah ${statusBaru} tidak dapat diproses kembali.`,
      });
    }

    // 3. DEFINISI STATUS MENUNGGU
    const statusMenunggu = [
      'menunggu',
      'menunggu pembayaran',
      'pending',
      'antre',
    ];

    // ==========================================
    // 4. PROSES PESANAN MENJADI DIPROSES
    // ==========================================
    if (statusBaru === 'diproses') {
      if (!statusMenunggu.includes(statusLama)) {
        throw Object.assign(
          new Error(
            'Pesanan hanya dapat diproses jika masih menunggu pembayaran.'
          ),
          { statusCode: 400 }
        );
      }

      const [detailRows]: any = await connection.query(
        `SELECT menu_id, jumlah
         FROM detail_pemesanan
         WHERE pemesanan_id = ?`,
        [id]
      );

      if (detailRows.length === 0) {
        throw Object.assign(
          new Error('Detail pesanan tidak ditemukan.'),
          { statusCode: 400 }
        );
      }

      // Periksa ketersediaan resep
      const [resepCheck]: any = await connection.query(
        `SELECT
           dp.menu_id,
           COUNT(r.id) AS total_resep
         FROM detail_pemesanan dp
         LEFT JOIN detail_resep r
           ON dp.menu_id = r.menu_id
         WHERE dp.pemesanan_id = ?
         GROUP BY dp.menu_id`,
        [id]
      );

      const menuTanpaResep = resepCheck.filter(
        (item: any) => Number(item.total_resep) === 0
      );

      if (menuTanpaResep.length > 0) {
        const daftarMenu = menuTanpaResep
          .map((item: any) => `Menu ID ${item.menu_id}`)
          .join(', ');

        throw Object.assign(
          new Error(
            `Resep belum tersedia untuk ${daftarMenu}.`
          ),
          { statusCode: 400 }
        );
      }

      // Hitung kebutuhan seluruh bahan
      const [kebutuhanRows]: any = await connection.query(
        `SELECT
           r.bahan_id,
           SUM(r.jumlah_pemakaian * dp.jumlah) AS total_dibutuhkan
         FROM detail_pemesanan dp
         INNER JOIN detail_resep r
           ON dp.menu_id = r.menu_id
         WHERE dp.pemesanan_id = ?
         GROUP BY r.bahan_id
         ORDER BY r.bahan_id ASC`,
        [id]
      );

      if (kebutuhanRows.length === 0) {
        throw Object.assign(
          new Error('Resep bahan untuk pesanan belum tersedia.'),
          { statusCode: 400 }
        );
      }

      const bahanIds = kebutuhanRows.map(
        (item: any) => Number(item.bahan_id)
      );

      // Kunci seluruh stok
      const [bahanRows]: any = await connection.query(
        `SELECT
           id,
           nama_bahan,
           jumlah_stok,
           satuan,
           stok_minimum,
           status_stok
         FROM stok_bahan
         WHERE id IN (?)
         ORDER BY id ASC
         FOR UPDATE`,
        [bahanIds]
      );

      const bahanMap = new Map<number, any>();

      bahanRows.forEach((bahan: any) => {
        bahanMap.set(Number(bahan.id), bahan);
      });

      // Periksa semua stok sebelum pengurangan
      for (const kebutuhan of kebutuhanRows) {
        const bahanId = Number(kebutuhan.bahan_id);
        const bahan = bahanMap.get(bahanId);

        if (!bahan) {
          throw Object.assign(
            new Error(`Bahan ID ${bahanId} tidak ditemukan.`),
            { statusCode: 400 }
          );
        }

        const stokSaatIni = Number(bahan.jumlah_stok);

        const dibutuhkan = Number(
          Number(kebutuhan.total_dibutuhkan).toFixed(2)
        );

        if (!Number.isFinite(dibutuhkan) || dibutuhkan <= 0) {
          throw Object.assign(
            new Error(
              `Jumlah kebutuhan ${bahan.nama_bahan} tidak valid.`
            ),
            { statusCode: 400 }
          );
        }

        if (stokSaatIni + 0.000001 < dibutuhkan) {
          throw Object.assign(
            new Error(
              `Stok ${bahan.nama_bahan} tidak mencukupi. ` +
              `Tersedia ${stokSaatIni} ${bahan.satuan}, ` +
              `dibutuhkan ${dibutuhkan} ${bahan.satuan}.`
            ),
            { statusCode: 400 }
          );
        }
      }

      // Kurangi stok dan simpan riwayat
      for (const kebutuhan of kebutuhanRows) {
        const bahanId = Number(kebutuhan.bahan_id);
        const bahan = bahanMap.get(bahanId);

        const stokSebelum = Number(bahan.jumlah_stok);

        const jumlahKeluar = Number(
          Number(kebutuhan.total_dibutuhkan).toFixed(2)
        );

        const stokSesudah = Number(
          Math.max(0, stokSebelum - jumlahKeluar).toFixed(2)
        );

        const statusSebelum = bahan.status_stok;

        const statusSesudah = tentukanStatusStokPesanan(
          stokSesudah,
          Number(bahan.stok_minimum)
        );

        await connection.query(
          `UPDATE stok_bahan
           SET jumlah_stok = ?,
               status_stok = ?
           WHERE id = ?`,
          [stokSesudah, statusSesudah, bahanId]
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
           VALUES (?, 'keluar', ?, ?, ?, ?)`,
          [
            bahanId,
            jumlahKeluar,
            stokSebelum,
            stokSesudah,
            `Pengurangan otomatis untuk pesanan ${pesanan.kode_transaksi}`,
          ]
        );

        // Notifikasi perubahan stok
        if (statusSebelum !== statusSesudah) {
          if (statusSesudah === 'Habis') {
            await buatNotifikasi(
              connection,
              'Stok Habis',
              `Stok ${bahan.nama_bahan} habis setelah pesanan ${pesanan.kode_transaksi} diproses.`,
              'stok_habis',
              bahanId
            );
          } else if (statusSesudah === 'Menipis') {
            await buatNotifikasi(
              connection,
              'Stok Menipis',
              `Stok ${bahan.nama_bahan} tersisa ${stokSesudah} ${bahan.satuan}.`,
              'stok_menipis',
              bahanId
            );
          }
        }
      }
    }

    // ==========================================
    // 5. PROSES PESANAN MENJADI SELESAI
    // ==========================================
    if (statusBaru === 'selesai') {
      if (statusLama !== 'diproses') {
        throw Object.assign(
          new Error(
            'Pesanan harus berstatus diproses sebelum dapat diselesaikan.'
          ),
          { statusCode: 400 }
        );
      }
    }

    // ==========================================
    // 6. PROSES PEMBATALAN PESANAN
    // ==========================================
    if (statusBaru === 'dibatalkan') {
      if (
        !statusMenunggu.includes(statusLama) &&
        statusLama !== 'diproses'
      ) {
        throw Object.assign(
          new Error(
            'Pesanan yang sudah selesai atau dibatalkan tidak dapat dibatalkan.'
          ),
          { statusCode: 400 }
        );
      }

      // Cari catatan pengurangan stok asli.
      // Pengembalian memakai riwayat transaksi,
      // bukan menghitung ulang resep terbaru.
      const keteranganKeluar =
        `Pengurangan otomatis untuk pesanan ${pesanan.kode_transaksi}`;

      const [riwayatKeluar]: any = await connection.query(
        `SELECT
           id,
           bahan_id,
           jumlah
         FROM riwayat_stok
         WHERE jenis_transaksi = 'keluar'
           AND BINARY keterangan = BINARY ?
         ORDER BY bahan_id ASC, id ASC
         FOR UPDATE`,
        [keteranganKeluar]
      );

      // Pesanan diproses wajib mempunyai catatan
      // pengurangan stok.
      if (
        statusLama === 'diproses' &&
        riwayatKeluar.length === 0
      ) {
        throw Object.assign(
          new Error(
            'Riwayat pengurangan stok pesanan tidak ditemukan. Pembatalan dibatalkan demi keamanan stok.'
          ),
          { statusCode: 400 }
        );
      }

      if (riwayatKeluar.length > 0) {
        // Kumpulkan seluruh bahan yang harus dikembalikan
        const bahanPengembalian = new Map<number, number>();

        for (const riwayat of riwayatKeluar) {
          const bahanId = Number(riwayat.bahan_id);
          const jumlah = Number(riwayat.jumlah);

          if (
            !Number.isFinite(jumlah) ||
            jumlah <= 0
          ) {
            throw Object.assign(
              new Error(
                `Riwayat pengurangan bahan ID ${bahanId} tidak valid.`
              ),
              { statusCode: 400 }
            );
          }

          const jumlahSebelumnya =
            bahanPengembalian.get(bahanId) || 0;

          bahanPengembalian.set(
            bahanId,
            jumlahSebelumnya + jumlah
          );
        }

        const bahanIdsKembali = Array.from(
          bahanPengembalian.keys()
        );

        // Kunci stok sebelum mengembalikan
        const [bahanRows]: any = await connection.query(
          `SELECT
             id,
             nama_bahan,
             jumlah_stok,
             satuan,
             stok_minimum,
             status_stok
           FROM stok_bahan
           WHERE id IN (?)
           ORDER BY id ASC
           FOR UPDATE`,
          [bahanIdsKembali]
        );

        const bahanMap = new Map<number, any>();

        bahanRows.forEach((bahan: any) => {
          bahanMap.set(Number(bahan.id), bahan);
        });

        // Pastikan seluruh bahan masih tersedia
        for (const [bahanId, jumlahKembali] of bahanPengembalian) {
          const bahan = bahanMap.get(bahanId);

          if (!bahan) {
            throw Object.assign(
              new Error(
                `Bahan ID ${bahanId} tidak ditemukan. Pengembalian stok dibatalkan.`
              ),
              { statusCode: 400 }
            );
          }

          if (
            !Number.isFinite(Number(bahan.jumlah_stok)) ||
            !Number.isFinite(jumlahKembali)
          ) {
            throw Object.assign(
              new Error(
                `Data stok ${bahan.nama_bahan} tidak valid.`
              ),
              { statusCode: 400 }
            );
          }
        }

        // Kembalikan stok berdasarkan catatan asli
        for (const [bahanId, jumlahKembali] of bahanPengembalian) {
          const bahan = bahanMap.get(bahanId);

          const stokSebelum = Number(bahan.jumlah_stok);

          const stokSesudah = Number(
            (stokSebelum + jumlahKembali).toFixed(2)
          );

          const statusSesudah = tentukanStatusStokPesanan(
            stokSesudah,
            Number(bahan.stok_minimum)
          );

          await connection.query(
            `UPDATE stok_bahan
             SET jumlah_stok = ?,
                 status_stok = ?
             WHERE id = ?`,
            [
              stokSesudah,
              statusSesudah,
              bahanId,
            ]
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
             VALUES (?, 'masuk', ?, ?, ?, ?)`,
            [
              bahanId,
              jumlahKembali,
              stokSebelum,
              stokSesudah,
              `Pengembalian otomatis untuk pembatalan pesanan ${pesanan.kode_transaksi}`,
            ]
          );

          jumlahBahanDikembalikan++;
        }
      }
    }

    // ==========================================
    // 7. UPDATE STATUS PESANAN
    // ==========================================
    await connection.query(
      `UPDATE pemesanan
       SET status = ?
       WHERE id = ?`,
      [statusBaru, id]
    );

    // ==========================================
    // 8. NOTIFIKASI PERUBAHAN STATUS
    // ==========================================
    if (statusBaru === 'diproses') {
      await buatNotifikasi(
        connection,
        'Pesanan Diproses',
        `Pesanan ${pesanan.kode_transaksi} milik ${pesanan.nama_pelanggan} telah dikonfirmasi dan mulai diproses.`,
        'pesanan_diproses',
        id
      );
    }

    if (statusBaru === 'selesai') {
      await buatNotifikasi(
        connection,
        'Pesanan Selesai',
        `Pesanan ${pesanan.kode_transaksi} milik ${pesanan.nama_pelanggan} telah selesai disiapkan.`,
        'pesanan_selesai',
        id
      );
    }

    if (statusBaru === 'dibatalkan') {
      await buatNotifikasi(
        connection,
        'Pesanan Dibatalkan',
        jumlahBahanDikembalikan > 0
          ? `Pesanan ${pesanan.kode_transaksi} dibatalkan. Stok ${jumlahBahanDikembalikan} bahan berhasil dikembalikan.`
          : `Pesanan ${pesanan.kode_transaksi} dibatalkan. Tidak ada stok yang perlu dikembalikan.`,
        'pesanan_dibatalkan',
        id
      );
    }

    // ==========================================
    // 9. SIMPAN SELURUH PERUBAHAN
    // ==========================================
    await connection.commit();

    // ACTIVITY LOGGING
    const info = ambilInfoAktivitas(req);

    await catatAktivitas({
      user_id: req.user?.id,
      user_email: req.user?.email,
      aktivitas: 'UBAH_STATUS_PESANAN',
      deskripsi: `Admin mengubah status pesanan ${pesanan.kode_transaksi} milik ${pesanan.nama_pelanggan} dari ${statusLama} menjadi ${statusBaru}.`,
      modul: 'Pemesanan',
      referensi_id: String(id),
      ...info,
    });

    let message = 'Status pesanan berhasil diperbarui.';

    if (statusBaru === 'diproses') {
      message =
        'Pesanan berhasil diproses. Stok bahan berhasil dikurangi.';
    }

    if (statusBaru === 'selesai') {
      message = 'Pesanan berhasil diselesaikan.';
    }

    if (statusBaru === 'dibatalkan') {
      message =
        jumlahBahanDikembalikan > 0
          ? `Pesanan berhasil dibatalkan. ${jumlahBahanDikembalikan} bahan berhasil dikembalikan ke stok.`
          : 'Pesanan berhasil dibatalkan. Tidak ada perubahan stok.';
    }

    return res.status(200).json({
      success: true,
      message,
      jumlahBahanDikembalikan,
    });

  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      'Gagal memperbarui status pesanan:',
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || 'Gagal memperbarui status pesanan.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};