import express from 'express';
import { login } from '../controllers/authController.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// 1. Rota de Login (Recebe os dados do HTML e manda para o seu Controller)
router.post('/login', login);

// 2. Rota de Verificação de Sessão (Console 100% limpo)
router.get('/me', (req, res) => {
    if (req.session && req.session.usuario) {
        // Responde com sucesso (200) e manda os dados
        res.status(200).json({ logado: true, nome: req.session.usuario.nome }); 
    } else {
        // Responde com sucesso (200) também, para o Chrome não reclamar,
        // mas avisa o Frontend que não tem ninguém logado.
        res.status(200).json({ logado: false, mensagem: "Nenhum usuário logado." });
    }
});

// 3. Rota de Logout (Destrói a sessão quando o usuário clicar em Sair)
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ sucesso: false, mensagem: "Erro ao deslogar." });
        }
        res.clearCookie('connect.sid'); // Limpa o cookie do navegador
        res.json({ sucesso: true, mensagem: "Deslogado com sucesso!" });
    });
});

// Rota secreta para gerar senhas
router.get('/gerador', async (req, res) => {
    // Vamos mandar o próprio Node.js gerar o hash perfeito para "123456"
    const hashNovo = await bcrypt.hash('123456', 10);
    res.send(`O hash perfeito para 123456 é: <b>${hashNovo}</b>`);
});

export default router;