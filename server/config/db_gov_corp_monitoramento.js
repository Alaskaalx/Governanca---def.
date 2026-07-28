import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const sslCertPath = path.join(__dirname, 'certs', 'ca.pem');

const pool = mysql.createPool({
    host: process.env.DB4_HOST,
    user: process.env.DB4_USER,
    password: process.env.DB4_PASSWORD,
    database: process.env.DB4_NAME,
    port: process.env.DB4_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: {
        ca: fs.readFileSync(sslCertPath)
    }
});

export default pool;