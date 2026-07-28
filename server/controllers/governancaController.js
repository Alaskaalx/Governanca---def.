import db from '../caminho/para/seu/arquivo/db.js'; // O arquivo com o pool que você enviou

// =======================================================
// ROTA: DOCUMENTOS NORMATIVOS
// =======================================================
export const getDocumentos = async (req, res) => {
    try {
        // Substitua 'documentos_normativos' pelo nome real da sua tabela
        const [rows] = await db.query('SELECT * FROM governanca_documentos ORDER BY expiresAt ASC');
        return res.json(rows);
    } catch (error) {
        console.error("Erro ao buscar documentos:", error);
        return res.status(500).json({ erro: "Falha ao buscar documentos no banco de dados." });
    }
};

// =======================================================
// ROTAS: LOOKER STUDIO (Dashboard)
// =======================================================
export const getLookerLink = async (req, res) => {
    try {
        // Supondo que a tabela se chame 'configuracoes_looker' e o link fique no ID 1
        const [rows] = await db.query('SELECT link FROM gov_corp_pages_comp_config_db WHERE id = 1 LIMIT 1');
        
        if (rows.length > 0) {
            return res.json({ link: rows[0].link });
        } else {
            return res.json({ link: '' }); // Retorna vazio se não houver link salvo
        }
    } catch (error) {
        console.error("Erro ao buscar link do Looker:", error);
        return res.status(500).json({ erro: "Falha ao buscar o link." });
    }
};

export const updateLookerLink = async (req, res) => {
    try {
        const { novoLink } = req.body;

        if (!novoLink) {
            return res.status(400).json({ erro: "Nenhum link enviado." });
        }

        // Atualiza ou insere o link na tabela
        const [result] = await db.query('UPDATE gov_corp_pages_comp_config_db SET link = ? WHERE id = 1', [novoLink]);
        
        if (result.affectedRows === 0) {
            // Se não existia o ID 1, ele insere
            await db.query('INSERT INTO gov_corp_pages_comp_config_db (id, link) VALUES (1, ?)', [novoLink]);
        }

        return res.json({ sucesso: true, mensagem: "Link atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar link do Looker:", error);
        return res.status(500).json({ erro: "Falha ao salvar o link." });
    }
};