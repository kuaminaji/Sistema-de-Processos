// Admin Area JavaScript

let currentUser = null;
let currentSection = 'dashboard';

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentUser = await checkAuth();
    if (!currentUser) {
        // Force HTTP protocol to prevent HSTS upgrade
        const protocol = 'http:';
        const host = window.location.host;
        const loginUrl = `${protocol}//${host}/login.html`;
        window.location.href = loginUrl;
        return;
    }
    
    // Update user info in header
    updateUserInfo();
    
    // Load dashboard
    loadDashboard();
    
    // Setup navigation
    setupNavigation();
});

// ========== UPDATE USER INFO ==========
function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('userName').textContent = currentUser.nome || currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role || 'Usuário';
    
    // Set avatar initial
    const initial = (currentUser.nome || currentUser.email || 'U')[0].toUpperCase();
    document.getElementById('userAvatar').textContent = initial;
    
    // Hide menu items based on permissions
    const menuItems = document.querySelectorAll('[data-permission]');
    menuItems.forEach(item => {
        const requiredPermission = item.getAttribute('data-permission');
        if (!hasPermission(requiredPermission)) {
            item.style.display = 'none';
        }
    });
}

function hasPermission(permission) {
    if (!currentUser || !currentUser.permissions) return false;
    return currentUser.permissions.includes(permission) || currentUser.role === 'admin';
}

// ========== NAVIGATION ==========
function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const section = link.getAttribute('data-section');
            if (!section) return;
            
            // Update active nav item
            document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update page title
            const title = link.textContent.trim();
            document.getElementById('pageTitle').textContent = title;
            
            // Show section
            showSection(section);
        });
    });
}

function showSection(section) {
    currentSection = section;
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    
    // Show selected section
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Load section content
    switch (section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'processos':
            loadProcessos();
            break;
        case 'clientes':
            loadClientes();
            break;
        case 'movimentacoes':
            loadMovimentacoes();
            break;
        case 'usuarios':
            loadUsuarios();
            break;
        case 'permissoes':
            loadPermissoes();
            break;
        case 'auditoria':
            loadAuditoria();
            break;
    }
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    showLoading();
    
    try {
        // Load stats
        const stats = await api('/api/processos/stats');
        renderStats(stats);
        
        // Load chart data
        renderStatusChart(stats);
        
        // Load recent activity (using audit log)
        try {
            const auditData = await api('/api/auditoria?page=1&perPage=5');
            renderRecentActivity(auditData.logs || []);
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Erro ao carregar dashboard', 'error');
    } finally {
        hideLoading();
    }
}

function renderStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    if (!stats) return;
    
    const statCards = [
        { icon: '📋', label: 'Total de Processos', value: stats.total || 0, color: 'primary' },
        { icon: '✓', label: 'Processos Ativos', value: stats.ativos || 0, color: 'success' },
        { icon: '📦', label: 'Processos Arquivados', value: stats.arquivados || 0, color: 'secondary' },
        { icon: '⏸', label: 'Processos Suspensos', value: stats.suspensos || 0, color: 'warning' }
    ];
    
    statsGrid.innerHTML = statCards.map(card => `
        <div class="stat-card">
            <div class="stat-icon ${card.color}">${card.icon}</div>
            <div class="stat-content">
                <div class="stat-label">${card.label}</div>
                <div class="stat-value">${card.value}</div>
            </div>
        </div>
    `).join('');
}

function renderStatusChart(stats) {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 300;
    
    const data = [
        stats.ativos || 0,
        stats.arquivados || 0,
        stats.suspensos || 0,
        stats.baixados || 0
    ];
    
    const labels = ['Ativos', 'Arquivados', 'Suspensos', 'Baixados'];
    const colors = ['#10b981', '#64748b', '#f59e0b', '#3b82f6'];
    
    drawPieChart(canvas, data, labels, colors);
}

function renderRecentActivity(logs) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p class="text-secondary text-sm">Nenhuma atividade recente</p></div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="process-status-item" style="padding: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <div class="process-status-content">
                <h4 class="text-sm">${log.acao || 'Ação'}</h4>
                <p class="text-xs text-secondary" style="margin: 0;">
                    ${log.usuario || 'Sistema'} • ${formatDateTime(log.data_hora)}
                </p>
            </div>
        </div>
    `).join('');
}

// ========== PROCESSOS ==========
let processosData = [];
let processosPage = 1;
const processosPerPage = 10;

async function loadProcessos() {
    const section = document.getElementById('processosSection');
    
    section.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Processos</h2>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="showProcessoForm()">+ Novo Processo</button>
                    <button class="btn btn-outline" onclick="exportProcessos('csv')">📋 CSV</button>
                    <button class="btn btn-outline" onclick="exportProcessos('excel')">📊 Excel</button>
                </div>
            </div>
        </div>
        
        <div class="filters">
            <div class="filters-row">
                <div class="form-group" style="margin: 0;">
                    <input type="text" class="form-control" placeholder="Buscar..." id="searchProcessos" onkeyup="searchProcessos()">
                </div>
                <div class="form-group" style="margin: 0;">
                    <select class="form-control" id="filterStatus" onchange="filterProcessos()">
                        <option value="">Todos os status</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Arquivado">Arquivado</option>
                        <option value="Suspenso">Suspenso</option>
                        <option value="Baixado">Baixado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <button class="btn btn-ghost" onclick="clearProcessosFilters()">Limpar Filtros</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div id="processosTable">Carregando...</div>
            </div>
        </div>
    `;
    
    await fetchProcessos();
}

async function fetchProcessos() {
    showLoading();
    
    try {
        const response = await api('/api/processos?page=1&perPage=50');
        processosData = response.processos || [];
        renderProcessosTable();
    } catch (error) {
        console.error('Error fetching processos:', error);
        showToast('Erro ao carregar processos', 'error');
    } finally {
        hideLoading();
    }
}

function renderProcessosTable() {
    const container = document.getElementById('processosTable');
    if (!container) return;
    
    const filteredData = getFilteredProcessos();
    const start = (processosPage - 1) * processosPerPage;
    const end = start + processosPerPage;
    const pageData = filteredData.slice(start, end);
    
    if (pageData.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Nenhum processo encontrado</div><div class="empty-state-message">Adicione um novo processo para começar</div></div>';
        return;
    }
    
    const headers = ['Número', 'Tipo', 'Cliente', 'Status', 'Data Distribuição', 'Ações'];
    const rows = pageData.map(p => [
        p.numero || '-',
        p.tipo || '-',
        p.cliente_nome || '-',
        `<span class="badge badge-${getStatusClass(p.status)}">${p.status}</span>`,
        formatDate(p.data_distribuicao),
        `
            <button class="btn btn-sm btn-ghost" onclick="viewProcesso(${p.id})">👁️</button>
            <button class="btn btn-sm btn-ghost" onclick="editProcesso(${p.id})">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="deleteProcesso(${p.id})">🗑️</button>
        `
    ]);
    
    let html = '<div class="table-container"><table class="table"><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    pageData.forEach((p, i) => {
        html += '<tr>';
        html += `<td>${rows[i][0]}</td>`;
        html += `<td>${rows[i][1]}</td>`;
        html += `<td>${rows[i][2]}</td>`;
        html += `<td>${rows[i][3]}</td>`;
        html += `<td>${rows[i][4]}</td>`;
        html += `<td class="table-actions">${rows[i][5]}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    // Add pagination
    const totalPages = Math.ceil(filteredData.length / processosPerPage);
    html += createPagination(processosPage, totalPages, 'goToProcessosPage');
    
    container.innerHTML = html;
}

function getFilteredProcessos() {
    let filtered = [...processosData];
    
    const searchTerm = document.getElementById('searchProcessos')?.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            (p.numero || '').toLowerCase().includes(searchTerm) ||
            (p.tipo || '').toLowerCase().includes(searchTerm) ||
            (p.cliente_nome || '').toLowerCase().includes(searchTerm)
        );
    }
    
    const statusFilter = document.getElementById('filterStatus')?.value;
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    return filtered;
}

function searchProcessos() {
    processosPage = 1;
    renderProcessosTable();
}

function filterProcessos() {
    processosPage = 1;
    renderProcessosTable();
}

function clearProcessosFilters() {
    document.getElementById('searchProcessos').value = '';
    document.getElementById('filterStatus').value = '';
    processosPage = 1;
    renderProcessosTable();
}

function goToProcessosPage(page) {
    processosPage = page;
    renderProcessosTable();
}

function getStatusClass(status) {
    const map = {
        'Ativo': 'success',
        'Arquivado': 'secondary',
        'Suspenso': 'warning',
        'Baixado': 'info',
        'Cancelado': 'danger'
    };
    return map[status] || 'secondary';
}

// ========== PROCESSO CRUD ==========
async function showProcessoForm(processoId = null) {
    const isEdit = processoId !== null;
    let processo = {};
    
    if (isEdit) {
        try {
            const response = await api(`/api/processos/${processoId}`);
            processo = response.processo || {};
        } catch (error) {
            showToast('Erro ao carregar processo', 'error');
            return;
        }
    }
    
    // Load clientes for dropdown
    let clientes = [];
    try {
        const response = await api('/api/clientes?page=1&perPage=50');
        clientes = response.clientes || [];
    } catch (error) {
        console.error('Error loading clientes:', error);
    }
    
    const clientesOptions = clientes.map(c => 
        `<option value="${c.id}" ${processo.cliente_id === c.id ? 'selected' : ''}>${c.nome} - ${formatCPF(c.cpf)}</option>`
    ).join('');
    
    const content = `
        <form id="processoForm">
            <div class="form-row cols-2">
                <div class="form-group">
                    <label class="form-label required">Número do Processo</label>
                    <input type="text" name="numero" class="form-control" value="${processo.numero || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Cliente</label>
                    <select name="cliente_id" class="form-control" required>
                        <option value="">Selecione...</option>
                        ${clientesOptions}
                    </select>
                </div>
            </div>
            <div class="form-row cols-2">
                <div class="form-group">
                    <label class="form-label required">Tipo</label>
                    <input type="text" name="tipo" class="form-control" value="${processo.tipo || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select name="status" class="form-control" required>
                        <option value="Ativo" ${processo.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option value="Arquivado" ${processo.status === 'Arquivado' ? 'selected' : ''}>Arquivado</option>
                        <option value="Suspenso" ${processo.status === 'Suspenso' ? 'selected' : ''}>Suspenso</option>
                        <option value="Baixado" ${processo.status === 'Baixado' ? 'selected' : ''}>Baixado</option>
                        <option value="Cancelado" ${processo.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
            </div>
            <div class="form-row cols-2">
                <div class="form-group">
                    <label class="form-label">Vara</label>
                    <input type="text" name="vara" class="form-control" value="${processo.vara || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Comarca</label>
                    <input type="text" name="comarca" class="form-control" value="${processo.comarca || ''}">
                </div>
            </div>
            <div class="form-row cols-2">
                <div class="form-group">
                    <label class="form-label">Data de Distribuição</label>
                    <input type="date" name="data_distribuicao" class="form-control" value="${formatDateInput(processo.data_distribuicao)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Valor da Causa</label>
                    <input type="number" step="0.01" name="valor_causa" class="form-control" value="${processo.valor_causa || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Partes</label>
                <textarea name="partes" class="form-control">${processo.partes || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Assunto</label>
                <textarea name="assunto" class="form-control">${processo.assunto || ''}</textarea>
            </div>
        </form>
    `;
    
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveProcesso(${processoId})">${isEdit ? 'Salvar' : 'Criar'}</button>
    `;
    
    showModal(isEdit ? 'Editar Processo' : 'Novo Processo', content, footer);
}

async function saveProcesso(processoId) {
    const form = document.getElementById('processoForm');
    
    if (!validateForm(form)) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    showLoading();
    
    try {
        const url = processoId ? `/api/processos/${processoId}` : '/api/processos/create';
        const method = processoId ? 'PUT' : 'POST';
        
        await api(url, method, data);
        
        showToast(`Processo ${processoId ? 'atualizado' : 'criado'} com sucesso!`, 'success');
        closeModal();
        await fetchProcessos();
    } catch (error) {
        console.error('Error saving processo:', error);
        showToast(error.message || 'Erro ao salvar processo', 'error');
    } finally {
        hideLoading();
    }
}

async function viewProcesso(id) {
    showLoading();
    
    try {
        const response = await api(`/api/processos/${id}`);
        const processo = response.processo || {};
        
        const content = `
            <div class="form-row cols-2">
                <div><strong>Número:</strong><br>${processo.numero || '-'}</div>
                <div><strong>Tipo:</strong><br>${processo.tipo || '-'}</div>
                <div><strong>Cliente:</strong><br>${processo.cliente_nome || '-'}</div>
                <div><strong>Status:</strong><br><span class="badge badge-${getStatusClass(processo.status)}">${processo.status}</span></div>
                <div><strong>Vara:</strong><br>${processo.vara || '-'}</div>
                <div><strong>Comarca:</strong><br>${processo.comarca || '-'}</div>
                <div><strong>Data Distribuição:</strong><br>${formatDate(processo.data_distribuicao)}</div>
                <div><strong>Valor da Causa:</strong><br>${processo.valor_causa ? 'R$ ' + parseFloat(processo.valor_causa).toFixed(2) : '-'}</div>
            </div>
            ${processo.partes ? `<div class="mt-2"><strong>Partes:</strong><br>${processo.partes}</div>` : ''}
            ${processo.assunto ? `<div class="mt-2"><strong>Assunto:</strong><br>${processo.assunto}</div>` : ''}
        `;
        
        showModal('Detalhes do Processo', content);
    } catch (error) {
        showToast('Erro ao carregar processo', 'error');
    } finally {
        hideLoading();
    }
}

async function editProcesso(id) {
    await showProcessoForm(id);
}

async function deleteProcesso(id) {
    if (!confirm('Tem certeza que deseja excluir este processo?')) {
        return;
    }
    
    showLoading();
    
    try {
        await api(`/api/processos/${id}`, 'DELETE');
        showToast('Processo excluído com sucesso!', 'success');
        await fetchProcessos();
    } catch (error) {
        console.error('Error deleting processo:', error);
        showToast(error.message || 'Erro ao excluir processo', 'error');
    } finally {
        hideLoading();
    }
}

// ========== CLIENTES ==========
let clientesData = [];

async function loadClientes() {
    const section = document.getElementById('clientesSection');
    
    section.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Clientes</h2>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="showClienteForm()">+ Novo Cliente</button>
                </div>
            </div>
        </div>
        
        <div class="filters">
            <input type="text" class="form-control" placeholder="Buscar por nome ou CPF..." id="searchClientes" onkeyup="searchClientes()">
        </div>
        
        <div class="card">
            <div class="card-body">
                <div id="clientesTable">Carregando...</div>
            </div>
        </div>
    `;
    
    await fetchClientes();
}

async function fetchClientes() {
    showLoading();
    
    try {
        const response = await api('/api/clientes?page=1&perPage=50');
        clientesData = response.clientes || [];
        renderClientesTable();
    } catch (error) {
        console.error('Error fetching clientes:', error);
        showToast('Erro ao carregar clientes', 'error');
    } finally {
        hideLoading();
    }
}

function renderClientesTable() {
    const container = document.getElementById('clientesTable');
    if (!container) return;
    
    const searchTerm = document.getElementById('searchClientes')?.value.toLowerCase() || '';
    const filtered = clientesData.filter(c => 
        (c.nome || '').toLowerCase().includes(searchTerm) ||
        (c.cpf || '').includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Nenhum cliente encontrado</div></div>';
        return;
    }
    
    let html = '<div class="table-container"><table class="table"><thead><tr>';
    html += '<th>Nome</th><th>CPF</th><th>E-mail</th><th>Telefone</th><th>Ações</th>';
    html += '</tr></thead><tbody>';
    
    filtered.forEach(c => {
        html += '<tr>';
        html += `<td>${c.nome || '-'}</td>`;
        html += `<td>${formatCPF(c.cpf)}</td>`;
        html += `<td>${c.email || '-'}</td>`;
        html += `<td>${formatPhone(c.telefone || '')}</td>`;
        html += `<td class="table-actions">
            <button class="btn btn-sm btn-ghost" onclick="viewCliente(${c.id})">👁️</button>
            <button class="btn btn-sm btn-ghost" onclick="editCliente(${c.id})">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="deleteCliente(${c.id})">🗑️</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function searchClientes() {
    renderClientesTable();
}

async function showClienteForm(clienteId = null) {
    const isEdit = clienteId !== null;
    let cliente = {};
    
    if (isEdit) {
        try {
            const response = await api(`/api/clientes/${clienteId}`);
            cliente = response.cliente || {};
        } catch (error) {
            showToast('Erro ao carregar cliente', 'error');
            return;
        }
    }
    
    const content = `
        <form id="clienteForm">
            <div class="form-group">
                <label class="form-label required">Nome</label>
                <input type="text" name="nome" class="form-control" value="${cliente.nome || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label required">CPF</label>
                <input type="text" id="cpf" name="cpf" class="form-control" value="${formatCPF(cliente.cpf || '')}" required maxlength="14">
            </div>
            <div class="form-row cols-2">
                <div class="form-group">
                    <label class="form-label">E-mail</label>
                    <input type="email" name="email" class="form-control" value="${cliente.email || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Telefone</label>
                    <input type="tel" name="telefone" class="form-control" value="${cliente.telefone || ''}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Endereço</label>
                <textarea name="endereco" class="form-control">${cliente.endereco || ''}</textarea>
            </div>
        </form>
    `;
    
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveCliente(${clienteId})">${isEdit ? 'Salvar' : 'Criar'}</button>
    `;
    
    showModal(isEdit ? 'Editar Cliente' : 'Novo Cliente', content, footer);
}

async function saveCliente(clienteId) {
    const form = document.getElementById('clienteForm');
    
    if (!validateForm(form)) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Remove CPF formatting
    data.cpf = data.cpf.replace(/\D/g, '');
    
    // Validate CPF
    if (!validateCPF(data.cpf)) {
        showToast('CPF inválido', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const url = clienteId ? `/api/clientes/${clienteId}` : '/api/clientes/create';
        const method = clienteId ? 'PUT' : 'POST';
        
        await api(url, method, data);
        
        showToast(`Cliente ${clienteId ? 'atualizado' : 'criado'} com sucesso!`, 'success');
        closeModal();
        await fetchClientes();
    } catch (error) {
        console.error('Error saving cliente:', error);
        showToast(error.message || 'Erro ao salvar cliente', 'error');
    } finally {
        hideLoading();
    }
}

async function viewCliente(id) {
    showLoading();
    
    try {
        const response = await api(`/api/clientes/${id}`);
        const cliente = response.cliente || {};
        
        const content = `
            <div class="form-group">
                <strong>Nome:</strong><br>${cliente.nome || '-'}
            </div>
            <div class="form-group">
                <strong>CPF:</strong><br>${formatCPF(cliente.cpf)}
            </div>
            <div class="form-row cols-2">
                <div><strong>E-mail:</strong><br>${cliente.email || '-'}</div>
                <div><strong>Telefone:</strong><br>${formatPhone(cliente.telefone || '')}</div>
            </div>
            ${cliente.endereco ? `<div class="form-group"><strong>Endereço:</strong><br>${cliente.endereco}</div>` : ''}
        `;
        
        showModal('Detalhes do Cliente', content);
    } catch (error) {
        showToast('Erro ao carregar cliente', 'error');
    } finally {
        hideLoading();
    }
}

async function editCliente(id) {
    await showClienteForm(id);
}

async function deleteCliente(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) {
        return;
    }
    
    showLoading();
    
    try {
        await api(`/api/clientes/${id}`, 'DELETE');
        showToast('Cliente excluído com sucesso!', 'success');
        await fetchClientes();
    } catch (error) {
        console.error('Error deleting cliente:', error);
        showToast(error.message || 'Erro ao excluir cliente', 'error');
    } finally {
        hideLoading();
    }
}

// ========== MOVIMENTACOES ==========
async function loadMovimentacoes() {
    const section = document.getElementById('movimentacoesSection');
    
    section.innerHTML = `
        <div class="page-header">
            <h2>Movimentações</h2>
        </div>
        
        <div class="alert alert-info">
            <strong>ℹ️ Informação:</strong> As movimentações são gerenciadas através dos processos. 
            Acesse um processo específico na aba "Processos" para visualizar e gerenciar suas movimentações.
        </div>
        
        <div class="text-center mt-3">
            <button class="btn btn-primary" onclick="showSection('processos')">Ir para Processos</button>
        </div>
    `;
}

// ========== USUARIOS (Admin only) ==========
async function loadUsuarios() {
    if (!hasPermission('manage_users')) {
        document.getElementById('usuariosSection').innerHTML = '<div class="alert alert-error">Você não tem permissão para acessar esta seção.</div>';
        return;
    }
    
    const section = document.getElementById('usuariosSection');
    
    section.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Usuários</h2>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="showUsuarioForm()">+ Novo Usuário</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div id="usuariosTable">Carregando...</div>
            </div>
        </div>
    `;
    
    await fetchUsuarios();
}

async function fetchUsuarios() {
    showLoading();
    
    try {
        const response = await api('/api/usuarios?page=1&perPage=50');
        renderUsuariosTable(response.usuarios || []);
    } catch (error) {
        console.error('Error fetching usuarios:', error);
        showToast('Erro ao carregar usuários', 'error');
    } finally {
        hideLoading();
    }
}

function renderUsuariosTable(usuarios) {
    const container = document.getElementById('usuariosTable');
    if (!container) return;
    
    if (usuarios.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Nenhum usuário encontrado</div></div>';
        return;
    }
    
    let html = '<div class="table-container"><table class="table"><thead><tr>';
    html += '<th>Nome</th><th>E-mail</th><th>Cargo</th><th>2FA</th><th>Ativo</th><th>Ações</th>';
    html += '</tr></thead><tbody>';
    
    usuarios.forEach(u => {
        html += '<tr>';
        html += `<td>${u.nome || '-'}</td>`;
        html += `<td>${u.email}</td>`;
        html += `<td>${u.role || 'user'}</td>`;
        html += `<td><span class="badge badge-${u.twoFactorEnabled ? 'success' : 'secondary'}">${u.twoFactorEnabled ? 'Ativo' : 'Inativo'}</span></td>`;
        html += `<td><span class="badge badge-${u.ativo ? 'success' : 'danger'}">${u.ativo ? 'Sim' : 'Não'}</span></td>`;
        html += `<td class="table-actions">
            <button class="btn btn-sm btn-ghost" onclick="editUsuario(${u.id})">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="toggleUsuarioStatus(${u.id}, ${!u.ativo})">⚡</button>
            <button class="btn btn-sm btn-ghost" onclick="deleteUsuario(${u.id})">🗑️</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function showUsuarioForm(usuarioId = null) {
    const isEdit = usuarioId !== null;
    let usuario = {};
    
    if (isEdit) {
        try {
            const response = await api(`/api/usuarios/${usuarioId}`);
            usuario = response.usuario || {};
        } catch (error) {
            showToast('Erro ao carregar usuário', 'error');
            return;
        }
    }
    
    const content = `
        <form id="usuarioForm">
            <div class="form-group">
                <label class="form-label required">Nome</label>
                <input type="text" name="nome" class="form-control" value="${usuario.nome || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label required">E-mail</label>
                <input type="email" name="email" class="form-control" value="${usuario.email || ''}" required>
            </div>
            ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label required">Senha</label>
                    <input type="password" name="senha" class="form-control" required minlength="8">
                </div>
            ` : ''}
            <div class="form-group">
                <label class="form-label required">Cargo</label>
                <select name="role" class="form-control" required>
                    <option value="user" ${usuario.role === 'user' ? 'selected' : ''}>Usuário</option>
                    <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>Administrador</option>
                </select>
            </div>
        </form>
    `;
    
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveUsuario(${usuarioId})">${isEdit ? 'Salvar' : 'Criar'}</button>
    `;
    
    showModal(isEdit ? 'Editar Usuário' : 'Novo Usuário', content, footer);
}

async function saveUsuario(usuarioId) {
    const form = document.getElementById('usuarioForm');
    
    if (!validateForm(form)) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    showLoading();
    
    try {
        const url = usuarioId ? `/api/usuarios/${usuarioId}` : '/api/usuarios/create';
        const method = usuarioId ? 'PUT' : 'POST';
        
        await api(url, method, data);
        
        showToast(`Usuário ${usuarioId ? 'atualizado' : 'criado'} com sucesso!`, 'success');
        closeModal();
        await fetchUsuarios();
    } catch (error) {
        console.error('Error saving usuario:', error);
        showToast(error.message || 'Erro ao salvar usuário', 'error');
    } finally {
        hideLoading();
    }
}

async function editUsuario(id) {
    await showUsuarioForm(id);
}

async function toggleUsuarioStatus(id, ativo) {
    showLoading();
    
    try {
        await api(`/api/usuarios/${id}`, 'PUT', { ativo });
        showToast(`Usuário ${ativo ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        await fetchUsuarios();
    } catch (error) {
        console.error('Error toggling usuario status:', error);
        showToast(error.message || 'Erro ao alterar status', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteUsuario(id) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
        return;
    }
    
    showLoading();
    
    try {
        await api(`/api/usuarios/${id}`, 'DELETE');
        showToast('Usuário excluído com sucesso!', 'success');
        await fetchUsuarios();
    } catch (error) {
        console.error('Error deleting usuario:', error);
        showToast(error.message || 'Erro ao excluir usuário', 'error');
    } finally {
        hideLoading();
    }
}

// ========== PERMISSOES (Admin only) ==========
async function loadPermissoes() {
    if (!hasPermission('manage_permissions')) {
        document.getElementById('permissoesSection').innerHTML = '<div class="alert alert-error">Você não tem permissão para acessar esta seção.</div>';
        return;
    }
    
    const section = document.getElementById('permissoesSection');
    
    section.innerHTML = `
        <div class="page-header">
            <h2>Permissões</h2>
        </div>
        
        <div class="alert alert-info">
            <strong>ℹ️ Informação:</strong> Gerencie as permissões dos usuários do sistema.
        </div>
        
        <div id="permissoesContent">Carregando...</div>
    `;
    
    await fetchPermissoes();
}

async function fetchPermissoes() {
    showLoading();
    
    try {
        const [permissoesResp, usuariosResp] = await Promise.all([
            api('/api/permissoes'),
            api('/api/usuarios?page=1&perPage=50')
        ]);
        
        renderPermissoes(permissoesResp.permissoes || [], usuariosResp.usuarios || []);
    } catch (error) {
        console.error('Error fetching permissoes:', error);
        showToast('Erro ao carregar permissões', 'error');
    } finally {
        hideLoading();
    }
}

function renderPermissoes(permissoes, usuarios) {
    const container = document.getElementById('permissoesContent');
    if (!container) return;
    
    let html = '<div class="card"><div class="card-body">';
    html += '<div class="form-group"><label class="form-label">Selecione um usuário:</label>';
    html += '<select class="form-control" id="selectUsuarioPermissao" onchange="loadUserPermissions()">';
    html += '<option value="">Selecione...</option>';
    usuarios.forEach(u => {
        html += `<option value="${u.id}">${u.nome || u.email} (${u.email})</option>`;
    });
    html += '</select></div>';
    html += '<div id="userPermissionsContainer"></div>';
    html += '</div></div>';
    
    container.innerHTML = html;
}

async function loadUserPermissions() {
    const userId = document.getElementById('selectUsuarioPermissao').value;
    const container = document.getElementById('userPermissionsContainer');
    
    if (!userId) {
        container.innerHTML = '';
        return;
    }
    
    showLoading();
    
    try {
        const response = await api(`/api/permissoes/getUserPermissions/${userId}`);
        const userPermissions = response.permissions || [];
        
        const allPermissions = [
            { id: 'manage_users', label: 'Gerenciar Usuários' },
            { id: 'manage_permissions', label: 'Gerenciar Permissões' },
            { id: 'view_audit', label: 'Visualizar Auditoria' },
            { id: 'export_data', label: 'Exportar Dados' },
            { id: 'backup_restore', label: 'Backup e Restauração' }
        ];
        
        let html = '<form id="permissoesForm"><h4 class="mt-3 mb-2">Permissões:</h4>';
        
        allPermissions.forEach(perm => {
            const checked = userPermissions.includes(perm.id) ? 'checked' : '';
            html += `
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="perm_${perm.id}" value="${perm.id}" ${checked}>
                    <label class="form-check-label" for="perm_${perm.id}">${perm.label}</label>
                </div>
            `;
        });
        
        html += `<button type="button" class="btn btn-primary mt-3" onclick="saveUserPermissions(${userId})">Salvar Permissões</button>`;
        html += '</form>';
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading user permissions:', error);
        showToast('Erro ao carregar permissões do usuário', 'error');
    } finally {
        hideLoading();
    }
}

async function saveUserPermissions(userId) {
    const checkboxes = document.querySelectorAll('#permissoesForm input[type="checkbox"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    
    showLoading();
    
    try {
        await api('/api/permissoes/updateUserPermissions', 'POST', {
            userId,
            permissions
        });
        
        showToast('Permissões atualizadas com sucesso!', 'success');
    } catch (error) {
        console.error('Error saving permissions:', error);
        showToast(error.message || 'Erro ao salvar permissões', 'error');
    } finally {
        hideLoading();
    }
}

// ========== AUDITORIA (Admin only) ==========
async function loadAuditoria() {
    if (!hasPermission('view_audit')) {
        document.getElementById('auditoriaSection').innerHTML = '<div class="alert alert-error">Você não tem permissão para acessar esta seção.</div>';
        return;
    }
    
    const section = document.getElementById('auditoriaSection');
    
    section.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Auditoria</h2>
                <div class="page-actions">
                    <button class="btn btn-outline" onclick="exportAuditoria('csv')">📋 CSV</button>
                    <button class="btn btn-outline" onclick="exportAuditoria('excel')">📊 Excel</button>
                </div>
            </div>
        </div>
        
        <div class="filters">
            <div class="filters-row">
                <div class="form-group" style="margin: 0;">
                    <input type="date" class="form-control" id="filterDataInicio" onchange="filterAuditoria()">
                </div>
                <div class="form-group" style="margin: 0;">
                    <input type="date" class="form-control" id="filterDataFim" onchange="filterAuditoria()">
                </div>
                <div class="form-group" style="margin: 0;">
                    <input type="text" class="form-control" placeholder="Buscar usuário..." id="filterUsuario" onkeyup="filterAuditoria()">
                </div>
                <div class="form-group" style="margin: 0;">
                    <button class="btn btn-ghost" onclick="clearAuditoriaFilters()">Limpar</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div id="auditoriaTable">Carregando...</div>
            </div>
        </div>
    `;
    
    await fetchAuditoria();
}

async function fetchAuditoria() {
    showLoading();
    
    try {
        const response = await api('/api/auditoria?page=1&perPage=100');
        renderAuditoriaTable(response.logs || []);
    } catch (error) {
        console.error('Error fetching auditoria:', error);
        showToast('Erro ao carregar auditoria', 'error');
    } finally {
        hideLoading();
    }
}

function renderAuditoriaTable(logs) {
    const container = document.getElementById('auditoriaTable');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><div class="empty-state-title">Nenhum registro de auditoria</div></div>';
        return;
    }
    
    let html = '<div class="table-container"><table class="table"><thead><tr>';
    html += '<th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Tabela</th><th>Detalhes</th>';
    html += '</tr></thead><tbody>';
    
    logs.forEach(log => {
        html += '<tr>';
        html += `<td>${formatDateTime(log.data_hora)}</td>`;
        html += `<td>${log.usuario || 'Sistema'}</td>`;
        html += `<td>${log.acao || '-'}</td>`;
        html += `<td>${log.tabela || '-'}</td>`;
        html += `<td>${log.detalhes || '-'}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function filterAuditoria() {
    fetchAuditoria();
}

function clearAuditoriaFilters() {
    document.getElementById('filterDataInicio').value = '';
    document.getElementById('filterDataFim').value = '';
    document.getElementById('filterUsuario').value = '';
    fetchAuditoria();
}

// ========== EXPORT FUNCTIONS ==========
async function exportData(format) {
    showLoading();
    
    try {
        const response = await fetch(`/api/export/processos/${format}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Erro ao exportar');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processos.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast('Exportação concluída!', 'success');
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Erro ao exportar dados', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProcessos(format) {
    await exportData(format);
}

async function exportAuditoria(format) {
    showLoading();
    
    try {
        const response = await fetch(`/api/export/auditoria/${format}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Erro ao exportar');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast('Exportação concluída!', 'success');
    } catch (error) {
        console.error('Error exporting auditoria:', error);
        showToast('Erro ao exportar auditoria', 'error');
    } finally {
        hideLoading();
    }
}

async function backupSystem() {
    if (!confirm('Deseja fazer backup do sistema?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/backup/backup', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-CSRF-Token': await getCsrfToken()
            }
        });
        
        if (!response.ok) throw new Error('Erro ao fazer backup');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast('Backup realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Error creating backup:', error);
        showToast('Erro ao fazer backup', 'error');
    } finally {
        hideLoading();
    }
}
