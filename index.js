const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Koneksi ke Database MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      // Default XAMPP
  password: '',      // Default XAMPP (kosong)
  database: 'db_red_scan'
});

db.connect((err) => {
  if (err) {
    console.error('Koneksi Database Gagal:', err.message);
  } else {
    console.log('Terhubung ke Database MySQL!');
  }
});

// 1. Endpoint REGISTER / TAMBAH USER
app.post('/api/users/register', (req, res) => {
  const { name, email, password } = req.body;
  const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
  
  db.query(sql, [name, email, password], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'User berhasil terdaftar', id: result.insertId });
  });
});

// 2. Endpoint LOGIN
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }
    res.json({ message: 'Login berhasil', user: results[0] });
  });
});

// Jalankan Server Backend
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server Backend jalan di http://localhost:${PORT}`);
});