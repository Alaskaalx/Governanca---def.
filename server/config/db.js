import mysql from 'mysql2/promise';

// Cria um "pool" de conexões, que é mais eficiente que abrir e fechar a conexão toda hora
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'G0v3rn4nc453rv3r2001', // <-- Coloque a senha do MySQL Workbench aqui
    database: 'gov_corp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;