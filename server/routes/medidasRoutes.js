// routes/medidasRoutes.js
import express from 'express';
import db from '../config/db_medidas.js'; // Importa o pool específico para o banco de medidas

import multer from 'multer';
import xlsx from 'xlsx';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ============================================================================
// 1. ROTA: BUSCAR ATOS FALTOSOS E REGRAS (Alimenta o <select> do formulário)
// ============================================================================
router.get('/atos-faltosos', async (req, res) => {
    try {
        const [linhas] = await db.query('SELECT * FROM atos_faltosos');
        res.json(linhas);
    } catch (error) {
        console.error("Erro ao buscar atos faltosos:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro no servidor ao buscar atos." });
    }
});


// ============================================================================
// 2. ROTA: AUTOPREENCHIMENTO DO COLABORADOR (Busca pelo número da Matrícula)
// ============================================================================
router.get('/colaborador/:matricula', async (req, res) => {
    try {
        const { matricula } = req.params;

        // ETAPA 1: Busca na tabela de Histórico primeiro
        const queryHistorico = 'SELECT * FROM base_colaboradores_historico WHERE matricula = ? ORDER BY id DESC LIMIT 1';
        const [resultadoHistorico] = await db.query(queryHistorico, [matricula]);

        if (resultadoHistorico.length > 0) {
            console.log(` Colaborador ${matricula} encontrado no Histórico.`);
            
            const h = resultadoHistorico[0];
            
            // Formatamos os dados para que o Frontend entenda independentemente de onde veio
            const dadosHistorico = {
                matricula: h.matricula,
                nome: h.nome,
                gestor_1: h.primeiro_gestor,
                gestor_2: h.segundo_gestor,
                gerente: h.gerente,
                diretor: h.diretor_superintendente, // Pode não existir no histórico, mas colocamos para garantir
                filial: h.filial,
                admissao: h.data_admissao
            };
            
            return res.json({ sucesso: true, origem: 'historico', dados: dadosHistorico });
        }
        
        console.log(` Matrícula ${matricula} não está no histórico. Buscando na Base Geral...`);

        // ETAPA 2: Se não achou, busca no Cadastro Geral
        const queryCadastro = 'SELECT * FROM cadastro_colaborador WHERE matricula_re = ? LIMIT 1';
        const [resultadoCadastro] = await db.query(queryCadastro, [matricula]);

        if (resultadoCadastro.length > 0) {
            const c = resultadoCadastro[0];

            const dadosCadastro = {
                matricula: c.matricula_re,
                nome: c.nome_colaborador,
                gestor_1: c.primeiro_gestor,
                gestor_2: c.segundo_gestor,
                gerente: c.gerente,
                diretor: c.diretor_superintendente,
                filial: c.operacao,
                admissao: '' // Como o cadastro RH não tem admissão, enviamos vazio
            };

            console.log(` Colaborador ${matricula} encontrado no Cadastro Geral.`);
            return res.json({ sucesso: true, origem: 'suporte', dados: dadosCadastro });
        }
        
        // ETAPA 3: Se não achou em lugar nenhum
        res.status(404).json({
            sucesso: false,
            mensagem: "Colaborador não localizado em nenhuma das bases."
        });

    } catch (error) {
        console.error("❌ Erro ao buscar colaborador:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro no servidor ao buscar colaborador." });
    }
});


// ============================================================================
// 3. ROTA: DASHBOARD / HISTÓRICO (Traz todo o histórico e puxa a operação)
// ============================================================================
router.get('/lista', async (req, res) => {
    try {
        const { matricula } = req.query;

        if (!matricula) {
            return res.json([]); 
        }

        // A MÁGICA: O comando ORDER BY com CASE força a progressão lógica.
        // O desempate (caso haja iguais) é feito pela validade_medida.
        const query = `
            SELECT 
                h.matricula,
                h.nome,
                h.data_ato_faltoso,
                h.validade_medida,
                h.nome_ocorrencia AS tipo_medida,
                h.desc_ato_faltoso,
                h.tipo_gravidade AS gravidade,
                c.operacao AS cliente
            FROM base_colaboradores_historico h
            LEFT JOIN cadastro_colaborador c ON h.matricula = c.matricula_re
            WHERE h.matricula = ?
            ORDER BY 
                CASE 
                    WHEN h.nome_ocorrencia LIKE '%1ª%' THEN 1
                    WHEN h.nome_ocorrencia LIKE '%2ª%' THEN 2
                    WHEN h.nome_ocorrencia LIKE '%3ª%' THEN 3
                    WHEN h.nome_ocorrencia LIKE '%SUSPENSÃO%' THEN 4
                    WHEN h.nome_ocorrencia LIKE '%JUSTA CAUSA%' THEN 5
                    WHEN h.nome_ocorrencia LIKE '%DEMISSÃO%' THEN 6
                    ELSE 99 
                END ASC,
                h.validade_medida DESC,
                h.data_ato_faltoso DESC
        `;
        
        const [linhas] = await db.query(query, [matricula]);
        
        res.json(linhas);
    } catch (error) {
        console.error("Erro ao buscar histórico de medidas:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar dados do Dashboard." });
    }
});


// ============================================================================
// 4. ROTA: SALVAR NOVA MEDIDA (Insere na tabela Consolidada)
// ============================================================================
router.post('/nova', async (req, res) => {
    try {
        const dados = req.body;

        // Query preparada para a tabela massiva consolidada
        const query = `
            INSERT INTO medidas_disciplinares_consolidado 
            (
                matricula, cpf, concre, id2, filial, nome, cargo, data_admissao, 
                registro_func, situacao_funcionario, centro_custo, proxima_acao, 
                data_inicio_suspensao, data_fim_suspensao, data_inicio_ocorrencia, 
                data_fim_ocorrencia, validade_medida, nro_chamado_sagoglobal, 
                data_ato_faltoso, classificacao_ato_faltoso, desc_ato_faltoso, 
                tipo, gravidade, quantidade_faltas, observacao, gestor_1, gestor_2, 
                gerente, diretor, texto_gerado
            ) 
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `;
        
        // Mapeamento inteligente: Se o campo não vier do formulário, salva como NULL
        // Note que ele aceita tanto os nomes antigos do HTML (ex: admissao) quanto os novos (ex: data_admissao)
        const valores = [
            dados.matricula || null,
            dados.cpf || null,
            dados.concre || null,
            dados.id2 || null,
            dados.filial || null,
            dados.nome || null,
            dados.cargo || null,
            dados.admissao || dados.data_admissao || null, 
            dados.registro_func || null,
            dados.situacao_funcionario || null,
            dados.centro_custo || null,
            dados.proxima_acao || null,
            dados.data_inicio_suspensao || null,
            dados.data_fim_suspensao || null,
            dados.data_inicio_ocorrencia || null,
            dados.data_fim_ocorrencia || null,
            dados.validade_medida || null,
            dados.nro_chamado_sagoglobal || null,
            dados.data_ato_manual || dados.data_ato_faltoso || null, // A data que o gestor escolhe no form
            dados.classificacao_ato_faltoso || null,
            dados.desc_ato_faltoso || null,
            dados.tipo_medida || dados.tipo || null,
            dados.nova_gravidade || dados.gravidade || null,
            dados.volume_medidas || dados.quantidade_faltas || 0,
            dados.info_compliance || dados.observacao || null,
            dados.gestor_1 || null,
            dados.gestor_2 || null,
            dados.gerente || null,
            dados.diretor || null,
            dados.texto_gerado || null
        ];

        await db.query(query, valores);
        res.status(201).json({ sucesso: true, mensagem: "Medida disciplinar consolidada com sucesso!" });

    } catch (error) {
        console.error("Erro ao guardar medida consolidada:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao gravar na base de dados consolidada." });
    }
});

// ============================================================================
// 5. ROTA: IMPORTAR PLANILHA EXCEL (.xlsx)
// ============================================================================
router.post('/importar', upload.single('planilhaExcel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ sucesso: false, mensagem: "Nenhum arquivo enviado." });
        }

        // 1. Lê o arquivo Excel da memória
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const nomeDaPrimeiraAba = workbook.SheetNames[0];
        const aba = workbook.Sheets[nomeDaPrimeiraAba];

        // 2. Converte as linhas do Excel para um Array de Objetos JavaScript
        const dadosExcel = xlsx.utils.sheet_to_json(aba);

        if (dadosExcel.length === 0) {
            return res.status(400).json({ sucesso: false, mensagem: "A planilha está vazia." });
        }

        // 3. Prepara a inserção em massa (Loop)
        let inseridos = 0;

        for (const linha of dadosExcel) {
            // Verifica se a linha tem pelo menos a matrícula (para evitar linhas em branco)
            if (linha.MATRICULA || linha.matricula) {
                const query = `
                    INSERT INTO medidas_disciplinares_consolidado 
                    (matricula, nome, cpf, cargo, filial, gestor_1) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                // Mapeia as colunas do Excel para o Banco. 
                // ATENÇÃO: O nome da propriedade (ex: linha.NOME) tem que ser EXATAMENTE igual ao cabeçalho da sua planilha Excel.
                const valores = [
                    linha.MATRICULA || linha.matricula || null,
                    linha.NOME || linha.nome || null,
                    linha.CPF || linha.cpf || null,
                    linha.CARGO || linha.cargo || null,
                    linha.FILIAL || linha.filial || null,
                    linha['1º GESTOR'] || linha.gestor_1 || null 
                ];

                await db.query(query, valores);
                inseridos++;
            }
        }

        res.status(200).json({ sucesso: true, mensagem: `${inseridos} registros importados com sucesso!` });

    } catch (error) {
        console.error("Erro ao importar planilha:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao processar o arquivo Excel." });
    }
});

export default router;
