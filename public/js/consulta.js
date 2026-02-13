// Consulta Pública JavaScript

// ========== CPF CONSULTATION ==========
document.getElementById('consultaCpfForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cpfInput = document.getElementById('cpf');
    const cpf = cpfInput.value.replace(/\D/g, '');
    
    // Validate CPF
    if (!validateCPF(cpf)) {
        showToast('CPF inválido', 'error');
        return;
    }
    
    const btn = document.getElementById('cpfBtn');
    const btnText = document.getElementById('cpfBtnText');
    const btnLoading = document.getElementById('cpfBtnLoading');
    
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    
    try {
        const response = await fetch(`/api/public/consultarPorCPF/${cpf}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayResults(data.data, 'cpf');
        } else {
            showToast(data.message || 'Nenhum processo encontrado', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Erro ao consultar processos', 'error');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
});

// ========== NUMERO CONSULTATION ==========
document.getElementById('consultaNumeroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numero = document.getElementById('numero').value.trim();
    
    if (!numero) {
        showToast('Digite o número do processo', 'error');
        return;
    }
    
    const btn = document.getElementById('numeroBtn');
    const btnText = document.getElementById('numeroBtnText');
    const btnLoading = document.getElementById('numeroBtnLoading');
    
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    
    try {
        const response = await fetch(`/api/public/consultarPorNumero/${encodeURIComponent(numero)}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayResults(data.data, 'numero');
        } else {
            showToast(data.message || 'Processo não encontrado', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Erro ao consultar processo', 'error');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
});

// ========== DISPLAY RESULTS ==========
function displayResults(data, type) {
    const container = document.getElementById('resultadosContainer');
    const content = document.getElementById('resultadosContent');
    
    if (!data) {
        content.innerHTML = '<div class="empty-state"><p class="text-secondary">Nenhum resultado encontrado</p></div>';
        container.style.display = 'block';
        return;
    }
    
    let html = '';
    
    if (type === 'cpf') {
        // Display multiple processes
        const processos = data.processos || [];
        const cliente = data.cliente || {};
        
        if (processos.length === 0) {
            html = '<div class="empty-state"><p class="text-secondary">Nenhum processo encontrado para este CPF</p></div>';
        } else {
            html += `
                <div class="alert alert-info mb-3">
                    <strong>Cliente:</strong> ${cliente.nome || '-'}<br>
                    <strong>CPF:</strong> ${formatCPF(cliente.cpf || '')}<br>
                    <strong>Processos encontrados:</strong> ${processos.length}
                </div>
            `;
            
            processos.forEach(processo => {
                html += renderProcesso(processo);
            });
        }
    } else {
        // Display single process
        const processo = data.processo || {};
        html = renderProcesso(processo);
    }
    
    content.innerHTML = html;
    container.style.display = 'block';
    
    // Scroll to results
    container.scrollIntoView({ behavior: 'smooth' });
}

// ========== RENDER PROCESSO ==========
function renderProcesso(processo) {
    const statusBadge = getStatusBadge(processo.status);
    const movimentacoes = processo.movimentacoes || [];
    
    let html = `
        <div class="card mb-3" style="border-left: 4px solid ${getStatusColor(processo.status)};">
            <div class="card-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin-bottom: var(--spacing-xs);">${processo.numero || '-'}</h4>
                        <p class="text-secondary text-sm" style="margin: 0;">${processo.tipo || '-'}</p>
                    </div>
                    ${statusBadge}
                </div>
            </div>
            <div class="card-body">
                <div class="form-row cols-2 mb-3">
                    <div>
                        <strong>Vara:</strong> ${processo.vara || '-'}
                    </div>
                    <div>
                        <strong>Comarca:</strong> ${processo.comarca || '-'}
                    </div>
                    <div>
                        <strong>Data de Distribuição:</strong> ${formatDate(processo.data_distribuicao)}
                    </div>
                    <div>
                        <strong>Valor da Causa:</strong> ${processo.valor_causa ? 'R$ ' + parseFloat(processo.valor_causa).toFixed(2) : '-'}
                    </div>
                </div>
                
                ${processo.partes ? `
                    <div class="mb-3">
                        <strong>Partes:</strong>
                        <div class="mt-1">${processo.partes}</div>
                    </div>
                ` : ''}
                
                ${processo.assunto ? `
                    <div class="mb-3">
                        <strong>Assunto:</strong>
                        <div class="mt-1">${processo.assunto}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Movimentações
    if (movimentacoes.length > 0) {
        html += `
            <div class="card mb-3">
                <div class="card-header">
                    <h4 class="card-title">Movimentações (${movimentacoes.length})</h4>
                </div>
                <div class="card-body">
                    <div class="process-status">
        `;
        
        movimentacoes.forEach(mov => {
            html += `
                <div class="process-status-item">
                    <div class="process-status-icon">📄</div>
                    <div class="process-status-content">
                        <h4>${mov.tipo || 'Movimentação'}</h4>
                        <p><strong>Data:</strong> ${formatDate(mov.data)}</p>
                        ${mov.descricao ? `<p>${mov.descricao}</p>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    }
    
    return html;
}

// ========== STATUS UTILITIES ==========
function getStatusBadge(status) {
    const badges = {
        'Ativo': 'badge-success',
        'Arquivado': 'badge-secondary',
        'Suspenso': 'badge-warning',
        'Baixado': 'badge-info',
        'Cancelado': 'badge-danger'
    };
    
    const badgeClass = badges[status] || 'badge-secondary';
    return `<span class="badge ${badgeClass}">${status || 'Desconhecido'}</span>`;
}

function getStatusColor(status) {
    const colors = {
        'Ativo': '#10b981',
        'Arquivado': '#64748b',
        'Suspenso': '#f59e0b',
        'Baixado': '#3b82f6',
        'Cancelado': '#ef4444'
    };
    
    return colors[status] || '#64748b';
}

// ========== CLEAR RESULTS ==========
function limparResultados() {
    const container = document.getElementById('resultadosContainer');
    container.style.display = 'none';
    
    // Clear forms
    document.getElementById('consultaCpfForm')?.reset();
    document.getElementById('consultaNumeroForm')?.reset();
}
