// Array global para guardar os dados vindos da base de dados
let listaAtosFaltosos = [];
let historicoAtualColaborador = [];

// ============================================================================
// 1. FUNÇÃO: Buscar Colaborador pela Matrícula e Autopreencher
// ============================================================================
async function buscarDadosColaborador() {
    const matriculaInput = document.getElementById('matricula');

    // LIMPEZA FORTE: Remove espaços nas pontas e no meio da string digitada
    const matricula = matriculaInput.value.trim().replace(/\s/g, '');

    if (!matricula) return;

    try {
        const response = await fetch(`/api/medidas/colaborador/${matricula}`);
        const result = await response.json();

        if (response.ok && result.sucesso) {
            const dados = result.dados;

            document.getElementById('nome').value = dados.nome || '';
            document.getElementById('gestor_1').value = dados.gestor_1 || '';
            document.getElementById('gestor_2').value = dados.gestor_2 || '';
            document.getElementById('gerente').value = dados.gerente || '';
            document.getElementById('diretor').value = dados.diretor || '';

            // ==========================================
            // Admissão (Com conversor robusto de datas)
            // ==========================================
            let dataAdmissao = dados.data_admissao || dados.admissao;
            if (dataAdmissao) {
                dataAdmissao = String(dataAdmissao).split('T')[0].split(' ')[0];
                if (dataAdmissao.includes('/')) {
                    const partes = dataAdmissao.split('/');
                    if (partes.length === 3) {
                        dataAdmissao = `${partes[2]}-${partes[1]}-${partes[0]}`;
                    }
                }
                document.getElementById('admissao').value = dataAdmissao;
            } else {
                document.getElementById('admissao').value = '';
            }

            // --- LÓGICA DE SITUAÇÃO (Normal x Afastado) ---
            const codSituacao = (dados.situacao || '').toUpperCase();
            const inputSituacao = document.getElementById('situacao');

            if (inputSituacao) {
                if (['A', 'V'].includes(codSituacao)) {
                    inputSituacao.value = "Normal";
                    inputSituacao.style.borderColor = "#28a745";
                    inputSituacao.style.color = "#28a745";
                } else if (['D', 'E', 'F', 'P', 'Q', 'U'].includes(codSituacao)) {
                    inputSituacao.value = "Afastado";
                    inputSituacao.style.borderColor = "#dc3545";
                    inputSituacao.style.color = "#dc3545";
                } else {
                    inputSituacao.value = codSituacao || 'Não Informado';
                    inputSituacao.style.borderColor = "";
                    inputSituacao.style.color = "";
                }
            }

            await carregarHistoricoMedidas(matricula);

            if (typeof preencherDadosDoAto === 'function') {
                preencherDadosDoAto();
            }

        } else {
            console.log("Matrícula não encontrada em nenhuma base de dados.");
            if (document.getElementById('situacao')) document.getElementById('situacao').value = '';
            await carregarHistoricoMedidas('invalida');
        }
    } catch (error) {
        console.error("Erro ao buscar os dados da matrícula:", error);
    }
}

document.getElementById('matricula').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') buscarDadosColaborador();
});

// ============================================================================
// 2. FUNÇÃO: Muda os Atos Faltosos de acordo com o Grupo
// ============================================================================
function atualizarAtos() {
    const grupoId = document.getElementById('grupo').value;
    const selectAto = document.getElementById('ato_faltoso');

    selectAto.innerHTML = '<option value="">Selecione o Ato Faltoso...</option>';

    const atosDoGrupo = listaAtosFaltosos.filter(ato => ato.grupo_id == grupoId);

    atosDoGrupo.forEach(ato => {
        let opt = document.createElement('option');
        opt.value = ato.id;
        opt.innerHTML = `${ato.item} - ${ato.descricao_ato}`;
        selectAto.appendChild(opt);
    });

    document.getElementById('nova_gravidade').value = '';
    document.getElementById('proxima_acao').value = '';
    document.getElementById('descricao').value = '';
}

// ============================================================================
// 3. FUNÇÕES AUXILIARES
// ============================================================================
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function getCodigoDaMedida(nomeMedida) {
    if (!nomeMedida) return 0;
    const nome = nomeMedida.toUpperCase();
    if (nome.includes('1ª') || nome.includes('PRIMEIRA')) return 5;
    if (nome.includes('2ª') || nome.includes('SEGUNDA')) return 6;
    if (nome.includes('3ª') || nome.includes('TERCEIRA')) return 7;
    if (nome.includes('SUSPENSÃO')) return 8;
    if (nome.includes('JUSTA CAUSA')) return 9;
    return 0;
}

// FORMATADOR DE DATAS MÚLTIPLAS
function formatarMultiplasDatas(datasStr) {
    if (!datasStr) return "[DATA DO ATO]";

    const datas = datasStr.split(',').map(d => d.trim()).filter(d => d);
    if (datas.length === 0) return "[DATA DO ATO]";

    const grupos = {};
    datas.forEach(d => {
        const partes = d.split('/');
        if (partes.length === 3) {
            const dia = partes[0];
            const mes = partes[1];
            const chave = `${mes}`;
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(dia);
        }
    });

    const blocos = [];
    for (const mes in grupos) {
        const dias = grupos[mes].sort((a, b) => parseInt(a) - parseInt(b)).join(',');
        blocos.push(`${dias}/${mes}`);
    }

    return blocos.join(' - ');
}

// ============================================================================
// 4. FUNÇÃO: Motor de Progressão e Preenchimento de Textos (REGRAS NORMAIS)
// ============================================================================
function preencherDadosDoAto() {
    const atoId = document.getElementById('ato_faltoso').value;
    const dataAto = document.getElementById('data_ato_manual').value;
    const dataSuspensao = document.getElementById('data_suspensao').value;

    const grupoSelect = document.getElementById('grupo');
    const grupoTexto = grupoSelect.options[grupoSelect.selectedIndex] ? grupoSelect.options[grupoSelect.selectedIndex].text : '';

    if (!atoId) return;

    const atoEscolhido = listaAtosFaltosos.find(a => a.id == atoId);
    if (!atoEscolhido) return;

    let dataFormatada = formatarMultiplasDatas(dataAto);
    let dataSuspFormatada = dataSuspensao ? dataSuspensao.split('-').reverse().join('/') : "[DATA DA SUSPENSÃO]";

    let maxCodigo = 0;
    let qtdCodigo8 = 0;
    let qtdMedidas = historicoAtualColaborador.length;

    historicoAtualColaborador.forEach(m => {
        let cod = m.codigo_progressao ? parseInt(m.codigo_progressao) : getCodigoDaMedida(m.tipo_medida);
        if (cod > maxCodigo) maxCodigo = cod;
        if (cod === 8) qtdCodigo8++;
    });

    let gravidadeAto = atoEscolhido.gravidade.toUpperCase();
    let proximaAcao = '';
    let proximoCodigo = 0;

    if (gravidadeAto === 'CRÍTICA' || gravidadeAto === 'GRAVE' || qtdCodigo8 >= 2 || (maxCodigo === 8 && qtdMedidas >= 4)) {
        proximaAcao = 'JUSTA CAUSA';
        proximoCodigo = 9;
    } else if (maxCodigo === 8 && qtdMedidas < 4) {
        proximaAcao = 'SUSPENSÃO 1 DIA';
        proximoCodigo = 8;
    } else if (maxCodigo === 7 && qtdMedidas >= 3) {
        proximaAcao = 'SUSPENSÃO 1 DIA';
        proximoCodigo = 8;
    } else if (maxCodigo === 7 && qtdMedidas < 3) {
        proximaAcao = '3ª ADVERTÊNCIA';
        proximoCodigo = 7;
    } else if (maxCodigo === 6 && qtdMedidas >= 2) {
        proximaAcao = '3ª ADVERTÊNCIA';
        proximoCodigo = 7;
    } else if (maxCodigo === 6 && qtdMedidas < 2) {
        proximaAcao = '2ª ADVERTÊNCIA';
        proximoCodigo = 6;
    } else if (maxCodigo === 5) {
        proximaAcao = '2ª ADVERTÊNCIA';
        proximoCodigo = 6;
    } else {
        proximaAcao = '1ª ADVERTÊNCIA';
        proximoCodigo = 5;
    }

    document.getElementById('nova_gravidade').value = atoEscolhido.gravidade;
    document.getElementById('proxima_acao').value = proximaAcao;

    const inputCodigo = document.getElementById('codigo_progressao');
    if (inputCodigo) inputCodigo.value = proximoCodigo;

    const divSuspensao = document.getElementById('div-data-suspensao');
    const inputSuspensao = document.getElementById('data_suspensao');
    if (proximoCodigo === 8) {
        divSuspensao.style.display = 'block';
        inputSuspensao.required = true;
    } else {
        divSuspensao.style.display = 'none';
        inputSuspensao.required = false;
    }

    let textoIntroducao = "";
    if (proximoCodigo >= 5 && proximoCodigo <= 7) {
        textoIntroducao = `Este comunicado tem como objetivo conscientizá-lo(a) sobre a importância do cumprimento das normas e responsabilidades estabelecidas pela empresa, bem como alertá-lo(a) sobre as consequências previstas em caso de reincidência.\n\nNesta data, está sendo registrada sua advertência formal referente ao ato faltoso dia ${dataFormatada}, onde apresentou o desvio:`;
    } else if (proximoCodigo === 8) {
        textoIntroducao = `Pela presente notificação, após o registro de advertências formais, informamos que a partir de ${dataSuspFormatada}, você cumprirá suspensão das suas funções laborais pelo prazo de 01(UM DIA) útil de trabalho, por apresentar conduta em desacordo com o Manual de Conduta e Postura, onde na data do ato faltoso ${dataFormatada}, onde apresentou o desvio:`;
    } else if (proximoCodigo >= 9) {
        textoIntroducao = `ATENÇÃO: ESTE DOCUMENTO NÃO É VÁLIDO PARA A CONCRETIZAÇÃO DO DESLIGAMENTO!\n\nO colaborador(a) acumulou diversos atos desidiosos, não apresentando evolução na escala pedagógica. Desta forma, orientamos seguir com a abertura de chamado para Justa Causa com as devidas evidências e seu histórico disciplinar, presente neste relatório. Abaixo, segue descrição de novo ato faltoso cometido pelo mesmo, onde na data da ocorrência ${dataFormatada}, apresentou o desvio:`;
    }

    const corpoCompleto = `${textoIntroducao}\n\nGRUPO DE INFRAÇÃO DISCIPLINAR: ${grupoTexto}\n${atoEscolhido.item} - ${atoEscolhido.descricao_ato}\n\nQue diz respeito a:\n${atoEscolhido.descricao_observacao}`;

    const campoDescricao = document.getElementById('descricao');
    campoDescricao.value = corpoCompleto;
    autoResize(campoDescricao);
}

// ============================================================================
// 5. FUNÇÃO: GERADOR DE PDF JURÍDICO OFICIAL
// ============================================================================
function gerarTextoMedida() {
    const dataAtoValor = document.getElementById('data_ato_manual').value;

    if (!document.getElementById('form-medidas').checkValidity() || !dataAtoValor) {
        alert("⚠️ Por favor, preencha todos os campos obrigatórios (*) e selecione a Data do Ato Faltoso antes de gerar o PDF.");
        return;
    }

    const nome = document.getElementById('nome').value;
    const matricula = document.getElementById('matricula').value;
    const proximaAcao = document.getElementById('proxima_acao').value.toUpperCase();
    const textoOficialCorpo = document.getElementById('descricao').value;
    const primeiroGestor = document.getElementById('gestor_1').value || "Não Identificado";

    const dataAtual = new Date();
    const dataEmissaoFormatada = dataAtual.toLocaleDateString('pt-BR');
    const dataCienteFormatada = dataAtual.toLocaleDateString('pt-BR');

    const dataDozeMesesAtras = new Date();
    dataDozeMesesAtras.setMonth(dataDozeMesesAtras.getMonth() - 12);
    const textoMarcaDagua = `CONTEMPLADO: ${dataDozeMesesAtras.toLocaleDateString('pt-BR')} À ${dataCienteFormatada}`;

    const bodyTabelaHistorico = [];
    const nomeEmpresa = matricula.startsWith('100') ? 'YOUTILITY' : 'CONTAX';

    if (historicoAtualColaborador.length > 0) {
        bodyTabelaHistorico.push([{
                text: 'RE',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            },
            {
                text: 'NOME',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            },
            {
                text: 'OBSERVAÇÕES',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            },
            {
                text: 'VALIDADE',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            },
            {
                text: 'GRAVIDADE',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            },
            {
                text: 'CLIENTE',
                bold: true,
                fontSize: 7,
                fillColor: '#2c3e50',
                color: '#ffffff',
                alignment: 'center',
                margin: [0, 4, 0, 4]
            }
        ]);

        historicoAtualColaborador.forEach(m => {
            let dataValidadeExibida = '-';
            if (m.data_suspensao) {
                dataValidadeExibida = new Date(m.data_suspensao).toLocaleDateString('pt-BR');
            } else if (m.data_ato_faltoso) {
                dataValidadeExibida = new Date(m.data_ato_faltoso).toLocaleDateString('pt-BR');
            }

            bodyTabelaHistorico.push([{
                    text: m.matricula || '-',
                    fontSize: 6,
                    alignment: 'center',
                    margin: [0, 3, 0, 3]
                },
                {
                    text: m.nome || '-',
                    fontSize: 6,
                    alignment: 'center',
                    margin: [0, 3, 0, 3]
                },
                {
                    text: m.observacao || '-',
                    fontSize: 6,
                    alignment: 'justify',
                    margin: [0, 3, 0, 3]
                },
                {
                    text: dataValidadeExibida,
                    fontSize: 6,
                    alignment: 'center',
                    margin: [0, 3, 0, 3]
                },
                {
                    text: m.gravidade || '-',
                    fontSize: 6,
                    alignment: 'center',
                    margin: [0, 3, 0, 3]
                },
                {
                    text: m.cliente || '-',
                    fontSize: 6,
                    alignment: 'center',
                    margin: [0, 3, 0, 3]
                }
            ]);
        });
    } else {
        bodyTabelaHistorico.push([{
            text: 'HISTÓRICO DE MEDIDAS RECEBIDAS',
            bold: true,
            fontSize: 8,
            fillColor: '#f2f2f2',
            alignment: 'center'
        }]);
        bodyTabelaHistorico.push([{
            text: 'Sem medidas disciplinares nos últimos 12 meses',
            alignment: 'center',
            fontSize: 8,
            margin: [0, 5, 0, 5]
        }]);
    }

    const docDefinition = {
        pageMargins: [35, 35, 35, 35],

        background: function (currentPage) {
            return {
                text: textoMarcaDagua,
                color: '#eeeeee',
                opacity: 0.5,
                fontSize: 10,
                bold: true,
                alignment: 'center',
                margin: [0, 750, 0, 0]
            };
        },
        content: [{
                text: nomeEmpresa,
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 2]
            },
            {
                text: dataEmissaoFormatada,
                style: 'fonte_BXIHV_F1',
                alignment: 'left',
                margin: [0, 0, 0, 12]
            },
            {
                text: `NOME: ${nome.toUpperCase()}`,
                style: 'fonte_WEJKF_F2_9'
            },
            {
                text: `MATRÍCULA: ${matricula}`,
                style: 'fonte_WEJKF_F2_9',
                margin: [0, 0, 0, 15]
            },

            {
                text: proximaAcao,
                style: 'fonte_WEJKF_F2_12',
                alignment: 'center',
                margin: [0, 0, 0, 15]
            },

            {
                text: textoOficialCorpo,
                style: 'fonte_BXIHV_F1',
                alignment: 'justify',
                margin: [0, 0, 0, 15]
            },

            {
                text: 'Este registro possui caráter estritamente pedagógico e corretivo, visando orientá-lo(a) quanto à conduta profissional esperada no ambiente corporativo. Esclarecemos que a organização adota uma escala progressiva de medidas disciplinares (Advertência Progressiva -> Suspensão Laboral -> Rescisão Contratual por Justa Causa nos termos da CLT). O não cumprimento das readequações solicitadas ensejará a aplicação das próximas etapas da régua disciplinar vigente.',
                style: 'fonte_BXIHV_F1',
                alignment: 'justify',
                margin: [0, 0, 0, 15]
            },

            {
                text: `Ciente em: ${dataCienteFormatada}`,
                style: 'fonte_BXIHV_F1',
                margin: [0, 0, 0, 35]
            },

            {
                columns: [{
                        width: '*',
                        stack: [{
                            text: '\n\n',
                            fontSize: 15,
                            alignment: 'center'
                        }],
                        margin: [0, 0, 0, -10]
                    },
                    {
                        width: '*',
                        text: '\n',
                        margin: [0, 30, 0, 0]
                    }
                ]
            },
            {
                columns: [{
                        width: '*',
                        stack: [{
                                text: '_____________________________',
                                alignment: 'center',
                                color: '#aaaaaa'
                            },
                            {
                                text: 'ROBERTO BONINI',
                                bold: true,
                                fontSize: 8,
                                alignment: 'center',
                                margin: [0, 5, 0, 2]
                            },
                            {
                                text: 'Governança Corporativa',
                                style: 'fonte_JBPHL_F3_8',
                                alignment: 'center'
                            }
                        ]
                    },
                    {
                        width: '*',
                        stack: [{
                                text: '_____________________________',
                                alignment: 'center',
                                color: '#aaaaaa'
                            },
                            {
                                text: primeiroGestor.toUpperCase(),
                                bold: true,
                                fontSize: 7,
                                alignment: 'center',
                                margin: [0, 5, 0, 2]
                            },
                            {
                                text: 'Gestor Imediato',
                                style: 'fonte_JBPHL_F3_7',
                                alignment: 'center'
                            }
                        ]
                    }
                ],
                margin: [0, 0, 0, 30]
            },

            {
                text: historicoAtualColaborador.length > 0 ? 'RÉGUA DE PROGRESSÃO DISCIPLINAR E ACÚMULO DE MEDIDAS (ÚLTIMOS 12 MESES)' : '',
                style: 'fonte_WEJKF_F2_8',
                margin: [0, 10, 0, 5]
            },
            {
                table: {
                    headerRows: 1,
                    widths: historicoAtualColaborador.length > 0 ? ['12%', '18%', '*', '12%', '12%', '16%'] : ['*'],
                    body: bodyTabelaHistorico
                },
                layout: {
                    fillColor: function (rowIndex) {
                        return (rowIndex === 0) ? '#2c3e50' : (rowIndex % 2 === 0) ? '#f2f6f9' : '#ffffff';
                    },
                    hLineWidth: function (i, node) {
                        return (i === 0 || i === node.table.body.length) ? 1 : 0.5;
                    },
                    vLineWidth: function () {
                        return 0;
                    },
                    hLineColor: function () {
                        return '#bdc3c7';
                    },
                }
            }
        ],
        styles: {
            fonte_BXIHV_F1: {
                fontSize: 7,
                lineHeight: 1.2
            },
            fonte_WEJKF_F2_8: {
                fontSize: 8,
                bold: true
            },
            fonte_WEJKF_F2_9: {
                fontSize: 9,
                bold: true
            },
            fonte_WEJKF_F2_12: {
                fontSize: 12,
                bold: true,
                decoration: 'underline'
            },
            fonte_JBPHL_F3_7: {
                fontSize: 7,
                color: '#333333'
            },
            fonte_JBPHL_F3_8: {
                fontSize: 8,
                color: '#333333'
            }
        }
    };

    pdfMake.createPdf(docDefinition).download(`Medida_Disciplinar_${matricula}.pdf`);
}

// ============================================================================
// 6. FUNÇÃO: Carregar a tabela de Histórico Específico
// ============================================================================
async function carregarHistoricoMedidas(matriculaParaBuscar) {
    const tbody = document.getElementById('lista-medidas-body');
    historicoAtualColaborador = [];

    if (!matriculaParaBuscar || matriculaParaBuscar === 'invalida') {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5);">Digite uma matrícula no formulário acima para consultar o histórico do colaborador.</td></tr>`;
        document.getElementById('volume_medidas').value = 0;
        return;
    }

    try {
        const response = await fetch(`/api/medidas/lista?matricula=${matriculaParaBuscar}`);

        if (response.ok) {
            const medidas = await response.json();

            const dataHoje = new Date();
            const limite12Meses = new Date();
            limite12Meses.setMonth(dataHoje.getMonth() - 12);
            limite12Meses.setHours(0, 0, 0, 0);

            let medidasValidas = medidas.filter(m => {
                if (!m.data_ato_faltoso) return false;
                const dataMedida = new Date(m.data_ato_faltoso);
                return dataMedida >= limite12Meses;
            });

            medidasValidas.sort((a, b) => new Date(a.data_ato_faltoso) - new Date(b.data_ato_faltoso));

            historicoAtualColaborador = medidasValidas;
            document.getElementById('volume_medidas').value = medidasValidas.length;

            if (medidasValidas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #28a745;">Nenhuma medida disciplinar anterior encontrada (nos últimos 12 meses). Ficha limpa!</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            medidasValidas.forEach(medida => {
                const tr = document.createElement('tr');

                let dataValidadeExibida = '-';
                if (medida.data_suspensao) {
                    dataValidadeExibida = new Date(medida.data_suspensao).toLocaleDateString('pt-BR');
                } else if (medida.data_ato_faltoso) {
                    dataValidadeExibida = new Date(medida.data_ato_faltoso).toLocaleDateString('pt-BR');
                }

                tr.innerHTML = `
                            <td>${medida.matricula || '-'}</td>
                            <td>${medida.nome || '-'}</td>
                            <td>${medida.observacao || '-'}</td>
                            <td>${dataValidadeExibida}</td>
                            <td>${medida.gravidade || '-'}</td>
                            <td>${medida.cliente || '-'}</td>
                        `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc3545;">Erro ao carregar o histórico.</td></tr>`;
    }
}

// ============================================================================
// 7. EVENTOS DE INICIALIZAÇÃO E SUBMIT
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    const divClose = document.querySelector('.close');
    if (divClose) {
        divClose.addEventListener('click', function () {
            window.location.href = '/index.html#navegar'; // Altere para a rota do seu menu anterior se necessário
        });
    }

    // 1. REGRAS DA DATA DO ATO FALTOSO (Flatpickr)
    flatpickr("#data_ato_manual", {
        mode: "multiple",
        dateFormat: "d/m/Y",
        locale: "pt",
        maxDate: "today", // Bloqueia datas futuras
        onReady: function (selectedDates, dateStr, instance) {
            instance.input.removeAttribute('readonly');
        },
        onChange: function (selectedDates, dateStr, instance) {
            if (typeof preencherDadosDoAto === 'function') preencherDadosDoAto();
        }
    });

    // 2. REGRAS DA DATA DE SUSPENSÃO (Bloqueia hoje e passado)
    const inputSuspensao = document.getElementById('data_suspensao');
    if (inputSuspensao) {
        const dataAmanha = new Date();
        dataAmanha.setDate(dataAmanha.getDate() + 1);

        const ano = dataAmanha.getFullYear();
        const mes = String(dataAmanha.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAmanha.getDate()).padStart(2, '0');
        inputSuspensao.setAttribute('min', `${ano}-${mes}-${dia}`);
    }

    carregarHistoricoMedidas('');

    // Carrega a base de Atos
    try {
        const resAtos = await fetch('/api/medidas/atos-faltosos');
        if (resAtos.ok) listaAtosFaltosos = await resAtos.json();
    } catch (e) {
        console.error("Erro ao carregar atos da base de dados.");
    }

    // Verifica o Login e PERMISSÕES DE ADMIN
    try {
        const resUser = await fetch('/api/auth/me');
        const userData = await resUser.json();

        if (userData.logado) {
            // Preenche o nome lá no topo da tela com o username
            document.getElementById('usuario-logado').textContent = userData.nome;

            // 🔥 SE FOR ADMIN, EXIBE O BOTÃO ESPECIAL DE QUEBRA DE FLUXO
            if (userData.perfil === 'admin') {
                const btnQuebrar = document.getElementById('btn-quebrar');
                if (btnQuebrar) btnQuebrar.style.display = 'inline-block';
            }
        } else {
            document.getElementById('usuario-logado').textContent = 'Visitante (Não logado)';
        }
    } catch (e) {
        console.warn("Servidor de autenticação offline.");
    }

    // ==========================================================
    // LÓGICA DO BOTÃO ESPECIAL "QUEBRA DE FLUXO" (SÓ ADMIN)
    // ==========================================================
    const btnQuebrar = document.getElementById('btn-quebrar');
    if (btnQuebrar) {
        btnQuebrar.addEventListener('click', () => {
            if (historicoAtualColaborador.length === 0) {
                alert("Não é possível gerar quebra de fluxo: o colaborador não possui medidas anteriores.");
                return;
            }

            const atoId = document.getElementById('ato_faltoso').value;
            if (!atoId) {
                alert("⚠️ Por favor, selecione primeiro o Ato Faltoso na caixa de seleção.");
                return;
            }

            // Descobre qual foi o último código aplicado
            let maxCodigo = 0;
            historicoAtualColaborador.forEach(m => {
                let cod = m.codigo_progressao ? parseInt(m.codigo_progressao) : getCodigoDaMedida(m.tipo_medida);
                if (cod > maxCodigo) maxCodigo = cod;
            });

            // Define o próximo código igual ao anterior (Exceção à Regra)
            let proximoCodigo = maxCodigo;
            let proximaAcao = '';

            // Mapeia o código de volta para o texto da ação
            if (proximoCodigo >= 9) proximaAcao = 'JUSTA CAUSA';
            else if (proximoCodigo === 8) proximaAcao = 'SUSPENSÃO 1 DIA';
            else if (proximoCodigo === 7) proximaAcao = '3ª ADVERTÊNCIA';
            else if (proximoCodigo === 6) proximaAcao = '2ª ADVERTÊNCIA';
            else if (proximoCodigo <= 5) proximaAcao = '1ª ADVERTÊNCIA';

            document.getElementById('proxima_acao').value = proximaAcao;

            const inputCodigo = document.getElementById('codigo_progressao');
            if (inputCodigo) inputCodigo.value = proximoCodigo;

            // Ajusta o campo de suspensão caso o código anterior tenha sido 8
            const divSuspensao = document.getElementById('div-data-suspensao');
            const inputSuspensaoAtiva = document.getElementById('data_suspensao');
            if (proximoCodigo === 8) {
                divSuspensao.style.display = 'block';
                inputSuspensaoAtiva.required = true;
            } else {
                divSuspensao.style.display = 'none';
                inputSuspensaoAtiva.required = false;
                inputSuspensaoAtiva.value = '';
            }

            alert(`⚠️ Quebra de fluxo ativada!\nO sistema regrediu a punição e repetirá a medida: ${proximaAcao}`);

            // Refaz a caixa de texto oficial atualizando os parágrafos para refletir a nova medida "quebrada"
            const dataAto = document.getElementById('data_ato_manual').value;
            const dataSuspensaoVal = inputSuspensaoAtiva.value;
            let dataFormatada = formatarMultiplasDatas(dataAto);
            let dataSuspFormatada = dataSuspensaoVal ? dataSuspensaoVal.split('-').reverse().join('/') : "[DATA DA SUSPENSÃO]";

            let textoIntroducao = "";
            if (proximoCodigo >= 5 && proximoCodigo <= 7) {
                textoIntroducao = `Este comunicado tem como objetivo conscientizá-lo(a) sobre a importância do cumprimento das normas e responsabilidades estabelecidas pela empresa, bem como alertá-lo(a) sobre as consequências previstas em caso de reincidência.\n\nNesta data, está sendo registrada sua advertência formal referente ao ato faltoso dia ${dataFormatada}, onde apresentou o desvio:`;
            } else if (proximoCodigo === 8) {
                textoIntroducao = `Pela presente notificação, após o registro de advertências formais, informamos que a partir de ${dataSuspFormatada}, você cumprirá suspensão das suas funções laborais pelo prazo de 01(UM DIA) útil de trabalho, por apresentar conduta em desacordo com o Manual de Conduta e Postura, onde na data do ato faltoso ${dataFormatada}, onde apresentou o desvio:`;
            } else if (proximoCodigo >= 9) {
                textoIntroducao = `ATENÇÃO: ESTE DOCUMENTO NÃO É VÁLIDO PARA A CONCRETIZAÇÃO DO DESLIGAMENTO!\n\nO colaborador(a) acumulou diversos atos desidiosos, não apresentando evolução na escala pedagógica. Desta forma, orientamos seguir com a abertura de chamado para Justa Causa com as devidas evidências e seu histórico disciplinar, presente neste relatório. Abaixo, segue descrição de novo ato faltoso cometido pelo mesmo, onde na data da ocorrência ${dataFormatada}, apresentou o desvio:`;
            }

            const grupoSelect = document.getElementById('grupo');
            const grupoTexto = grupoSelect.options[grupoSelect.selectedIndex] ? grupoSelect.options[grupoSelect.selectedIndex].text : '';
            const atoEscolhido = listaAtosFaltosos.find(a => a.id == atoId);

            if (atoEscolhido) {
                const corpoCompleto = `${textoIntroducao}\n\nGRUPO DE INFRAÇÃO DISCIPLINAR: ${grupoTexto}\n${atoEscolhido.item} - ${atoEscolhido.descricao_ato}\n\nQue diz respeito a:\n${atoEscolhido.descricao_observacao}`;
                const campoDescricao = document.getElementById('descricao');
                campoDescricao.value = corpoCompleto;
                autoResize(campoDescricao);
            }
        });
    }

    // ==========================================================
    // LÓGICA DO BOTÃO SALVAR FORMULÁRIO (Submissão)
    // ==========================================================
    document.getElementById('form-medidas').addEventListener('submit', async (e) => {
        e.preventDefault();

        const dataAtoValor = document.getElementById('data_ato_manual').value;
        if (!dataAtoValor) {
            alert("⚠️ A Data do Ato Faltoso é obrigatória!");
            return;
        }

        const form = e.target;

        // Pega de forma inteligente o verdadeiro botão que originou o Submit (geralmente "Salvar")
        const btnSalvar = e.submitter || form.querySelector('button[type="submit"]');
        const textoOriginalBotao = btnSalvar ? btnSalvar.textContent : 'A guardar...';

        if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.textContent = "A guardar no sistema...";
        }

        const msgRetorno = document.getElementById('mensagem-retorno');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        msgRetorno.textContent = "";

        try {
            const response = await fetch('/api/medidas/nova', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const resultado = await response.json();

            if (response.ok && resultado.sucesso) {
                msgRetorno.className = "sucesso";
                msgRetorno.textContent = "✅ Medida disciplinar registrada com sucesso!";

                const matriculaSalva = document.getElementById('matricula').value;
                form.reset();
                atualizarAtos();
                carregarHistoricoMedidas(matriculaSalva);
            } else {
                msgRetorno.className = "erro";
                msgRetorno.textContent = "Erro: " + (resultado.mensagem || "Não foi possível gravar.");
            }
        } catch (error) {
            msgRetorno.className = "erro";
            msgRetorno.textContent = "Erro de ligação. Verifique se o servidor Node.js está a correr.";
        } finally {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.textContent = textoOriginalBotao;
            }
        }
    });
});