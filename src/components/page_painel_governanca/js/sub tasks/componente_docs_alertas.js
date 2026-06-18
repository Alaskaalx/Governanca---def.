// ============================================================================
// LÓGICA DE CÁLCULO DE TEMPO (Substitui o date-fns do React)
// ============================================================================
function calcularTempoRestante(dataExpiracaoStr) {
    const expiresAt = new Date(dataExpiracaoStr);
    const now = new Date();
    const isExpired = expiresAt < now;
    
    // Diferença em segundos
    let diff = Math.abs(expiresAt.getTime() - now.getTime()) / 1000;

    const years = Math.floor(diff / (365.25 * 24 * 3600));
    diff -= years * 365.25 * 24 * 3600;
    
    const months = Math.floor(diff / (30.44 * 24 * 3600));
    diff -= months * 30.44 * 24 * 3600;
    
    const weeks = Math.floor(diff / (7 * 24 * 3600));
    diff -= weeks * 7 * 24 * 3600;
    
    const days = Math.floor(diff / (24 * 3600));
    diff -= days * 24 * 3600;
    
    const hours = Math.floor(diff / 3600);
    diff -= hours * 3600;
    
    const minutes = Math.floor(diff / 60);
    diff -= minutes * 60;
    
    const seconds = Math.floor(diff);

    return { isExpired, timeLeft: { years, months, weeks, days, hours, minutes, seconds } };
}

function formatarTempo(n) {
    return n.toString().padStart(2, '0');
}

function formatarCountdown(timeLeft, isExpired) {
    const prefix = isExpired ? '-' : '';

    if (timeLeft.years > 0) return `${prefix}${timeLeft.years}a ${timeLeft.months}m ${timeLeft.weeks}s`;
    if (timeLeft.months > 0) return `${prefix}${timeLeft.months}m ${timeLeft.weeks}s ${timeLeft.days}d`;
    if (timeLeft.weeks > 0) return `${prefix}${timeLeft.weeks}s ${timeLeft.days}d ${formatarTempo(timeLeft.hours)}h`;
    if (timeLeft.days > 0) return `${prefix}${timeLeft.days}d ${formatarTempo(timeLeft.hours)}:${formatarTempo(timeLeft.minutes)}`;
    
    return `${prefix}${formatarTempo(timeLeft.hours)}:${formatarTempo(timeLeft.minutes)}:${formatarTempo(timeLeft.seconds)}`;
}

// ============================================================================
// CONSTRUTOR DO CARD DE ALERTA (Substitui o Componente React)
// ============================================================================
function obterConfigStatus(status) {
    const configs = {
        'Elaboração': { icon: 'fa-file-signature', classe: 'badge-elaboracao' },
        'Aguardando aprovação': { icon: 'fa-clock', classe: 'badge-aguardando' },
        'Pendente de publicação': { icon: 'fa-paper-plane', classe: 'badge-pendente' },
        'Publicada': { icon: 'fa-check-circle', classe: 'badge-publicada' }
    };
    return configs[status] || { icon: 'fa-info-circle', classe: '' };
}

/**
 * Cria um elemento HTML do Card de Alerta e inicia o relógio automático
 * @param {Object} tarefa - Os dados do documento
 * @param {Function} onEdit - Função disparada ao clicar em editar/renovar
 * @param {Function} onDelete - Função disparada ao clicar em excluir
 * @returns {HTMLElement} O Card pronto para ser injetado na tela
 */
function gerarCartaoAlerta(tarefa, onEdit, onDelete) {
    const card = document.createElement('div');
    card.className = `alerta-card`;
    
    const dataCriacao = tarefa.createdAt || new Date().toISOString();
    const dataCriacaoFormatada = new Date(dataCriacao).toLocaleDateString('pt-BR');
    const dataValidadeFormatada = new Date(tarefa.expiresAt).toLocaleDateString('pt-BR');
    
    const configStatus = obterConfigStatus(tarefa.status);
    const linkIcon = tarefa.link ? `<a href="${tarefa.link}" target="_blank" class="button small icon solid fa-external-link-alt" style="padding: 0 0.5rem; background: transparent;"></a>` : '';

    // Garante que o histórico existe (caso venha vazio)
    const logs = tarefa.historico || [{ data: dataCriacaoFormatada, acao: "Documento cadastrado no sistema.", arquivo: tarefa.arquivoNome || 'Nenhum' }];

    // Monta o HTML das linhas do histórico de versão
    const htmlHistorico = logs.map(log => {
        // Só mostra o botão se existir um arquivo e um ID válido no banco
        const btnDownload = (log.arquivo !== 'Nenhum' && log.idHistorico) 
            ? `<a href="/api/governanca/download/${log.idHistorico}" target="_blank" class="button primary small" style="padding: 0 0.5rem; height: 1.5rem; line-height: 1.5rem; font-size: 0.8em; margin-left: 10px; background-color: #3b82f6;"><i class="icon solid fa-download"></i> Baixar</a>` 
            : '';

        return `
        <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: rgba(255,255,255,0.8); line-height: 1.4;">
            <span style="color: #fbbf24; font-weight: bold; font-family: monospace;">[${log.data}]</span> - ${log.acao} <br/>
            <span style="color: rgba(255,255,255,0.6); font-size: 0.85em; display: flex; align-items: center;">
                <i class="icon solid fa-paperclip" style="margin-right: 5px;"></i> Arquivo desta versão: <strong style="margin: 0 5px;">${log.arquivo}</strong> ${btnDownload}
            </span>
        </div>
        `;
    }).join('');

    // Estrutura Base do HTML do Card Atualizado
    card.innerHTML = `
        <div class="alerta-info" style="flex: 1; min-width: 300px;">
            <h4>${tarefa.text} ${linkIcon}</h4>
            <div class="alerta-detalhes">
                Tipo: <strong>${tarefa.tipoDocumento}</strong>
                Área: <strong>${tarefa.areaResponsavel}</strong>
            </div>
            
            <div style="font-size: 0.85em; margin-bottom: 0.8rem; color: rgba(255,255,255,0.7);">
                <i class="icon solid fa-paperclip" style="color: #22c55e;"></i> Anexo atual: <strong style="color: #fff;">${tarefa.arquivoNome || 'Nenhum arquivo anexado'}</strong>
            </div>

            <span class="badge ${configStatus.classe}">
                <i class="icon solid ${configStatus.icon}"></i> ${tarefa.status}
            </span>
        </div>

        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
            <div class="alerta-timer-box">
                <div class="countdown-display">Calculando...</div>
                <div style="font-size: 0.75em; margin-top: 5px; color: rgba(255,255,255,0.5);">Validade: ${dataValidadeFormatada}</div>
            </div>

            <div class="alerta-acoes">
                <button class="button primary small icon solid fa-sync-alt btn-renovar" style="background-color: #22c55e; box-shadow: none;">Renovar</button>
                <button class="button small icon solid fa-pen btn-editar">Editar</button>
                <button class="button small icon solid fa-trash btn-excluir" style="background-color: #ef4444; color: white; box-shadow: none;">Excluir</button>
            </div>
        </div>

        <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 1rem; padding-top: 0.5rem;">
            <button class="button small btn-toggle-historico" style="height: 2em; line-height: 2em; padding: 0 0.5rem; background: transparent; box-shadow: none; color: rgba(255,255,255,0.6);">
                <i class="icon solid fa-history"></i> Histórico de Alterações (${logs.length}) <i class="icon solid fa-chevron-down" style="font-size: 0.8em; margin-left: 5px;"></i>
            </button>
            <div class="historico-lista" style="display: none; margin-top: 0.75rem; background: rgba(0,0,0,0.25); padding: 1rem; border-radius: 6px; font-size: 0.85em; max-height: 180px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.05);">
                ${htmlHistorico}
            </div>
        </div>
    `;

    // Lógica do Relógio ao vivo
    const timerDisplay = card.querySelector('.countdown-display');
    const timerBox = card.querySelector('.alerta-timer-box');

    function atualizarRelogio() {
        const { isExpired, timeLeft } = calcularTempoRestante(tarefa.expiresAt);
        const mesesRestantes = timeLeft.years * 12 + timeLeft.months;
        timerDisplay.innerText = formatarCountdown(timeLeft, isExpired);
        timerDisplay.classList.remove('timer-ok', 'timer-alerta', 'timer-critico');
        timerBox.classList.remove('perigo');
        card.classList.remove('expirado');

        if (isExpired) {
            timerDisplay.classList.add('timer-critico');
            timerBox.classList.add('perigo');
            card.classList.add('expirado');
        } else if (mesesRestantes < 3 && timeLeft.years === 0) {
            timerDisplay.classList.add('timer-alerta');
        } else {
            timerDisplay.classList.add('timer-ok');
        }
    }

    atualizarRelogio();
    const intervalo = setInterval(atualizarRelogio, 1000);

    // Evento de abrir/fechar o histórico (Aba colapsável)
    const btnToggle = card.querySelector('.btn-toggle-historico');
    const listaHistorico = card.querySelector('.historico-lista');
    btnToggle.addEventListener('click', () => {
        const estaAberto = listaHistorico.style.display === 'block';
        listaHistorico.style.display = estaAberto ? 'none' : 'block';
        btnToggle.querySelector('.fa-chevron-down, .fa-chevron-up').className = estaAberto ? 'icon solid fa-chevron-down' : 'icon solid fa-chevron-up';
    });

    card.querySelector('.btn-renovar').addEventListener('click', onEdit);
    card.querySelector('.btn-editar').addEventListener('click', onEdit);
    card.querySelector('.btn-excluir').addEventListener('click', () => {
        if(confirm(`Esta ação não pode ser desfeita. Deseja excluir permanentemente o documento "${tarefa.text}"?`)) {
            clearInterval(intervalo);
            onDelete();
        }
    });

    return card;
}