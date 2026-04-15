import mysql from 'mysql2/promise';

// Cria um pool exclusivo para o banco das páginas (Gestão de Medidas)
const poolMedidas = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gov_corp_pages_gm_db', // <-- Note que aqui é o NOVO banco!
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default poolMedidas;