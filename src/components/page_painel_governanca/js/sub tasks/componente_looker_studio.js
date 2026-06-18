// ============================================================================
// LÓGICA DO DASHBOARD LOOKER STUDIO
// ============================================================================

/**
 * Busca o link salvo no banco de dados e carrega no iframe e no input
 */
async function carregarDashboardLooker() {
    try {
        const response = await fetch('/api/governanca/configuracoes/looker');
        const data = await response.json();

        if (data.link) {
            const iframe = document.getElementById('iframe-looker');
            const input = document.getElementById('input-looker-link');
            if (iframe) iframe.src = data.link;
            if (input) input.value = data.link;
        }
    } catch (error) {
        console.error('Erro ao carregar o dashboard do Looker Studio:', error);
    }
}

/**
 * Salva o novo link de Embed (disparado pelo botão no HTML)
 */
window.salvarNovoLinkLooker = async function () {
    const inputLink = document.getElementById('input-looker-link');
    if (!inputLink) return;

    const novoLink = inputLink.value.trim();

    if (!novoLink.includes('lookerstudio.google.com/embed')) {
        alert('Aviso: O link não parece ser um link de Incorporação (Embed) válido do Looker Studio. O gráfico pode não carregar corretamente.');
    }

    try {
        const response = await fetch('/api/governanca/configuracoes/looker', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ novoLink: novoLink })
        });

        if (response.ok) {
            alert('Dashboard atualizado com sucesso!');
            const iframe = document.getElementById('iframe-looker');
            if (iframe) iframe.src = novoLink;
        } else {
            alert('Erro ao atualizar o dashboard no servidor.');
        }
    } catch (error) {
        console.error('Erro ao salvar novo link:', error);
        alert('Erro de comunicação ao salvar o link.');
    }
};

// Disponibiliza a função de carregamento para o main.js
window.carregarDashboardLooker = carregarDashboardLooker;