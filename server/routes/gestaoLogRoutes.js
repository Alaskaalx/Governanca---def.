import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// O caminho sobe 2 níveis (sai de routes, sai de server) e entra na pasta
const baseLogsPath = path.join(__dirname, '../../logs_auditoria/logs_governanca');

// ============================================================================
// FUNÇÃO INTERNA: GERADOR DE ARQUIVO TXT
// ============================================================================
async function registrarLogTxt(username, perfil, ip, acao, detalhes) {
    // Agora a função NÃO engole o erro, ela joga para a rota responder ao F12
    if (!username) throw new Error("O username chegou vazio na função de gravação.");

    // 🔥 CORREÇÃO APLICADA AQUI: Força a variável a ser texto puro (String)
    const usernameSeguro = String(username);
    const nomeModulo = 'page_painel_gestao_medidas';
    
    // O path.join agora está 100% blindado contra objetos
    const pastaUsuario = path.join(baseLogsPath, nomeModulo, usernameSeguro);

    // Cria as pastas
    if (!fs.existsSync(pastaUsuario)) {
        fs.mkdirSync(pastaUsuario, { recursive: true });
    }

    const dataAtual = new Date();
    const dataArquivo = dataAtual.toISOString().split('T')[0]; 
    const caminhoArquivo = path.join(pastaUsuario, `auditoria_${dataArquivo}.txt`);

    // ==========================================================
    // BLINDAGEM CONTRA VARIÁVEIS NULAS
    // ==========================================================
    const ipSeguro = ip ? String(ip).padEnd(15) : 'IP_DESCONHECIDO'.padEnd(15);
    const perfilSeguro = perfil ? String(perfil).toUpperCase().padEnd(10) : 'N/A'.padEnd(10);
    const acaoSegura = acao ? String(acao).padEnd(15) : 'ACAO_NULA'.padEnd(15);
    const detalhesSeguros = detalhes ? String(detalhes) : '';
    const dataHoraLinha = dataAtual.toLocaleString('pt-BR');
    
    const linhaLog = `[${dataHoraLinha}] | IP: ${ipSeguro} | PERFIL: ${perfilSeguro} | AÇÃO: ${acaoSegura} | DETALHE: ${detalhesSeguros}\n`;

    // Escreve o arquivo
    await fs.promises.appendFile(caminhoArquivo, linhaLog, 'utf8');
}

// ============================================================================
// ROTA DE LOGS 
// ============================================================================
router.post('/registrar-log', async (req, res) => {
    try {
        const { usuario_nome, usuario_perfil } = req.session;
        
        if (!usuario_nome) {
            return res.status(401).json({ sucesso: false, mensagem: "Acesso negado: Usuário não autenticado." });
        }

        const { tipo_acao, detalhes } = req.body;
        const ipMaquina = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

        // Chama a função (se ela der erro, o catch abaixo vai capturar)
        await registrarLogTxt(usuario_nome, usuario_perfil, ipMaquina, tipo_acao, detalhes);

        return res.json({ sucesso: true, mensagem: "Log gravado com sucesso no TXT!" });
    } catch (error) {
        console.error("ERRO GRAVE NO LOG:", error);
        // Devolve o erro MASTIGADO para o F12
        return res.status(500).json({ 
            sucesso: false, 
            erro_interno: error.message,
            aviso: "Verifique a aba Preview do F12 para ler este erro."
        });
    }
});

// ============================================================================
// ROTA 2: LOGOUT
// ============================================================================
router.post('/logout', async (req, res) => {
    try {
        const { usuario_nome, usuario_perfil } = req.session;
        const { motivo } = req.body; 
        
        if (!usuario_nome) {
            return res.status(401).json({ sucesso: false, message: "Sessão já inexistente." });
        }

        const ipMaquina = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        const detalheLogout = motivo === 'AFK' ? 'Sessão encerrada por inatividade (AFK)' : 'Logout manual solicitado pelo usuário';
        
        await registrarLogTxt(usuario_nome, usuario_perfil, ipMaquina, 'LOGOUT', detalheLogout);

        req.session.destroy((err) => {
            if (err) return res.status(500).json({ sucesso: false, erro_interno: "Erro no express-session." });
            res.clearCookie('connect.sid');
            return res.json({ sucesso: true });
        });

    } catch (error) {
        console.error("ERRO NO LOGOUT:", error);
        return res.status(500).json({ sucesso: false, erro_interno: error.message });
    }
});

export default router;