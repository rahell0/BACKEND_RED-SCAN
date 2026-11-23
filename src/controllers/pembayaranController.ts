
import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import db from '../config/db';

const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const midtransBaseUrl = isProduction
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

const snapBaseUrl = isProduction
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com';

const cekKonfigurasiMidtrans = (): boolean => {
  return Boolean(
    serverKey &&
    clientKey &&
    serverKey.startsWith(
      isProduction ? 'Mid-server-' : 'SB-Mid-server-'
    ) &&
    clientKey.startsWith(
      isProduction ? 'Mid-client-' : 'SB-Mid-client-'
    )
  );
};

const authorizationHeader = () => {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
};

const ambilStatusMidtrans = async (orderId: string) => {
  const response = await fetch(
    `${midtransBaseUrl}/v2/${encodeURIComponent(orderId)}/status`,
    {
      method: 'GET',
      headers: {
        Authorization: authorizationHeader(),
        Accept: 'application/json',
      },
    }
  );

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(
      data.status_message ||
      data.error ||
      'Gagal mengambil status dari Midtrans.'
    );
  }

  return data;
};


const ubahStatusPembayaran = async (
  orderId: string,
  transactionId: string | null,
  transactionStatus: string,
  fraudStatus: string,
  grossAmount: number
) => {
  const [rows]: any = await db.query(
    `SELECT
      id,
      kode_transaksi,
      total_harga,
      status,
      status_pembayaran
    FROM pemesanan
    WHERE midtrans_order_id = ?
    LIMIT 1`,
    [orderId]
  );

  if (!rows || rows.length === 0) {
    throw new Error('Pesanan untuk transaksi Midtrans tidak ditemukan.');
  }

  const pesanan = rows[0];
  const totalPesanan = Math.round(Number(pesanan.total_harga));

  if (
    !Number.isFinite(grossAmount) ||
    Math.round(grossAmount) !== totalPesanan
  ) {
    throw new Error('Nominal pembayaran tidak sesuai.');
  }

  // Jika pembayaran sudah berhasil, pastikan status pesanan ikut diperbarui.
  if (pesanan.status_pembayaran === 'berhasil') {
    await db.query(
      `UPDATE pemesanan
       SET status = CASE
         WHEN status IN ('menunggu', 'menunggu pembayaran')
           THEN 'diproses'
         ELSE status
       END
       WHERE id = ?`,
      [pesanan.id]
    );

    return 'berhasil';
  }

  let statusPembayaran = 'pending';

  if (transactionStatus === 'settlement') {
    statusPembayaran =
      fraudStatus && fraudStatus !== 'accept'
        ? 'gagal'
        : 'berhasil';
  } else if (
    transactionStatus === 'deny' ||
    transactionStatus === 'cancel'
  ) {
    statusPembayaran = 'gagal';
  } else if (transactionStatus === 'expire') {
    statusPembayaran = 'kedaluwarsa';
  } else if (transactionStatus === 'pending') {
    statusPembayaran = 'pending';
  }

  await db.query(
    `UPDATE pemesanan
     SET
       status_pembayaran = ?,
       midtrans_transaction_id = ?,
       status = CASE
         WHEN ? = 'berhasil'
           AND status IN ('menunggu', 'menunggu pembayaran')
           THEN 'diproses'
         ELSE status
       END,
       paid_at = CASE
         WHEN ? = 'berhasil'
           THEN COALESCE(paid_at, NOW())
         ELSE paid_at
       END
     WHERE id = ?`,
    [
      statusPembayaran,
      transactionId,
      statusPembayaran,
      statusPembayaran,
      pesanan.id,
    ]
  );

  console.log(
    `Pembayaran ${pesanan.kode_transaksi}: ${statusPembayaran}`
  );

  return statusPembayaran;
};


// ==========================================
// 1. MEMBUAT TRANSAKSI SNAP CHECKOUT
// ==========================================

export const buatPembayaranMidtrans = async (
  req: Request,
  res: Response
) => {
  const kodeTransaksi = String(
    req.params.kode_transaksi || ''
  ).trim();

  try {
    if (!cekKonfigurasiMidtrans()) {
      return res.status(500).json({
        success: false,
        message: 'Konfigurasi Midtrans tidak valid.',
      });
    }

    if (!kodeTransaksi) {
      return res.status(400).json({
        success: false,
        message: 'Kode transaksi wajib diisi.',
      });
    }

    const [rows]: any = await db.query(
      `SELECT
        id,
        kode_transaksi,
        nama_pelanggan,
        nomor_hp,
        total_harga,
        metode_pembayaran,
        status_pembayaran,
        midtrans_order_id,
        midtrans_token,
        midtrans_redirect_url
      FROM pemesanan
      WHERE kode_transaksi = ?
      LIMIT 1`,
      [kodeTransaksi]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    const pesanan = rows[0];

    if (pesanan.metode_pembayaran !== 'QRIS Dinamis') {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini bukan menggunakan pembayaran QRIS.',
      });
    }

    if (pesanan.status_pembayaran === 'berhasil') {
      await db.query(
        `UPDATE pemesanan
         SET status = CASE
           WHEN status IN ('menunggu', 'menunggu pembayaran')
             THEN 'diproses'
           ELSE status
         END
         WHERE id = ?`,
        [pesanan.id]
      );

      return res.status(200).json({
        success: true,
        message: 'Pembayaran sudah berhasil.',
        data: {
          kode_transaksi: kodeTransaksi,
          status_pembayaran: 'berhasil',
        },
      });
    }

    // Gunakan halaman Snap lama jika transaksi masih pending.
    if (
      pesanan.status_pembayaran === 'pending' &&
      pesanan.midtrans_order_id &&
      pesanan.midtrans_redirect_url
    ) {
      try {
        const statusMidtrans = await ambilStatusMidtrans(
          pesanan.midtrans_order_id
        );

        const statusTerbaru = await ubahStatusPembayaran(
          pesanan.midtrans_order_id,
          statusMidtrans.transaction_id
            ? String(statusMidtrans.transaction_id)
            : null,
          String(statusMidtrans.transaction_status || '').toLowerCase(),
          String(statusMidtrans.fraud_status || '').toLowerCase(),
          Number(statusMidtrans.gross_amount)
        );

        if (statusTerbaru === 'berhasil') {
          return res.status(200).json({
            success: true,
            message: 'Pembayaran sudah berhasil.',
            data: {
              kode_transaksi: kodeTransaksi,
              status_pembayaran: 'berhasil',
            },
          });
        }

        if (statusTerbaru === 'pending') {
          return res.status(200).json({
            success: true,
            message: 'Halaman pembayaran masih tersedia.',
            data: {
              kode_transaksi: kodeTransaksi,
              snap_token: pesanan.midtrans_token,
              redirect_url: pesanan.midtrans_redirect_url,
              status_pembayaran: 'pending',
            },
          });
        }
      } catch (error: any) {
        console.log(
          'Pemeriksaan transaksi Snap lama:',
          error.message || error
        );

        return res.status(200).json({
          success: true,
          message: 'Halaman pembayaran tersedia.',
          data: {
            kode_transaksi: kodeTransaksi,
            snap_token: pesanan.midtrans_token,
            redirect_url: pesanan.midtrans_redirect_url,
            status_pembayaran: 'pending',
          },
        });
      }
    }

    const totalHarga = Math.round(Number(pesanan.total_harga));

    if (!Number.isFinite(totalHarga) || totalHarga <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total pembayaran tidak valid.',
      });
    }

    const midtransOrderId = `${kodeTransaksi}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: totalHarga,
      },
      customer_details: {
        first_name: pesanan.nama_pelanggan || 'Pelanggan REDScan',
        phone: pesanan.nomor_hp || '',
      },
    };

    const response = await fetch(
      `${snapBaseUrl}/snap/v1/transactions`,
      {
        method: 'POST',
        headers: {
          Authorization: authorizationHeader(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(parameter),
      }
    );

    const transaksi: any = await response.json();

    if (!response.ok) {
      console.error('HTTP Status Midtrans Snap:', response.status);
      console.error('Respons Midtrans Snap:', transaksi);

      throw new Error(
        transaksi.error_messages?.join(', ') ||
        transaksi.status_message ||
        transaksi.error ||
        'Midtrans gagal membuat transaksi Snap.'
      );
    }

    if (!transaksi.token || !transaksi.redirect_url) {
      throw new Error(
        'Token atau URL pembayaran Snap tidak ditemukan.'
      );
    }

    await db.query(
      `UPDATE pemesanan
       SET
         status_pembayaran = 'pending',
         midtrans_order_id = ?,
         midtrans_transaction_id = NULL,
         midtrans_token = ?,
         midtrans_redirect_url = ?,
         midtrans_qr_url = NULL,
         paid_at = NULL
       WHERE id = ?`,
      [
        midtransOrderId,
        transaksi.token,
        transaksi.redirect_url,
        pesanan.id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Halaman pembayaran Midtrans berhasil dibuat.',
      data: {
        kode_transaksi: kodeTransaksi,
        midtrans_order_id: midtransOrderId,
        snap_token: transaksi.token,
        redirect_url: transaksi.redirect_url,
        status_pembayaran: 'pending',
      },
    });
  } catch (error: any) {
    const pesanError =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      'Gagal membuat pembayaran Snap:',
      pesanError
    );

    return res.status(500).json({
      success: false,
      message: pesanError,
      error: pesanError,
    });
  }
};


// ==========================================
// 2. MENGAMBIL STATUS PEMBAYARAN
// ==========================================


export const getStatusPembayaran = async (
  req: Request,
  res: Response
) => {
  const kodeTransaksi = String(
    req.params.kode_transaksi || ''
  ).trim();

  try {
    if (!kodeTransaksi) {
      return res.status(400).json({
        success: false,
        message: 'Kode transaksi wajib diisi.',
      });
    }

    const [rows]: any = await db.query(
      `SELECT
        kode_transaksi,
        status,
        status_pembayaran,
        paid_at,
        midtrans_order_id
      FROM pemesanan
      WHERE kode_transaksi = ?
      LIMIT 1`,
      [kodeTransaksi]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    const pesanan = rows[0];
    let statusPembayaran =
      pesanan.status_pembayaran || 'belum_bayar';

    if (
      statusPembayaran === 'pending' &&
      pesanan.midtrans_order_id &&
      cekKonfigurasiMidtrans()
    ) {
      try {
        const transaksi = await ambilStatusMidtrans(
          pesanan.midtrans_order_id
        );

        statusPembayaran = await ubahStatusPembayaran(
          pesanan.midtrans_order_id,
          transaksi.transaction_id
            ? String(transaksi.transaction_id)
            : null,
          String(transaksi.transaction_status || '').toLowerCase(),
          String(transaksi.fraud_status || '').toLowerCase(),
          Number(transaksi.gross_amount)
        );
      } catch (error: any) {
        console.error(
          'Gagal sinkronisasi status Midtrans:',
          error.message || error
        );
      }
    }

    // Sinkronkan status pesanan jika pembayaran sudah berhasil.
    if (statusPembayaran === 'berhasil') {
      await db.query(
        `UPDATE pemesanan
         SET status = CASE
           WHEN status IN ('menunggu', 'menunggu pembayaran')
             THEN 'diproses'
           ELSE status
         END
         WHERE kode_transaksi = ?`,
        [kodeTransaksi]
      );
    }

    const [updatedRows]: any = await db.query(
      `SELECT status, status_pembayaran, paid_at
       FROM pemesanan
       WHERE kode_transaksi = ?
       LIMIT 1`,
      [kodeTransaksi]
    );

    const dataTerbaru = updatedRows[0];

    return res.status(200).json({
      success: true,
      data: {
        kode_transaksi: kodeTransaksi,
        status: dataTerbaru.status,
        status_pembayaran:
          dataTerbaru.status_pembayaran || statusPembayaran,
        paid_at: dataTerbaru.paid_at,
      },
    });
  } catch (error: any) {
    console.error(
      'Gagal mengambil status pembayaran:',
      error.message || error
    );

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil status pembayaran.',
    });
  }
};


// ==========================================
// 3. WEBHOOK / NOTIFIKASI MIDTRANS
// ==========================================

export const notifikasiMidtrans = async (
  req: Request,
  res: Response
) => {
  try {
    if (!cekKonfigurasiMidtrans()) {
      return res.status(500).json({
        success: false,
        message: 'Konfigurasi Midtrans tidak valid.',
      });
    }

    const orderId = String(req.body.order_id || '');
    const statusCode = String(req.body.status_code || '');
    const grossAmount = String(req.body.gross_amount || '');
    const signatureKey = String(req.body.signature_key || '');

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return res.status(400).json({
        success: false,
        message: 'Data notifikasi Midtrans tidak lengkap.',
      });
    }

    const signatureSeharusnya = createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex');

    const signatureBuffer = Buffer.from(signatureKey);
    const expectedBuffer = Buffer.from(signatureSeharusnya);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Signature notifikasi Midtrans tidak valid.',
      });
    }

    const transactionId = req.body.transaction_id
      ? String(req.body.transaction_id)
      : null;

    const transactionStatus = String(
      req.body.transaction_status || ''
    ).toLowerCase();

    const fraudStatus = String(
      req.body.fraud_status || ''
    ).toLowerCase();

    await ubahStatusPembayaran(
      orderId,
      transactionId,
      transactionStatus,
      fraudStatus,
      Number(grossAmount)
    );

    return res.status(200).json({
      success: true,
      message: 'Notifikasi pembayaran berhasil diproses.',
    });
  } catch (error: any) {
    console.error(
      'Gagal memproses notifikasi Midtrans:',
      error.message || error
    );

    return res.status(500).json({
      success: false,
      message: 'Gagal memproses notifikasi Midtrans.',
    });
  }
};
