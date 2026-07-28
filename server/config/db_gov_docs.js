import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // 1. Adicionado para ler o arquivo do certificado

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const sslCertPath = path.join(__dirname, 'certs', 'ca.pem');

const pool = mysql.createPool({
  host: process.env.DB3_HOST,
  user: process.env.DB3_USER,
  password: process.env.DB3_PASSWORD,
  database: process.env.DB3_NAME,
  port: process.env.DB3_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: {
    ca: fs.readFileSync(sslCertPath)
  }
});

export default pool;