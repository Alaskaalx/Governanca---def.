import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // 1. Adicionado para ler o arquivo do certificado

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Cria o caminho absoluto para o certificado 
// Considerando que o ca.pem está em server/config/certs/ca.pem

const sslCertPath = path.join(__dirname, 'certs', 'ca.pem');

const pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  port: process.env.DB1_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // 3. Bloco SSL adicionado aqui
  ssl: {
    ca: fs.readFileSync(sslCertPath)
  }
});

export default pool;