
import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import pemesananRoutes from './routes/pemesananRoutes';
import pembayaranRoutes from './routes/pembayaranRoutes';
import stokRoutes from './routes/stokRoutes';
import omzetRoutes from './routes/omzetRoutes';
import notifikasiRoutes from './routes/notifikasiRoutes';
import menuRoutes from './routes/menuRoutes';
import aiRoutes from './routes/aiRoutes';
import logRoutes from './routes/logRoutes';

import { errorMiddleware } from './middlewares/errorMiddleware';
import { notFoundMiddleware } from './middlewares/notFoundMiddleware';

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), 'uploads'))
);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pemesanan', pemesananRoutes);
app.use('/api/pembayaran', pembayaranRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/omzet', omzetRoutes);
app.use('/api/notifikasi', notifikasiRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/logs', logRoutes);

// AI Kasir REDScan
app.use('/api/ai', aiRoutes);

app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'REDScan API berjalan',
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
