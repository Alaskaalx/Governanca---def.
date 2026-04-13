import db from '../config/db.js';
import bcrypt from 'bcrypt';

export const login = async (req, res) => {
    try {
        const { username, password, modulo_id } = req.body;

        if (!username || !password) {
            return res.status(400).json({ sucesso: false, mensagem: "Preencha usuário e senha." });
        }

        // Mapeamento de segurança (idêntico ao seu PHP)
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

        // Busca o usuário. Usamos o pool do BD configurado anteriormente.
        // O `?` evita SQL Injection nos valores, e a tabela vem do dicionário seguro acima.
        const [rows] = await db.query(`SELECT * FROM ${nome_tabela} WHERE username = ? AND ativo = 1`, [username]);
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "Usuário não tem acesso a este módulo ou está inativo." });
        }

        // Verifica a senha (equivalente ao password_verify)
        const senhaCorreta = await bcrypt.compare(password, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta." });
        }

        // Verifica primeiro acesso
        if (usuario.primeiro_acesso === 1) {
            return res.json({ sucesso: true, primeiro_acesso: true, tabela_alvo: nome_tabela });
        }

        // Salva os dados na sessão (equivalente ao $_SESSION)
        req.session.usuario_id = usuario.id;
        req.session.usuario_nome = usuario.nome;
        req.session.usuario_perfil = usuario.perfil;
        req.session.modulo_atual = nome_tabela;

        // Retorno de sucesso
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