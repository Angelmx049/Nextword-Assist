const mysql = require('mysql2/promise');
require('dotenv').config();

// ASSIST opera con hora del centro de México. Se usa un offset explícito para
// que el proceso desplegado no herede la zona local de Render u otro host.
const DB_TIMEZONE = process.env.DB_TIMEZONE || '-06:00';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: DB_TIMEZONE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [DB_TIMEZONE], (error) => {
    if (error) console.error('No se pudo configurar la zona horaria de MySQL:', error.message);
  });
});

module.exports = pool;
