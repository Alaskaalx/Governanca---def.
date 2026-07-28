import express from 'express';
import { login } from '../controllers/authController.js'; 

const router = express.Router();

// 1. Rota Única de Login
router.post('/login', login);

// 2. Rota de Verificação de Sessão
router.get('/me', (req, res) => {
    if (req.session && req.session.usuario_id) {
        res.status(200).json({ 
            logado: true, 
            nome: req.session.usuario_nome,
            perfil: (req.session.usuario_perfil || 'padrao').toLowerCase() 
        }); 
    } else {
        res.status(200).json({ logado: false, mensagem: "Nenhum usuário logado." });
    }
});

// 3. Rota de Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ sucesso: false, mensagem: "Erro ao deslogar." });
        }
        res.clearCookie('connect.sid'); 
        res.json({ sucesso: true, mensagem: "Deslogado com sucesso!" });
    });
});

export default router;