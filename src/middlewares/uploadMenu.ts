
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Folder penyimpanan gambar menu
const uploadDirectory = path.resolve(process.cwd(), 'uploads');

// Buat folder uploads otomatis jika belum tersedia
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `menu-${Date.now()}-${Math.round(
      Math.random() * 1_000_000
    )}${extension}`;

    callback(null, uniqueName);
  },
});

// Hanya menerima gambar
const fileFilter: multer.Options['fileFilter'] = (
  _req,
  file,
  callback
) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error('Format gambar harus JPG, PNG, atau WEBP.')
    );
  }
};

const uploadMenu = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maksimal 5 MB
  },
});

export default uploadMenu;
