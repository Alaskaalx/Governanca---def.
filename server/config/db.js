import mysql from 'mysql2/promise';

// Cria um "pool" de conexões, que é mais eficiente que abrir e fechar a conexão toda hora
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gov_corp_senhas_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;