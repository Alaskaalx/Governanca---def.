import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });



const sslCertPath = path.join(__dirname, "certs", "ca.pem");

// Inicialização do Pool de Conexões com o MySQL
const pool = mysql.createPool({
  host: process.env.DB7_HOST,
  user: process.env.DB7_USER,
  password: process.env.DB7_PASSWORD,
  database: process.env.DB7_NAME,
  port: process.env.DB7_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: {
    ca: fs.readFileSync(sslCertPath)
  }
});

export default pool;