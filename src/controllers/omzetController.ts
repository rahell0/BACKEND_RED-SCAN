import { Request, Response } from 'express';

export const getLaporanOmzet = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      laporan: {
        totalOmzet: 3500000,
        totalTransaksi: 150
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};