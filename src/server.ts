
import 'dotenv/config';

import app from './app';
import db from './config/db';

const PORT = Number(process.env.PORT || 5000);

const startServer = async (): Promise<void> => {
  let connection;

  try {
    // =====================================
    // 1. PERIKSA KONEKSI DATABASE
    // =====================================

    connection = await db.getConnection();

    console.log('Database MySQL Laragon berhasil terhubung!');

    connection.release();
    connection = undefined;

    // =====================================
    // 2. PERIKSA KONFIGURASI MIDTRANS
    // =====================================

    const serverKey = (
      process.env.MIDTRANS_SERVER_KEY || ''
    ).trim();

    const clientKey = (
      process.env.MIDTRANS_CLIENT_KEY || ''
    ).trim();

    const production = (
      process.env.MIDTRANS_IS_PRODUCTION || ''
    ).trim().toLowerCase();

    console.log('');
    console.log('========== PEMERIKSAAN MIDTRANS ==========');

    console.log(
      'Server Key terbaca:',
      Boolean(serverKey)
    );

    console.log(
      'Client Key terbaca:',
      Boolean(clientKey)
    );

    console.log(
      'Awalan Server Key benar:',
      serverKey.startsWith('SB-Mid-server-')
    );

    console.log(
      'Awalan Client Key benar:',
      clientKey.startsWith('SB-Mid-client-')
    );

    console.log(
      'Panjang Server Key:',
      serverKey.length
    );

    console.log(
      'Panjang Client Key:',
      clientKey.length
    );

    console.log(
      'Mode Production:',
      production
    );

    console.log(
      'Mode Sandbox aktif:',
      production === 'false'
    );

    console.log(
      'Server Key mengandung spasi:',
      /\s/.test(serverKey)
    );

    console.log(
      'Client Key mengandung spasi:',
      /\s/.test(clientKey)
    );

    console.log('==========================================');
    console.log('');

    // =====================================
    // 3. PERIKSA KONFIGURASI DASAR
    // =====================================

    if (!serverKey || !clientKey) {
      throw new Error(
        'Server Key atau Client Key Midtrans belum terbaca. Periksa file .env.'
      );
    }

    if (production !== 'false') {
      throw new Error(
        'REDScan harus menggunakan MIDTRANS_IS_PRODUCTION=false untuk Sandbox.'
      );
    }

    if (!serverKey.startsWith('SB-Mid-server-')) {
      throw new Error(
        'Server Key bukan format Sandbox.'
      );
    }

    if (!clientKey.startsWith('SB-Mid-client-')) {
      throw new Error(
        'Client Key bukan format Sandbox.'
      );
    }

    // =====================================
    // 4. JALANKAN SERVER
    // =====================================

    app.listen(PORT, () => {
      console.log(
        `REDScan API berjalan di http://localhost:${PORT}`
      );

      console.log(
        'Konfigurasi dasar Midtrans Sandbox berhasil diperiksa.'
      );
    });

  } catch (error) {
    if (connection) {
      connection.release();
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error('');
    console.error('GAGAL MENJALANKAN REDSCAN:', message);

    await db.end();

    process.exitCode = 1;
  }
};

void startServer();
