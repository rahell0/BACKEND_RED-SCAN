
import { Router } from 'express';

import {
  buatPembayaranMidtrans,
  getStatusPembayaran,
  notifikasiMidtrans,
} from '../controllers/pembayaranController';

const router = Router();

router.post(
  '/:kode_transaksi/midtrans',
  buatPembayaranMidtrans
);

router.get(
  '/:kode_transaksi/status',
  getStatusPembayaran
);

router.post(
  '/midtrans/notification',
  notifikasiMidtrans
);

export default router;
