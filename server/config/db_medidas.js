/*import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'N0$f3r4tu@2001',
    database: 'gov_corp_senhas_db',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;*/

import mysql from 'mysql2/promise';

const db = mysql.createPool({
    host: '127.0.0.1',             
    user: 'root',
    password: 'N0$f3r4tu@2001',
    database: 'gov_corp_pages_gm_db', 
    port: 3306,                     
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default db;