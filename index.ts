import express, { Request, Response } from 'express';
import mysql from 'mysql2';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Koneksi ke Database MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_red_scan'
});

db.connect((err) => {
  if (err) {
    console.error('Koneksi Database Gagal:', err.message);
  } else {
    console.log('Terhubung ke Database MySQL (TypeScript)!');
  }
});

// Endpoint Register
app.post('/api/users/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
  
  db.query(sql, [name, email, password], (err, result: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'User berhasil terdaftar', id: result.insertId });
  });
});

// Endpoint Login
app.post('/api/users/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  
  db.query(sql, [email, password], (err, results: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }
    res.json({ message: 'Login berhasil', user: results[0] });
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server TS running di http://localhost:${PORT}`);
});