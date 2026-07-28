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
    host:process.env.DB5_HOST,
    user:process.env.DB5_USER,
    password:process.env.DB5_PASSWORD,
    database:process.env.DB5_NAME,
    port:process.env.DB5_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        ca: fs.readFileSync(sslCertPath)
    }
});

export default pool;