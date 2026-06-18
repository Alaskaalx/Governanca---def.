import db from '../config/db.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// ============================================================================
// CONFIGURAÇÃO DO E-MAIL (SMTP) - Insira a senha real da TI aqui
// ============================================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Ajuste se a Contax usar outro servidor (ex: smtp.gmail.com)
    port: 587,
    secure: false, // true para porta 465, false para 587
    auth: {
        user: 'gip@contax.com.br',
        pass: 'COLOQUE_A_SENHA_AQUI' 
    }
});

// ============================================================================
// 1. FUNÇÃO: SOLICITAR SENHA TEMPORÁRIA (Primeiro Acesso / Esqueci a Senha)
// ============================================================================
export const solicitarSenha = async (req, res) => {
    try {
        const { username, modulo_id } = req.body;

        if (!username || !modulo_id) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe o seu usuário e o módulo." });
        }

        const tabelas_modulos = {
            1: 'login_compliance',
            2: 'login_monitoramento',
            3: 'login_auditoria_sites',
            4: 'login_auditoria_processos',
            5: 'login_gestao_medidas'
        };

        const nome_tabela = tabelas_modulos[modulo_id];
        if (!nome_tabela) {
            return res.status(400).json({ sucesso: false, mensagem: "Módulo inválido." });
        }

        // Busca o email do usuário
        const [rows] = await db.query(`SELECT email FROM ${nome_tabela} WHERE username = ? AND ativo = 1`, [username]);
        const usuario = rows[0];

        if (!usuario || !usuario.email) {
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado, inativo ou sem e-mail cadastrado." });
        }

        // Gera senha temporária de 8 caracteres
        const senhaTemporaria = crypto.randomBytes(4).toString('hex');
        
        // Criptografa a senha temporária para salvar no banco
        const salt = await bcrypt.genSalt(10);
        const hashTemporario = await bcrypt.hash(senhaTemporaria, salt);

        // Salva a senha e garante que o primeiro_acesso é 1 (para forçar a troca no login)
        await db.query(`UPDATE ${nome_tabela} SET senha_hash = ?, primeiro_acesso = 1 WHERE username = ?`, [hashTemporario, username]);

        // Dispara o e-mail
        const mailOptions = {
            from: 'gip@contax.com.br',
            to: usuario.email,
            subject: 'Sua Senha de Acesso Temporária - Sistema GIP',
            text: `Olá,\n\nVocê solicitou o seu primeiro acesso ou a redefinição de senha.\n\nSua senha temporária é: ${senhaTemporaria}\n\nPor favor, volte à tela de login, insira seu usuário e esta senha temporária. O sistema pedirá imediatamente para você criar a sua senha definitiva.\n\nAtenciosamente,\nEquipe GIP`
        };

        await transporter.sendMail(mailOptions);

        return res.json({ sucesso: true, mensagem: "Uma senha temporária foi enviada para o seu e-mail corporativo." });

    } catch (error) {
        console.error("Erro ao solicitar senha:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao tentar enviar o e-mail. Contate o suporte." });
    }
};

// ============================================================================
// 2. FUNÇÃO: LOGIN
// ============================================================================
export const login = async (req, res) => {
    try {
        const { username, password, modulo_id } = req.body;

        if (!username || !password) {
            return res.status(400).json({ sucesso: false, mensagem: "Preencha usuário e senha." });
        }

        const tabelas_modulos = {
            1: { tabela: 'login_compliance', url: 'painel_governanca.html' },
            2: { tabela: 'login_monitoramento', url: 'painel_monitoramento.html' },
            3: { tabela: 'login_auditoria_sites', url: 'painel_auditoria_sites.html' },
            4: { tabela: 'login_auditoria_processos', url: 'painel_auditoria_processos.html' },
            5: { tabela: 'login_gestao_medidas', url: 'painel_gestao_medidas.html' }
        };

        if (!tabelas_modulos[modulo_id]) {
            return res.status(400).json({ sucesso: false, mensagem: "Módulo inválido." });
        }

        const { tabela: nome_tabela, url: url_destino } = tabelas_modulos[modulo_id];

        const [rows] = await db.query(`SELECT * FROM ${nome_tabela} WHERE username = ? AND ativo = 1`, [username]);
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "Usuário não tem acesso a este módulo ou está inativo." });
        }

        // 🔥 TRAVA DO PRIMEIRO ACESSO SEM SENHA
        if (!usuario.senha_hash) {
            return res.status(401).json({ sucesso: false, mensagem: "Você ainda não possui uma senha. Clique em 'Não possuo a senha'." });
        }

        const senhaCorreta = await bcrypt.compare(password, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
        }

        if (usuario.primeiro_acesso === 1) {
            return res.json({ sucesso: true, primeiro_acesso: true, tabela_alvo: nome_tabela });
        }

        req.session.usuario_id = usuario.id;
        req.session.usuario_nome = usuario.username; // Usando username
        req.session.usuario_perfil = usuario.perfil;
        req.session.modulo_atual = nome_tabela;

        return res.json({
            sucesso: true,
            primeiro_acesso: false,
            url_destino: url_destino,
            perfil: usuario.perfil
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno no servidor." });
    }
};

// ============================================================================
// 3. FUNÇÃO: ALTERAR SENHA
// ============================================================================
export const alterarSenha = async (req, res) => {
    try {
        const { username, nova_senha, tabela_alvo } = req.body;

        if (!username || !nova_senha || !tabela_alvo) {
            return res.status(400).json({ sucesso: false, mensagem: "Dados insuficientes para alterar a senha." });
        }

        const tabelasPermitidas = [
            'login_compliance', 
            'login_monitoramento', 
            'login_auditoria_sites', 
            'login_auditoria_processos', 
            'login_gestao_medidas'
        ];

        if (!tabelasPermitidas.includes(tabela_alvo)) {
            return res.status(400).json({ sucesso: false, message: "Tabela de destino inválida." });
        }

        const salt = await bcrypt.genSalt(10);
        const novoHashSessao = await bcrypt.hash(nova_senha, salt);

        const queryUpdate = `UPDATE ${tabela_alvo} SET senha_hash = ?, primeiro_acesso = 0 WHERE username = ?`;
        const [result] = await db.query(queryUpdate, [novoHashSessao, username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado para atualização." });
        }

        const [rows] = await db.query(`SELECT * FROM ${tabela_alvo} WHERE username = ?`, [username]);
        const usuarioAtualizado = rows[0];

        const urls_modulos = {
            'login_compliance': 'painel_governanca.html',
            'login_monitoramento': 'painel_monitoramento.html',
            'login_auditoria_sites': 'painel_auditoria_sites.html',
            'login_auditoria_processos': 'painel_auditoria_processos.html',
            'login_gestao_medidas': 'painel_gestao_medidas.html'
        };

        // 🔥 CORREÇÃO NA SESSÃO (usuarioAtualizado.username em vez de nome)
        req.session.usuario_id = usuarioAtualizado.id;
        req.session.usuario_nome = usuarioAtualizado.username; 
        req.session.usuario_perfil = usuarioAtualizado.perfil;
        req.session.modulo_atual = tabela_alvo;

        return res.json({
            sucesso: true,
            mensagem: "Senha cadastrada com sucesso!",
            url_destino: urls_modulos[tabela_alvo],
            perfil: usuarioAtualizado.perfil
        });

    } catch (error) {
        console.error("Erro na alteração de senha de primeiro acesso:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao redefinir senha." });
    }
};
