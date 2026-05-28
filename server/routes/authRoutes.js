import express from 'express';
import { login, alterarSenha } from '../controllers/authController.js'; // 1. Adicione o 'alterarSenha' no import
import bcrypt from 'bcrypt';

const router = express.Router();

// 1. Rota de Login (Recebe os dados do HTML e manda para o seu Controller)
router.post('/login', login);

// NOVA ROTA: Recebe a nova senha do usuário que está no primeiro acesso
router.post('/alterar-senha', alterarSenha);

// 2. Rota de Verificação de Sessão (Console 100% limpo)
router.get('/me', (req, res) => {
    if (req.session && req.session.usuario) {
        res.status(200).json({ logado: true, nome: req.session.usuario.nome }); 
    } else {
        res.status(200).json({ logado: false, mensagem: "Nenhum usuário logado." });
    }
});

// 3. Rota de Logout (Destrói a sessão quando o usuário clicar em Sair)
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ sucesso: false, mensagem: "Erro ao deslogar." });
        }
        res.clearCookie('connect.sid'); 
        res.json({ sucesso: true, mensagem: "Deslogado com sucesso!" });
    });
});

// Rota secreta para gerar senhas
router.get('/gerador', async (req, res) => {
    const hashNovo = await bcrypt.hash('123456', 10);
    res.send(`O hash perfeito para 123456 é: <b>${hashNovo}</b>`);
});

export default router;