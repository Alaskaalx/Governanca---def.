import db from '../config/db_medidas.js';
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

        // Busca o usuário...
        const [rows] = await db.query(`SELECT * FROM ${nome_tabela} WHERE username = ? AND ativo = 1`, [username]);
        
        // --- COLOCAR O DETETIVE AQUI ---
        console.log("\n=== DETETIVE DE LOGIN ===");
        console.log("1. Tabela alvo:", nome_tabela);
        console.log("2. Usuário digitado no HTML:", `[${username}]`);
        console.log("3. Resposta do Banco de Dados:", rows);
        console.log("===========================\n");
        // -------------------------------

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

// NOVA FUNÇÃO: Executa a troca de senha obrigatória do primeiro acesso
export const alterarSenha = async (req, res) => {
    try {
        const { username, nova_senha, tabela_alvo } = req.body;

        if (!username || !nova_senha || !tabela_alvo) {
            return res.status(400).json({ sucesso: false, mensagem: "Dados insuficientes para alterar a senha." });
        }

        // Lista de tabelas permitidas (White-list de segurança contra SQL Injection)
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

        // 1. Gera o Hash seguro com bcrypt para a nova senha digitada pelo usuário
        const salt = await bcrypt.genSalt(10);
        const novoHashSessao = await bcrypt.hash(nova_senha, salt);

        // 2. Atualiza a senha no banco e muda primeiro_acesso para 0
        const queryUpdate = `UPDATE ${tabela_alvo} SET senha_hash = ?, primeiro_acesso = 0 WHERE username = ?`;
        const [result] = await db.query(queryUpdate, [novoHashSessao, username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado para atualização." });
        }

        // 3. Busca os dados atualizados do usuário para já criar a sessão dele diretamente
        const [rows] = await db.query(`SELECT * FROM ${tabela_alvo} WHERE username = ?`, [username]);
        const usuarioAtualizado = rows[0];

        // Mapeamento de URLs para redirecionar após a troca de senha com sucesso
        const urls_modulos = {
            'login_compliance': 'painel_governanca.html',
            'login_monitoramento': 'painel_monitoramento.html',
            'login_auditoria_sites': 'painel_auditoria_sites.html',
            'login_auditoria_processos': 'painel_auditoria_processos.html',
            'login_gestao_medidas': 'painel_gestao_medidas.html'
        };

        // 4. Cria a sessão do usuário automaticamente (Salva no servidor)
        req.session.usuario_id = usuarioAtualizado.id;
        req.session.usuario_nome = usuarioAtualizado.nome;
        req.session.usuario_perfil = usuarioAtualizado.perfil;
        req.session.modulo_atual = tabela_alvo;

        // 5. Retorna sucesso e a URL para onde ele deve ser jogado agora que está com a senha nova
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