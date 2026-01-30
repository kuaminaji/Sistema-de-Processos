// API Base URL
const API_URL = '/api/processos';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadProcessos();
    setupFormHandlers();
    setupButtonHandlers();
});

// Setup button handlers
function setupButtonHandlers() {
    document.getElementById('btnNewProcess').addEventListener('click', showForm);
    document.getElementById('btnRefreshList').addEventListener('click', refreshProcessList);
    document.getElementById('btnApplyFilters').addEventListener('click', applyFilters);
    document.getElementById('btnClearFilters').addEventListener('click', clearFilters);
    document.getElementById('btnCloseForm').addEventListener('click', hideForm);
    document.getElementById('btnCancelForm').addEventListener('click', hideForm);
    document.getElementById('btnCloseModal').addEventListener('click', closeDetailsModal);
}

// Setup form handlers
function setupFormHandlers() {
    const form = document.getElementById('processoForm');
    form.addEventListener('submit', handleFormSubmit);
}

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch(`${API_URL}/estatisticas`);
        const result = await response.json();

        if (result.success) {
            document.getElementById('totalProcessos').textContent = result.data.total;

            // Reset status counts
            document.getElementById('emAndamento').textContent = '0';
            document.getElementById('suspensos').textContent = '0';
            document.getElementById('finalizados').textContent = '0';

            // Update status counts
            result.data.porStatus.forEach(item => {
                if (item.status === 'Em Andamento') {
                    document.getElementById('emAndamento').textContent = item.count;
                } else if (item.status === 'Suspenso') {
                    document.getElementById('suspensos').textContent = item.count;
                } else if (item.status === 'Finalizado') {
                    document.getElementById('finalizados').textContent = item.count;
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Load processos with optional filters
async function loadProcessos(filters = {}) {
    try {
        const queryParams = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}?${queryParams}`);
        const result = await response.json();

        if (result.success) {
            displayProcessos(result.data);
        } else {
            showToast('Erro ao carregar processos', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar processos:', error);
        showToast('Erro ao carregar processos', 'error');
    }
}

// Display processos
function displayProcessos(processos) {
    const container = document.getElementById('processosList');

    if (processos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum processo encontrado</h3>
                <p>Clique em "Novo Processo" para adicionar um processo.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = processos.map(processo => `
        <div class="process-card">
            <div class="process-header">
                <div class="process-title">
                    <h3>${escapeHtml(processo.titulo)}</h3>
                    <span class="process-number">Nº ${escapeHtml(processo.numero_processo)}</span>
                </div>
                <span class="status-badge status-${processo.status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(processo.status)}</span>
            </div>
            <div class="process-info">
                <div class="info-item">
                    <span class="info-label">Autor:</span>
                    <span class="info-value">${escapeHtml(processo.autor)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Réu:</span>
                    <span class="info-value">${escapeHtml(processo.reu)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Data Distribuição:</span>
                    <span class="info-value">${formatDate(processo.data_distribuicao)}</span>
                </div>
                ${processo.tipo_acao ? `
                <div class="info-item">
                    <span class="info-label">Tipo de Ação:</span>
                    <span class="info-value">${escapeHtml(processo.tipo_acao)}</span>
                </div>
                ` : ''}
                ${processo.valor_causa ? `
                <div class="info-item">
                    <span class="info-label">Valor da Causa:</span>
                    <span class="info-value">R$ ${formatCurrency(processo.valor_causa)}</span>
                </div>
                ` : ''}
                ${processo.comarca ? `
                <div class="info-item">
                    <span class="info-label">Comarca:</span>
                    <span class="info-value">${escapeHtml(processo.comarca)}</span>
                </div>
                ` : ''}
            </div>
            <div class="process-actions">
                <button class="btn btn-info" data-action="view" data-id="${processo.id}">
                    <span>👁</span> Ver Detalhes
                </button>
                <button class="btn btn-success" data-action="edit" data-id="${processo.id}">
                    <span>✏️</span> Editar
                </button>
                <button class="btn btn-danger" data-action="delete" data-id="${processo.id}" data-numero="${escapeHtml(processo.numero_processo)}">
                    <span>🗑</span> Excluir
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners to action buttons
    container.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', handleProcessAction);
    });
}

// Handle process action buttons
function handleProcessAction(e) {
    const button = e.currentTarget;
    const action = button.dataset.action;
    const id = button.dataset.id;
    
    if (action === 'view') {
        viewDetails(id);
    } else if (action === 'edit') {
        editProcesso(id);
    } else if (action === 'delete') {
        const numero = button.dataset.numero;
        deleteProcesso(id, numero);
    }
}

// View process details
async function viewDetails(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        const result = await response.json();

        if (result.success) {
            const processo = result.data;
            const modalContent = document.getElementById('detailsContent');
            
            modalContent.innerHTML = `
                <div class="modal-body">
                    <div class="detail-section">
                        <h3>Informações Gerais</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Número do Processo:</span>
                                <span class="detail-value">${escapeHtml(processo.numero_processo)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value">${escapeHtml(processo.status)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Título:</span>
                                <span class="detail-value">${escapeHtml(processo.titulo)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Data de Distribuição:</span>
                                <span class="detail-value">${formatDate(processo.data_distribuicao)}</span>
                            </div>
                            ${processo.tipo_acao ? `
                            <div class="detail-item">
                                <span class="detail-label">Tipo de Ação:</span>
                                <span class="detail-value">${escapeHtml(processo.tipo_acao)}</span>
                            </div>
                            ` : ''}
                            ${processo.valor_causa ? `
                            <div class="detail-item">
                                <span class="detail-label">Valor da Causa:</span>
                                <span class="detail-value">R$ ${formatCurrency(processo.valor_causa)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3>Partes Envolvidas</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Autor:</span>
                                <span class="detail-value">${escapeHtml(processo.autor)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Réu:</span>
                                <span class="detail-value">${escapeHtml(processo.reu)}</span>
                            </div>
                            ${processo.advogado_autor ? `
                            <div class="detail-item">
                                <span class="detail-label">Advogado do Autor:</span>
                                <span class="detail-value">${escapeHtml(processo.advogado_autor)}</span>
                            </div>
                            ` : ''}
                            ${processo.advogado_reu ? `
                            <div class="detail-item">
                                <span class="detail-label">Advogado do Réu:</span>
                                <span class="detail-value">${escapeHtml(processo.advogado_reu)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    ${processo.vara || processo.comarca ? `
                    <div class="detail-section">
                        <h3>Localização</h3>
                        <div class="detail-grid">
                            ${processo.vara ? `
                            <div class="detail-item">
                                <span class="detail-label">Vara:</span>
                                <span class="detail-value">${escapeHtml(processo.vara)}</span>
                            </div>
                            ` : ''}
                            ${processo.comarca ? `
                            <div class="detail-item">
                                <span class="detail-label">Comarca:</span>
                                <span class="detail-value">${escapeHtml(processo.comarca)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    ${processo.descricao ? `
                    <div class="detail-section">
                        <h3>Descrição</h3>
                        <p>${escapeHtml(processo.descricao)}</p>
                    </div>
                    ` : ''}

                    ${processo.observacoes ? `
                    <div class="detail-section">
                        <h3>Observações</h3>
                        <p>${escapeHtml(processo.observacoes)}</p>
                    </div>
                    ` : ''}

                    ${processo.movimentacoes && processo.movimentacoes.length > 0 ? `
                    <div class="detail-section">
                        <h3>Movimentações</h3>
                        ${processo.movimentacoes.map(mov => `
                            <div class="movimentacao-item">
                                <div class="movimentacao-header">
                                    <span class="movimentacao-tipo">${escapeHtml(mov.tipo)}</span>
                                    <span class="movimentacao-data">${formatDateTime(mov.data_movimentacao)}</span>
                                </div>
                                <div class="movimentacao-descricao">${escapeHtml(mov.descricao)}</div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            `;

            document.getElementById('detailsModal').style.display = 'flex';
        } else {
            showToast('Erro ao carregar detalhes do processo', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes do processo', 'error');
    }
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

// Show form for creating new process
function showForm() {
    document.getElementById('formTitle').textContent = 'Novo Processo';
    document.getElementById('processoForm').reset();
    document.getElementById('processoId').value = '';
    document.getElementById('formSection').style.display = 'block';
    document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
}

// Hide form
function hideForm() {
    document.getElementById('formSection').style.display = 'none';
}

// Edit process
async function editProcesso(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        const result = await response.json();

        if (result.success) {
            const processo = result.data;
            
            document.getElementById('formTitle').textContent = 'Editar Processo';
            document.getElementById('processoId').value = processo.id;
            document.getElementById('numero_processo').value = processo.numero_processo;
            document.getElementById('titulo').value = processo.titulo;
            document.getElementById('descricao').value = processo.descricao || '';
            document.getElementById('autor').value = processo.autor;
            document.getElementById('reu').value = processo.reu;
            document.getElementById('status').value = processo.status;
            document.getElementById('tipo_acao').value = processo.tipo_acao || '';
            document.getElementById('valor_causa').value = processo.valor_causa || '';
            document.getElementById('data_distribuicao').value = processo.data_distribuicao;
            document.getElementById('vara').value = processo.vara || '';
            document.getElementById('comarca').value = processo.comarca || '';
            document.getElementById('advogado_autor').value = processo.advogado_autor || '';
            document.getElementById('advogado_reu').value = processo.advogado_reu || '';
            document.getElementById('observacoes').value = processo.observacoes || '';

            document.getElementById('formSection').style.display = 'block';
            document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            showToast('Erro ao carregar processo', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar processo:', error);
        showToast('Erro ao carregar processo', 'error');
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('processoId').value;
    const formData = {
        numero_processo: document.getElementById('numero_processo').value,
        titulo: document.getElementById('titulo').value,
        descricao: document.getElementById('descricao').value,
        autor: document.getElementById('autor').value,
        reu: document.getElementById('reu').value,
        status: document.getElementById('status').value,
        tipo_acao: document.getElementById('tipo_acao').value,
        valor_causa: document.getElementById('valor_causa').value || null,
        data_distribuicao: document.getElementById('data_distribuicao').value,
        vara: document.getElementById('vara').value,
        comarca: document.getElementById('comarca').value,
        advogado_autor: document.getElementById('advogado_autor').value,
        advogado_reu: document.getElementById('advogado_reu').value,
        observacoes: document.getElementById('observacoes').value
    };

    try {
        const url = id ? `${API_URL}/${id}` : API_URL;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            showToast(id ? 'Processo atualizado com sucesso!' : 'Processo criado com sucesso!', 'success');
            hideForm();
            loadStatistics();
            loadProcessos();
        } else {
            if (result.errors) {
                const errorMessages = result.errors.map(err => err.message).join('\n');
                showToast(errorMessages, 'error');
            } else {
                showToast(result.error || 'Erro ao salvar processo', 'error');
            }
        }
    } catch (error) {
        console.error('Erro ao salvar processo:', error);
        showToast('Erro ao salvar processo', 'error');
    }
}

// Delete process
async function deleteProcesso(id, numero) {
    if (!confirm(`Tem certeza que deseja excluir o processo ${numero}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Processo excluído com sucesso!', 'success');
            loadStatistics();
            loadProcessos();
        } else {
            showToast(result.error || 'Erro ao excluir processo', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir processo:', error);
        showToast('Erro ao excluir processo', 'error');
    }
}

// Apply filters
function applyFilters() {
    const filters = {};

    const numero = document.getElementById('searchNumero').value.trim();
    const autor = document.getElementById('searchAutor').value.trim();
    const reu = document.getElementById('searchReu').value.trim();
    const status = document.getElementById('filterStatus').value;

    if (numero) filters.numero = numero;
    if (autor) filters.autor = autor;
    if (reu) filters.reu = reu;
    if (status) filters.status = status;

    loadProcessos(filters);
}

// Clear filters
function clearFilters() {
    document.getElementById('searchNumero').value = '';
    document.getElementById('searchAutor').value = '';
    document.getElementById('searchReu').value = '';
    document.getElementById('filterStatus').value = '';
    loadProcessos();
}

// Refresh process list
function refreshProcessList() {
    loadStatistics();
    loadProcessos();
    showToast('Lista atualizada!', 'info');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function formatCurrency(value) {
    if (!value) return '0,00';
    return parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target === modal) {
        closeDetailsModal();
    }
}
