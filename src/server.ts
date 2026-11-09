import 'dotenv/config';

import app from './app';
import db from './config/db';

import pemesananRoutes from './routes/pemesananRoutes';
import stokRoutes from './routes/stokRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import authRoutes from './routes/authRoutes';
import notifikasiRoutes from './routes/notifikasiRoutes';

// Daftar API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pemesanan', pemesananRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/notifikasi', notifikasiRoutes);

const PORT = Number(process.env.PORT || 5000);

const startServer = async (): Promise<void> => {
  let connection;

  try {
    // Periksa koneksi database
    connection = await db.getConnection();

    console.log('Database MySQL Laragon berhasil terhubung!');

    // Kembalikan koneksi ke connection pool
    connection.release();
    connection = undefined;

    // Jalankan server setelah database siap
    app.listen(PORT, () => {
      console.log(
        `REDScan API berjalan di http://localhost:${PORT}`
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

    console.error(
      'Gagal menjalankan server REDScan:',
      message
    );

    await db.end();
    process.exitCode = 1;
  }
};

void startServer();