import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// Importando suas rotas
import authRoutes from './routes/authRoutes.js';
import medidasRoutes from './routes/medidasRoutes.js';

// Truque para o Node.js entender caminhos de pastas no formato "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Permite que o Express entenda requisições JSON e envios de formulários/arquivos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configura as sessões (Controle de Login)
app.use(session({
    secret: 'CHAVE_SUPER_SECRETA_SISTEMA_MEDIDAS_2026', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Deixe false enquanto estiver rodando em localhost
        maxAge: 1000 * 60 * 60 * 24 // Duração do login (24 horas)
    }
}));

// Liga as rotas de Backend (A sua API)
app.use('/api/auth', authRoutes);
app.use('/api/medidas', medidasRoutes);

// =======================================================================
// A MÁGICA PARA SERVIR OS SEUS ARQUIVOS HTML, CSS E JS
// =======================================================================

// 1. Libera o acesso direto à pasta de CSS, Imagens e JS
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// 2. Libera a pasta de páginas logadas (MÁGICA NOVA AQUI!)
app.use('/pages', express.static(path.join(__dirname, '../pages')));

// 3. Libera a pasta de login
app.use('/pages_login', express.static(path.join(__dirname, '../pages_login')));

// 4. Libera a raiz do projeto (index.html)
app.use('/', express.static(path.join(__dirname, '../')));

// =======================================================================
// INICIANDO O SERVIDOR
// =======================================================================
const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Servidor rodando liso!`);
    console.log(`Acesse clicando aqui: http://localhost:${PORT}/index.html`);
    console.log(`(Nota: Se o seu HTML estiver dentro de uma pasta "pages", adicione /pages/ no link acima!)`);
});