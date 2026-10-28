import express from 'express';
import cors from 'cors';
import db from './config/db';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import pemesananRoutes from './routes/pemesananRoutes';
import stokRoutes from './routes/stokRoutes';
import omzetRoutes from './routes/omzetRoutes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pemesanan', pemesananRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/omzet', omzetRoutes);

const PORT = 5000;

// Cek koneksi ke Database Laragon
db.getConnection()
  .then(() => {
    console.log('⚡ Database MySQL Laragon Berhasil Terhubung!');
    app.listen(PORT, () => {
      console.log(`🚀 Server TS running di http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Gagal koneksi ke Database Laragon:', err.message);
  });