import express from 'express';
import db from '../config/db_medidas.js'; 
import multer from 'multer';
import xlsx from 'xlsx';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ============================================================================
// 1. ROTA: BUSCAR ATOS FALTOSOS E REGRAS
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
// 2. ROTA: AUTOPREENCHIMENTO DO COLABORADOR (Sem Criptografia e Nomes Corrigidos)
// ============================================================================
router.get('/colaborador/:matricula', async (req, res) => {
    try {
        const matriculaOriginal = req.params.matricula.trim();
        const matriculaLimpa = matriculaOriginal.replace(/^0+/, ''); // Tira zeros à esquerda

        // 🔥 CORREÇÃO DEFINITIVA: Trocado de \`SITUAÇAO\` para SITUACAO (sem acentos)
        const queryHistorico = `
            SELECT 
                MATRICULA AS matricula, 
                NOME AS nome, 
                NOME_FILIAL AS filial, 
                DATA_ADMISSAO AS admissao, 
                SITUACAO AS situacao 
            FROM base_colaboradores_historico 
            WHERE TRIM(LEADING '0' FROM MATRICULA) = ? 
            ORDER BY id DESC LIMIT 1
        `;
        const [resultadoHistorico] = await db.query(queryHistorico, [matriculaLimpa]);

        let h = null;
        let nomeEncontradoHistorico = '';

        if (resultadoHistorico.length > 0) {
            h = resultadoHistorico[0]; 
            
            const linhaComNome = resultadoHistorico.find(linha => 
                linha.nome && 
                linha.nome.trim() !== '' && 
                String(linha.nome).toLowerCase() !== 'none' && 
                String(linha.nome).toLowerCase() !== 'nan'
            );
            if (linhaComNome) {
                nomeEncontradoHistorico = linhaComNome.nome.trim();
            }
        }

        // Busca no Cadastro usando as colunas exatas da sua tabela (StatusOficial)
        const queryCadastro = `
            SELECT 
                MatriculaRE AS matricula, 
                NomeColaborador AS nome, 
                PrimeiroGestor AS gestor_1, 
                SegundoGestor AS gestor_2, 
                Gerente AS gerente, 
                DiretorSuperintendente AS diretor, 
                DataAdmissao AS admissao, 
                StatusOficial AS filial 
            FROM cadastro_colaborador 
            WHERE TRIM(LEADING '0' FROM MatriculaRE) = ? 
            LIMIT 1
        `;
        const [resultadoCadastro] = await db.query(queryCadastro, [matriculaLimpa]);
        const c = resultadoCadastro.length > 0 ? resultadoCadastro[0] : null;

        if (!h && !c) {
            return res.status(404).json({ sucesso: false, mensagem: "Colaborador não localizado em nenhuma das bases." });
        }

        // ===================================================================
        // Função de limpeza absoluta de strings vazias + Tratamento de Datas
        // ===================================================================
        const limparTexto = (texto) => {
            if (texto === null || texto === undefined || String(texto).toLowerCase() === 'nan' || String(texto).toLowerCase() === 'none') {
                return '';
            }
            
            if (texto instanceof Date) {
                const ano = texto.getFullYear();
                const mes = String(texto.getMonth() + 1).padStart(2, '0');
                const dia = String(texto.getDate()).padStart(2, '0');
                return `${ano}-${mes}-${dia}`;
            }

            return String(texto).trim();
        };

        // Mesclagem do Nome
        let nomeDefinitivo = limparTexto(nomeEncontradoHistorico);
        if (!nomeDefinitivo && c) {
            nomeDefinitivo = limparTexto(c.nome);
        }

        // Monta o pacote EXATO que o HTML está esperando receber
        const dadosCadastro = {
            matricula: matriculaOriginal,
            nome: nomeDefinitivo,
            gestor_1: c ? limparTexto(c.gestor_1) : '',
            gestor_2: c ? limparTexto(c.gestor_2) : '',
            gerente:  c ? limparTexto(c.gerente) : '',
            diretor:  c ? limparTexto(c.diretor) : '',
            filial:   c ? limparTexto(c.filial) : (h ? limparTexto(h.filial) : ''),
            admissao: c ? limparTexto(c.admissao) : (h ? limparTexto(h.admissao) : ''),
            situacao: h ? (limparTexto(h.situacao) || 'A') : 'A'
        };

        return res.json({ sucesso: true, dados: dadosCadastro });

    } catch (error) {
        console.error("❌ Erro na rota colaborador:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro SQL Colaborador: " + error.message });
    }
});

// ============================================================================
// 3. ROTA: DASHBOARD / HISTÓRICO (Alimenta a Tabela do HTML)
// ============================================================================
router.get('/lista', async (req, res) => {
    try {
        if (!req.query.matricula) {
            return res.json([]); 
        }

        const matriculaLimpa = req.query.matricula.trim().replace(/\s/g, '').replace(/^0+/, '');

        // Consulta direta em texto limpo com os nomes reais das colunas
        const query = `
            SELECT 
                MATRICULA AS matricula,
                NOME AS nome,
                OBSERVACAO AS observacao,
                DATA_ATO_FALTOSO AS data_ato_faltoso,
                DATA_INICIO_SUSPENSAO AS data_suspensao,
                TIPO_GRAVIDADE AS gravidade,
                DESCRICAO_TIPO_MEDIDA AS tipo_medida,
                COD_TIPO_MEDIDA AS codigo_progressao
            FROM base_colaboradores_historico 
            WHERE TRIM(LEADING '0' FROM MATRICULA) = ?
            ORDER BY id DESC
        `;
        
        const [linhas] = await db.query(query, [matriculaLimpa]);

        const linhasLimpas = linhas.map(linha => {
            let dataPrimaria = linha.data_ato_faltoso || linha.data_suspensao || new Date().toISOString().split('T')[0];

            return {
                matricula: linha.matricula || '',
                nome: linha.nome || '',
                observacao: linha.observacao || '-',
                data_ato_faltoso: dataPrimaria,
                data_suspensao: linha.data_suspensao || '',
                gravidade: linha.gravidade || '-',
                tipo_medida: linha.tipo_medida || '',
                codigo_progressao: linha.codigo_progressao || 0,
                cliente: 'Não Informado' 
            };
        });

        res.json(linhasLimpas);

    } catch (error) {
        console.error("❌ Erro ao buscar histórico de medidas:", error);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: "Erro SQL: " + error.message 
        });
    }
});

// ============================================================================
// 4. ROTA: SALVAR NOVA MEDIDA (Insere na tabela Consolidada)
// ============================================================================
router.post('/nova', async (req, res) => {
    try {
        const dados = req.body;

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
            dados.data_ato_manual || dados.data_ato_faltoso || null, 
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

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const nomeDaPrimeiraAba = workbook.SheetNames[0];
        const aba = workbook.Sheets[nomeDaPrimeiraAba];
        const dadosExcel = xlsx.utils.sheet_to_json(aba);

        if (dadosExcel.length === 0) {
            return res.status(400).json({ sucesso: false, mensagem: "A planilha está vazia." });
        }

        let inseridos = 0;

        for (const linha of dadosExcel) {
            if (linha.MATRICULA || linha.matricula) {
                const query = `
                    INSERT INTO medidas_disciplinares_consolidado 
                    (matricula, nome, cpf, cargo, filial, gestor_1) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
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