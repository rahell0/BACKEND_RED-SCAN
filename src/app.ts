import express from 'express';
import cors from 'cors';


import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import pemesananRoutes from './routes/pemesananRoutes';
import stokRoutes from './routes/stokRoutes';
import omzetRoutes from './routes/omzetRoutes';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { notFoundMiddleware } from './middlewares/notFoundMiddleware';

const app = express();

// Middleware global
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pemesanan', pemesananRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/omzet', omzetRoutes);


// Endpoint pemeriksaan API
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'REDScan API berjalan'
  });
});

// Menangani endpoint yang tidak ditemukan
app.use(notFoundMiddleware);

// Menangani error aplikasi
app.use(errorMiddleware);

export default app;