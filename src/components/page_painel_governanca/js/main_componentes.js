document.addEventListener('DOMContentLoaded', function () {

    // =======================================================
    // INICIALIZAÇÃO E CONFIGURAÇÕES
    // =======================================================
    flatpickr(".flatpickr-date", {
        locale: "pt",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        allowInput: true,
        disableMobile: "true"
    });

    // =======================================================
    // ATUALIZAÇÃO VISUAL DOS BOTÕES DE ARQUIVO
    // =======================================================
    const inputAddArquivo = document.getElementById('doc-arquivo');
    const displayAddNome = document.getElementById('doc-arquivo-nome-display');

    if (inputAddArquivo && displayAddNome) {
        inputAddArquivo.addEventListener('change', function () {
            if (this.files.length > 0) {
                displayAddNome.innerHTML = `<i class="fa fa-paperclip" style="color: #22c55e;"></i> ${this.files[0].name}`;
            } else {
                displayAddNome.innerText = "Nenhum arquivo selecionado";
            }
        });
    }

    const inputEditArquivo = document.getElementById('edit-arquivo');
    const displayEditNome = document.getElementById('edit-arquivo-nome-display');

    if (inputEditArquivo && displayEditNome) {
        inputEditArquivo.addEventListener('change', function () {
            if (this.files.length > 0) {
                displayEditNome.innerHTML = `<i class="fa fa-paperclip" style="color: #22c55e;"></i> ${this.files[0].name}`;
            } else {
                displayEditNome.innerText = "Nenhum arquivo selecionado";
            }
        });
    }

    // =======================================================
    // LÓGICA DO MENU
    // =======================================================
    const menuLinks = document.querySelectorAll('.menu-link');
    const sections = document.querySelectorAll('.content-section');
    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            menuLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-section'));
            this.classList.add('active');
            const targetId = this.getAttribute('data-target');
            if (targetId) {
                document.getElementById(targetId).classList.add('active-section');
            }
        });
    });

    // =======================================================
    // LÓGICA DA TABELA E FILTROS
    // =======================================================
    let tarefas = [];

    const formAdd = document.getElementById('form-add-doc');
    const formEdit = document.getElementById('form-edit-doc');
    const areaAlertas = document.getElementById('area-de-alertas');
    const modalEditar = document.getElementById('modal-editar');

    const filterTipo = document.getElementById('filter-tipo');
    const filterArea = document.getElementById('filter-area');
    const filterStatus = document.getElementById('filter-status');

    function atualizarSelectsDeFiltro() {
        const tiposUnicos = [...new Set(tarefas.map(t => t.tipoDocumento).filter(Boolean))].sort();
        const areasUnicas = [...new Set(tarefas.map(t => t.areaResponsavel).filter(Boolean))].sort();

        if (filterTipo) {
            filterTipo.innerHTML = '<option value="all">Todos os Tipos</option>';
            tiposUnicos.forEach(tipo => filterTipo.innerHTML += `<option value="${tipo}">${tipo}</option>`);
        }
        if (filterArea) {
            filterArea.innerHTML = '<option value="all">Todas as Áreas</option>';
            areasUnicas.forEach(area => filterArea.innerHTML += `<option value="${area}">${area}</option>`);
        }
    }

    function ordenarTarefas(lista) {
        const agora = new Date().setHours(0, 0, 0, 0);
        return lista.sort((a, b) => {
            const dataA = new Date(a.expiresAt).getTime();
            const dataB = new Date(b.expiresAt).getTime();
            const aVencida = dataA < agora;
            const bVencida = dataB < agora;
            if (aVencida && !bVencida) return -1;
            if (!aVencida && bVencida) return 1;
            return dataA - dataB;
        });
    }

    function renderizarTabela() {
        if (!areaAlertas) return;

        let filtradas = tarefas.filter(t => {
            const matchTipo = !filterTipo || filterTipo.value === 'all' || t.tipoDocumento === filterTipo.value;
            const matchArea = !filterArea || filterArea.value === 'all' || t.areaResponsavel === filterArea.value;
            const matchStatus = !filterStatus || filterStatus.value === 'all' || t.status === filterStatus.value;
            return matchTipo && matchArea && matchStatus;
        });

        const ordenadas = ordenarTarefas(filtradas);
        areaAlertas.innerHTML = '';

        if (ordenadas.length === 0) {
            areaAlertas.innerHTML = `<div style="text-align: center; padding: 2rem; background: rgba(0,0,0,0.05); border-radius: 8px;">Nenhum documento encontrado.</div>`;
            return;
        }

        ordenadas.forEach(tarefa => {
            // Usa a função rica gerada pelo arquivo 'componente_docs_alertas.js'
            const cardElemento = window.gerarCartaoAlerta(
                tarefa,
                () => abrirModalEdicao(tarefa.id),
                () => deletarDocumento(tarefa.id)
            );
            areaAlertas.appendChild(cardElemento);
        });
    }

    // =======================================================
    // COMUNICAÇÃO COM O BANCO DE DADOS
    // =======================================================
    async function carregarDocumentosDoBanco() {
        try {
            const resposta = await fetch('/api/governanca/documentos');
            if (!resposta.ok) throw new Error('Erro ao buscar documentos');

            const dados = await resposta.json();
            tarefas = dados;

            atualizarSelectsDeFiltro();
            renderizarTabela();
        } catch (error) {
            console.error("Falha na conexão com a base de dados:", error);
            if (areaAlertas) {
                areaAlertas.innerHTML = `<div style="text-align: center; color: #ff4d4d; padding: 2rem; background: rgba(255,0,0,0.1); border-radius: 8px;">Erro ao carregar os documentos. Verifique a conexão com o servidor.</div>`;
            }
        }
    }

    // =======================================================
    // EXECUÇÃO INICIAL (CARREGAMENTO DA PÁGINA)
    // =======================================================
    carregarDocumentosDoBanco();
    
    // Chama a função exportada pelo 'componente_looker_studio.js'
    if(typeof window.carregarDashboardLooker === 'function') {
        window.carregarDashboardLooker();
    }

    // =======================================================
    // AÇÕES (CRIAR, EDITAR, EXCLUIR)
    // =======================================================
    if (formAdd) {
        formAdd.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btnAdd = formAdd.querySelector('button[type="submit"]');
            const textoOriginalBtn = btnAdd.innerHTML;
            btnAdd.innerHTML = '<i class="icon solid fa-sync-alt fa-spin"></i> Salvando...';
            btnAdd.disabled = true;

            const formData = new FormData();
            formData.append('nome', document.getElementById('doc-nome').value);
            formData.append('link', document.getElementById('doc-link').value);
            formData.append('tipoDocumento', document.getElementById('doc-tipo').value);
            formData.append('areaResponsavel', document.getElementById('doc-area').value);
            formData.append('expiresAt', document.getElementById('doc-data').value);
            formData.append('status', document.getElementById('doc-status').value);

            if (inputAddArquivo.files.length > 0) {
                formData.append('arquivo', inputAddArquivo.files[0]);
            }

            try {
                const resposta = await fetch('/api/governanca/documentos', {
                    method: 'POST',
                    body: formData
                });

                if (resposta.ok) {
                    formAdd.reset();
                    displayAddNome.innerText = "Nenhum arquivo selecionado";
                    alert('Sucesso! Documento salvo e arquivo armazenado!');
                    carregarDocumentosDoBanco();
                } else {
                    alert('Erro ao salvar no servidor. Verifique o console.');
                }
            } catch (error) {
                console.error('Erro de Rede:', error);
                alert('Erro de comunicação com o backend.');
            } finally {
                btnAdd.innerHTML = textoOriginalBtn;
                btnAdd.disabled = false;
            }
        });
    }

    async function deletarDocumento(id) {
        try {
            const resposta = await fetch(`/api/governanca/documentos/${id}`, {
                method: 'DELETE'
            });

            if (resposta.ok) {
                alert('Documento excluído com sucesso!');
                carregarDocumentosDoBanco();
            } else {
                alert('Erro ao excluir o documento no servidor.');
            }
        } catch (error) {
            console.error('Erro de Rede:', error);
            alert('Erro de comunicação. O servidor backend está ligado?');
        }
    }

    function abrirModalEdicao(id) {
        const tarefa = tarefas.find(t => t.id === id);
        if (!tarefa) return;

        document.getElementById('edit-id').value = tarefa.id;
        document.getElementById('edit-nome').value = tarefa.text || tarefa.nome || '';
        document.getElementById('edit-link').value = tarefa.link || '';
        document.getElementById('edit-tipo').value = tarefa.tipoDocumento || '';
        document.getElementById('edit-area').value = tarefa.areaResponsavel || '';
        document.getElementById('edit-data').value = tarefa.expiresAt || '';
        document.getElementById('edit-status').value = tarefa.status || '';

        inputEditArquivo.value = '';
        displayEditNome.innerText = "Nenhum arquivo selecionado";

        if (modalEditar) modalEditar.style.display = 'flex';
    }

    const btnFecharModal = document.getElementById('btn-fechar-modal');
    if (btnFecharModal && modalEditar) {
        btnFecharModal.addEventListener('click', () => {
            modalEditar.style.display = 'none';
        });
    }

    if (formEdit) {
        formEdit.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btnSalvarEdicao = document.getElementById('btn-salvar-edicao');
            const textoOriginal = btnSalvarEdicao.innerHTML;
            btnSalvarEdicao.innerHTML = '<i class="icon solid fa-sync-alt fa-spin"></i> Gravando Versão...';
            btnSalvarEdicao.disabled = true;

            const id = document.getElementById('edit-id').value;
            const tarefaAntiga = tarefas.find(t => t.id == id);

            const novoNome = document.getElementById('edit-nome').value;
            const novoLink = document.getElementById('edit-link').value;
            const novoTipo = document.getElementById('edit-tipo').value;
            const novaArea = document.getElementById('edit-area').value;
            const novaData = document.getElementById('edit-data').value;
            const novoStatus = document.getElementById('edit-status').value;
            const houveNovoArquivo = inputEditArquivo.files.length > 0;

            let mudancas = [];
            const nomeAntigo = tarefaAntiga.text || tarefaAntiga.nome;
            if (nomeAntigo !== novoNome) mudancas.push(`Nome alterado`);
            if (tarefaAntiga.status !== novoStatus) mudancas.push(`Status modificado para "${novoStatus}"`);
            if (tarefaAntiga.expiresAt !== novaData) mudancas.push(`Nova validade`);
            if (tarefaAntiga.areaResponsavel !== novaArea) mudancas.push(`Área alterada`);
            if (tarefaAntiga.tipoDocumento !== novoTipo) mudancas.push(`Tipo alterado`);
            if (houveNovoArquivo) mudancas.push(`Nova versão de arquivo submetida`);

            const acaoTextoLog = mudancas.length > 0 ? mudancas.join(' | ') : "Documento atualizado sem alterações críticas.";

            const formData = new FormData();
            formData.append('nome', novoNome);
            formData.append('link', novoLink);
            formData.append('tipoDocumento', novoTipo);
            formData.append('areaResponsavel', novaArea);
            formData.append('expiresAt', novaData);
            formData.append('status', novoStatus);
            formData.append('acaoLog', acaoTextoLog);
            formData.append('arquivoAtualNome', tarefaAntiga.arquivoNome || '');
            formData.append('arquivoAtualCaminho', tarefaAntiga.arquivoCaminho || '');

            if (houveNovoArquivo) {
                formData.append('arquivo', inputEditArquivo.files[0]);
            }

            try {
                const resposta = await fetch(`/api/governanca/documentos/${id}`, {
                    method: 'PUT',
                    body: formData
                });

                if (resposta.ok) {
                    modalEditar.style.display = 'none';
                    alert('Versão atualizada com sucesso!');
                    carregarDocumentosDoBanco();
                } else {
                    alert('Erro ao atualizar documento no servidor.');
                }
            } catch (error) {
                alert('Erro de comunicação com o servidor.');
            } finally {
                btnSalvarEdicao.innerHTML = textoOriginal;
                btnSalvarEdicao.disabled = false;
            }
        });
    }

    // =======================================================
    // EVENTOS DE FILTRO E EXPORTAÇÃO
    // =======================================================
    if (filterTipo) filterTipo.addEventListener('change', renderizarTabela);
    if (filterArea) filterArea.addEventListener('change', renderizarTabela);
    if (filterStatus) filterStatus.addEventListener('change', renderizarTabela);

    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', () => {
            if (filterTipo) filterTipo.value = 'all';
            if (filterArea) filterArea.value = 'all';
            if (filterStatus) filterStatus.value = 'all';
            renderizarTabela();
        });
    }

    const btnExportarPdf = document.getElementById('btn-exportar-pdf');
    if (btnExportarPdf) {
        btnExportarPdf.addEventListener('click', () => {
            window.print();
        });
    }
});