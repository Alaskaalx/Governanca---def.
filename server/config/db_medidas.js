import mysql from 'mysql2/promise';

const db = mysql.createPool({
    host: '127.0.0.1', // <-- Mude de localhost para 127.0.0.1
    user: 'root',
    password: 'G0v3rn4nc453rv3r2001', // <-- A sua senha do Workbench
    database: 'gov_corp',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default db;