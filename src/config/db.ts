import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Sesuaikan jika MySQL phpMyAdmin kamu pakai password
  database: 'redscan_db', // Sesuaikan dengan nama database di phpMyAdmin
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});