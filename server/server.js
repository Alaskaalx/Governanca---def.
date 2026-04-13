import express from 'express';
import session from 'express-session';
import authRoutes from './routes/authRoutes.js';

const app = express();

// Permite que o Express entenda requisições JSON (equivalente ao json_decode(file_get_contents("php://input")))
app.use(express.json());

// Configura as sessões (equivalente ao session_start() global do PHP)
app.use(session({
    secret: 'SUA_CHAVE_SECRETA_SUPER_SEGURA_AQUI', // Troque isso em produção!
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Mude para true se estiver usando HTTPS em produção
        maxAge: 1000 * 60 * 60 * 24 // Duração da sessão (ex: 24 horas)
    }
}));

// Liga as rotas de autenticação no prefixo /api/auth
app.use('/api/auth', authRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando liso na porta ${PORT}`);
});