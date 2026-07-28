import express from 'express';
import fs from 'fs';
import path from 'path';
import {
    fileURLToPath
} from 'url';
import db from '../config/db.js';
import multer from 'multer';

const router = express.Router();

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURAÇÃO DE DIRETÓRIOS E UPLOADS (MULTER)
// ============================================================================
const baseLogsPath = path.join(__dirname, '../../logs_auditoria/logs_governanca');
const uploadPath = path.join(__dirname, '../../uploads/governanca');
const tempPath = path.join(uploadPath, 'temp');

if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, {
    recursive: true
});
if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, {
    recursive: true
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempPath),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
    }
});
const upload = multer({
    storage
});

// ============================================================================
// MÓDULO 1: GERADOR DE AUDITORIA EM TXT
// ============================================================================
async function registrarLogTxt(username, perfil, ip, acao, detalhes) {
    if (!username) return;
    const nomeModulo = 'page_painel_governanca';
    const pastaUsuario = path.join(baseLogsPath, nomeModulo, username);

    if (!fs.existsSync(pastaUsuario)) {
        fs.mkdirSync(pastaUsuario, {
            recursive: true
        });
    }

    const dataAtual = new Date();
    const dataArquivo = dataAtual.toISOString().split('T')[0];
    const caminhoArquivo = path.join(pastaUsuario, `auditoria_${dataArquivo}.txt`);

    const ipSeguro = ip ? String(ip).padEnd(15) : 'IP_DESCONHECIDO'.padEnd(15);
    const perfilSeguro = perfil ? String(perfil).toUpperCase().padEnd(10) : 'N/A'.padEnd(10);
    const acaoSegura = acao ? String(acao).padEnd(18) : 'ACAO_NULA'.padEnd(18);
    const detalhesSeguros = detalhes ? String(detalhes) : '';
    const dataHoraLinha = dataAtual.toLocaleString('pt-BR');

    const linhaLog = `[${dataHoraLinha}] | IP: ${ipSeguro} | PERFIL: ${perfilSeguro} | AÇÃO: ${acaoSegura} | DETALHE: ${detalhesSeguros}\n`;

    await fs.promises.appendFile(caminhoArquivo, linhaLog, 'utf8');
}

// ============================================================================
// MÓDULO 2 e 3: ROTAS GERAIS (Sessão, Looker, Get Documentos)
// ============================================================================
router.post('/registrar-log', async (req, res) => {
    try {
        const {
            usuario_nome,
            usuario_perfil
        } = req.session;
        if (!usuario_nome) return res.status(401).json({
            sucesso: false,
            mensagem: "Não autenticado."
        });
        await registrarLogTxt(usuario_nome, usuario_perfil, req.ip, req.body.tipo_acao, req.body.detalhes);
        return res.json({
            sucesso: true
        });
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const {
            usuario_nome,
            usuario_perfil
        } = req.session;
        if (!usuario_nome) return res.status(401).json({
            sucesso: false
        });
        await registrarLogTxt(usuario_nome, usuario_perfil, req.ip, 'LOGOUT', req.body.motivo);
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            return res.json({
                sucesso: true
            });
        });
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.get('/configuracoes/looker', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT valor FROM gov_corp_pages_comp_db.gov_corp_pages_comp_config_db WHERE chave = 'looker_studio_link'`);
        return res.json({
            link: rows.length > 0 ? rows[0].valor : ''
        });
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.put('/configuracoes/looker', async (req, res) => {
    try {
        const {
            novoLink
        } = req.body;
        const [result] = await db.query(`UPDATE gov_corp_pages_comp_db.gov_corp_pages_comp_config_db SET valor = ? WHERE chave = 'looker_studio_link'`, [novoLink]);
        if (result.affectedRows === 0) await db.query(`INSERT INTO gov_corp_pages_comp_db.gov_corp_pages_comp_config_db (chave, valor) VALUES ('looker_studio_link', ?)`, [novoLink]);
        return res.json({
            sucesso: true
        });
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.get('/documentos', async (req, res) => {
    try {
        const [docs] = await db.query(`SELECT * FROM gov_corp_pages_comp_db.governanca_documentos ORDER BY validade ASC`);
        const [historicoDB] = await db.query(`SELECT * FROM gov_corp_pages_comp_db.governanca_historico ORDER BY criado_em DESC`);

        const tarefas = docs.map(doc => ({
            id: doc.id,
            text: doc.nome,
            link: doc.link,
            tipoDocumento: doc.tipo,
            areaResponsavel: doc.area,
            expiresAt: doc.validade,
            status: doc.status,
            arquivoNome: doc.arquivo_nome,
            arquivoCaminho: doc.arquivo_caminho,
            createdAt: doc.criado_em,
            historico: historicoDB.filter(h => h.documento_id === doc.id).map(h => ({
                idHistorico: h.id,
                data: new Date(h.criado_em).toLocaleDateString('pt-BR'),
                acao: h.acao,
                arquivo: h.arquivo_nome || 'Nenhum'
            }))
        }));
        res.json(tarefas);
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

// ============================================================================
// MÓDULO 4: CADASTRO E EDIÇÃO COM MÚLTIPLOS ARQUIVOS (As rotas que estavam quebrando)
// ============================================================================
router.post('/documentos', upload.array('arquivos', 20), async (req, res) => {
    try {
        const {
            usuario_nome,
            usuario_perfil
        } = req.session;
        if (!usuario_nome) return res.status(401).json({
            sucesso: false,
            mensagem: "Não autenticado."
        });

        const {
            nome,
            link,
            tipoDocumento,
            areaResponsavel,
            expiresAt,
            status
        } = req.body;

        // Insere os metadados primeiro
        const [result] = await db.query(`
            INSERT INTO gov_corp_pages_comp_db.governanca_documentos 
            (nome, link, tipo, area, validade, status, arquivo_nome, arquivo_caminho) 
            VALUES (?, ?, ?, ?, ?, ?, '', '')
        `, [nome, link, tipoDocumento, areaResponsavel, expiresAt, status]);

        const docId = result.insertId;
        let arquivoNomeStr = '';
        let arquivoPastaDb = '';

        if (req.files && req.files.length > 0) {
            const nomeDaPasta = `doc_${docId}_${Date.now()}`;
            const caminhoPastaFisico = path.join(uploadPath, nomeDaPasta);
            fs.mkdirSync(caminhoPastaFisico, {
                recursive: true
            });

            let nomesDosArquivos = [];

            req.files.forEach(file => {
                // TRAVA 1: Higieniza o nome real para não quebrar a pasta do Windows/Linux
                const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const destino = path.join(caminhoPastaFisico, safeName);

                // TRAVA 2: Evita o erro EXDEV de movimentação de partição
                fs.copyFileSync(file.path, destino);
                fs.unlinkSync(file.path);

                nomesDosArquivos.push(safeName);
            });

            arquivoNomeStr = nomesDosArquivos.join(' | ');

            // TRAVA 3: Impede o erro ER_DATA_TOO_LONG do MySQL
            if (arquivoNomeStr.length > 250) {
                arquivoNomeStr = arquivoNomeStr.substring(0, 245) + '...';
            }

            arquivoPastaDb = nomeDaPasta;
            await db.query(`UPDATE gov_corp_pages_comp_db.governanca_documentos SET arquivo_nome = ?, arquivo_caminho = ? WHERE id = ?`, [arquivoNomeStr, arquivoPastaDb, docId]);
        }

        await db.query(`
            INSERT INTO gov_corp_pages_comp_db.governanca_historico (documento_id, acao, arquivo_nome, arquivo_caminho) 
            VALUES (?, 'Documento cadastrado no sistema.', ?, ?)
        `, [docId, arquivoNomeStr || 'Nenhum', arquivoPastaDb]);

        await registrarLogTxt(usuario_nome, usuario_perfil, req.ip, 'INC_DOCUMENTO', `Criou doc: ${nome}`);
        res.json({
            sucesso: true,
            mensagem: "Documento salvo."
        });
    } catch (error) {
        console.error("ERRO GRAVE POST:", error);
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.put('/documentos/:id', upload.array('arquivos', 20), async (req, res) => {
    try {
        const docId = req.params.id;
        const {
            nome,
            link,
            tipoDocumento,
            areaResponsavel,
            expiresAt,
            status,
            arquivoAtualNome,
            arquivoAtualCaminho,
            acaoLog
        } = req.body;

        let arquivoNomeStr = arquivoAtualNome || '';
        let arquivoPastaDb = arquivoAtualCaminho || '';

        if (req.files && req.files.length > 0) {
            const nomeDaPasta = `doc_${docId}_${Date.now()}`;
            const caminhoPastaFisico = path.join(uploadPath, nomeDaPasta);
            fs.mkdirSync(caminhoPastaFisico, {
                recursive: true
            });

            let nomesDosArquivos = [];

            req.files.forEach(file => {
                const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const destino = path.join(caminhoPastaFisico, safeName);
                fs.copyFileSync(file.path, destino);
                fs.unlinkSync(file.path);
                nomesDosArquivos.push(safeName);
            });

            arquivoNomeStr = nomesDosArquivos.join(' | ');
            if (arquivoNomeStr.length > 250) arquivoNomeStr = arquivoNomeStr.substring(0, 245) + '...';
            arquivoPastaDb = nomeDaPasta;
        }

        await db.query(`
            UPDATE gov_corp_pages_comp_db.governanca_documentos 
            SET nome = ?, link = ?, tipo = ?, area = ?, validade = ?, status = ?, arquivo_nome = ?, arquivo_caminho = ?
            WHERE id = ?
        `, [nome, link, tipoDocumento, areaResponsavel, expiresAt, status, arquivoNomeStr, arquivoPastaDb, docId]);

        if (acaoLog) {
            await db.query(`
                INSERT INTO gov_corp_pages_comp_db.governanca_historico (documento_id, acao, arquivo_nome, arquivo_caminho) 
                VALUES (?, ?, ?, ?)
            `, [docId, acaoLog, arquivoNomeStr, arquivoPastaDb]);
        }

        res.json({
            sucesso: true
        });
    } catch (error) {
        console.error("ERRO GRAVE PUT:", error);
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

// ============================================================================
// EXCLUSÃO E DOWNLOAD MÚLTIPLO
// ============================================================================
router.delete('/documentos/:id', async (req, res) => {
    try {
        const docId = req.params.id;
        const [docs] = await db.query(`SELECT nome FROM gov_corp_pages_comp_db.governanca_documentos WHERE id = ?`, [docId]);

        if (docs.length > 0) {
            if (fs.existsSync(uploadPath)) {
                const pastas = fs.readdirSync(uploadPath);
                pastas.forEach(pasta => {
                    if (pasta.startsWith(`doc_${docId}_`)) fs.rmSync(path.join(uploadPath, pasta), {
                        recursive: true,
                        force: true
                    });
                });
            }
            await db.query(`DELETE FROM gov_corp_pages_comp_db.governanca_historico WHERE documento_id = ?`, [docId]);
            await db.query(`DELETE FROM gov_corp_pages_comp_db.governanca_documentos WHERE id = ?`, [docId]);
        }
        res.json({
            sucesso: true
        });
    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            erro_interno: error.message
        });
    }
});

router.get('/download/:idHistorico', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT h.arquivo_caminho, h.arquivo_nome, d.nome AS documento_nome 
            FROM gov_corp_pages_comp_db.governanca_historico h
            INNER JOIN gov_corp_pages_comp_db.governanca_documentos d ON h.documento_id = d.id
            WHERE h.id = ?
        `, [req.params.idHistorico]);

        if (rows.length === 0 || !rows[0].arquivo_caminho) return res.status(404).send('Registro não encontrado.');

        const targetPath = path.join(uploadPath, rows[0].arquivo_caminho);
        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
            const files = fs.readdirSync(targetPath);
            if (files.length === 1) res.download(path.join(targetPath, files[0]), files[0]);
            else if (files.length > 1) {
                let html = `<body style="background: #1a1a1a; color: #fff; font-family: sans-serif; padding: 2rem;"><h2>Arquivos Anexados</h2><ul>`;
                files.forEach(f => html += `<li><a href="/api/governanca/file/${rows[0].arquivo_caminho}/${encodeURIComponent(f)}" style="color: #22c55e;">Baixar: ${f}</a></li>`);
                res.send(html + `</ul><br><a href="javascript:history.back()" style="color: #ccc;">Voltar ao Sistema</a></body>`);
            } else res.status(404).send('A pasta de arquivos está vazia.');
        } else res.download(targetPath, rows[0].arquivo_nome);
    } catch (error) {
        res.status(404).send('Arquivo físico não encontrado.');
    }
});

router.get('/file/:folder/:filename', async (req, res) => {
    const {
        folder,
        filename
    } = req.params;
    if (folder.includes('..') || filename.includes('..')) return res.status(403).send('Acesso negado.');
    const filePath = path.join(uploadPath, folder, filename);
    if (fs.existsSync(filePath)) res.download(filePath, filename);
    else res.status(404).send('Arquivo não encontrado na pasta.');
});

export default router;