import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/authRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Panggil Route Auth
app.use('/api/auth', authRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server TS running di http://localhost:${PORT}`);
});