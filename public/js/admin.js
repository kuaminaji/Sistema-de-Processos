let currentUser = null;
let currentSection = 'dashboard';
let processosData = [];
let clientesData = [];
let usuariosData = [];
let processosPage = 1;
let clientesPage = 1;
let usuariosPage = 1;
let auditoriaPage = 1;
let processosTotalPages = 1;
let clientesTotalPages = 1;
let usuariosTotalPages = 1;
let auditoriaTotalPages = 1;

const PROCESSOS_PER_PAGE = 8;
const CLIENTES_PER_PAGE = 10;
const USUARIOS_PER_PAGE = 10;
const AUDITORIA_PER_PAGE = 20;
const PROCESS_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.xls,.xlsx,.txt';

let processFormAttachments = [];
let selectedProcessClients = [];

const SECTION_META = {
  dashboard: { title: 'Painel', subtitle: 'Visão geral da operação, indicadores e prioridades.' },
  processos: { title: 'Processos', subtitle: 'Carteira processual, prazos e ações do escritório.' },
  clientes: { title: 'Clientes', subtitle: 'Cadastro de pessoas físicas e jurídicas com documento validado.' },
  movimentacoes: { title: 'Movimentações', subtitle: 'Timeline dos casos e registro de andamento.' },
  notificacoes: { title: 'Notificações', subtitle: 'Alertas operacionais e acompanhamento de prazos.' },
  usuarios: { title: 'Usuários', subtitle: 'Contas internas, perfis e segurança de acesso.' },
  permissoes: { title: 'Permissões', subtitle: 'Governança e controle fino por usuário.' },
  auditoria: { title: 'Auditoria', subtitle: 'Rastro de uso por dia, usuário e ação.' },
  configuracoes: { title: 'Configurações', subtitle: 'Backup, restauração e rotinas críticas do sistema.' }
};

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  updateUserInfo();
  setupNavigation();
  await showSection('dashboard');
});

function hasPermission(permission) {
  return currentUser?.role === 'admin' || currentUser?.permissions?.includes(permission);
}

function updateUserInfo() {
  document.getElementById('userName').textContent = currentUser.nome || currentUser.email;
  document.getElementById('userRole').textContent = currentUser.perfil;
  document.getElementById('userAvatar').textContent = (currentUser.nome || currentUser.email || 'U').charAt(0).toUpperCase();
  const headerDate = document.getElementById('headerDate');
  if (headerDate) {
    headerDate.textContent = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  document.querySelectorAll('[data-permission]').forEach((item) => {
    if (!hasPermission(item.dataset.permission)) {
      item.style.display = 'none';
    }
  });
}

function setupNavigation() {
  document.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await showSection(link.dataset.section);
    });
  });
}

async function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });
  document.querySelectorAll('.content-section').forEach((el) => {
    el.style.display = el.id === `${section}Section` ?'block' : 'none';
  });
  const meta = SECTION_META[section] || SECTION_META.dashboard;
  document.getElementById('pageTitle').textContent = meta.title;
  const subtitle = document.getElementById('pageSubtitle');
  if (subtitle) subtitle.textContent = meta.subtitle;

  if (window.innerWidth <= 920) {
    document.getElementById('sidebar')?.classList.remove('open');
  }

  if (section === 'dashboard') await loadDashboard();
  if (section === 'processos') await loadProcessos();
  if (section === 'clientes') await loadClientes();
  if (section === 'movimentacoes') loadMovimentacoes();
  if (section === 'notificacoes') await loadNotifications();
  if (section === 'usuarios') await loadUsuarios();
  if (section === 'permissoes') await loadPermissoes();
  if (section === 'auditoria') await loadAuditoria();
  if (section === 'configuracoes') loadConfiguracoes();
}

async function loadDashboard() {
  const section = document.getElementById('dashboardSection');
  showLoading();

  try {
    const [statsResponse, auditResponse, slaResponse, anomaliasResponse, loginAuditResponse] = await Promise.all([
      api('/api/processos/stats'),
      hasPermission('auditoria.view') ?api('/api/auditoria?perPage=6') : Promise.resolve({ data: { items: [] } }),
      hasPermission('dashboard.view_sla') || hasPermission('auditoria.view') ?api('/api/auditoria/sla') : Promise.resolve({ data: { metricas: {} } }),
      hasPermission('dashboard.view_sla') || hasPermission('auditoria.view') ?api('/api/auditoria/anomalias') : Promise.resolve({ data: { temAnomalias: false, anomalias: {} } }),
      hasPermission('auditoria.view') && currentUser?.email
        ?api(`/api/auditoria?perPage=4&acao=login_sucesso&usuario_email=${encodeURIComponent(currentUser.email)}`)
        : Promise.resolve({ data: { items: [] } })
    ]);

    const stats = statsResponse.data;
    const cards = [
      { kicker: 'Total de processos', value: stats.total || 0, meta: `${stats.recentCount || 0} novos nos ?ltimos 30 dias` },
      { kicker: 'Em andamento', value: stats.porStatus?.em_andamento || 0, meta: `${stats.recentActivityCount || 0} com atividade recente` },
      { kicker: 'Prazos atrasados', value: stats.prazosAtrasados || 0, meta: `${stats.prazosHoje || 0} vencem hoje` },
      { kicker: 'Valor total', value: formatCurrency(stats.valorTotal || 0), meta: `Ticket médio ${formatCurrency(stats.valorMedio || 0)}` }
    ];

    const chartRows = Object.entries(stats.porStatus || {}).sort((a, b) => b[1] - a[1]).map(([status, total]) => {
      const percentage = stats.total ?Math.round((total / stats.total) * 100) : 0;
      return `
        <div class="chart-row">
          <div>${escapeHtml(PROCESS_STATUS_LABELS[status] || status)}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${percentage}%"></div></div>
          <div>${total}</div>
        </div>
      `;
    }).join('');

    const priorityRows = Object.entries(stats.porPrioridade || {}).sort((a, b) => b[1] - a[1]).map(([priority, total]) => {
      const percentage = stats.total ?Math.round((total / stats.total) * 100) : 0;
      return `
        <div class="chart-row">
          <div>${escapeHtml(PRIORITY_LABELS[priority] || priority)}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${percentage}%"></div></div>
          <div>${total}</div>
        </div>
      `;
    }).join('');

    const activity = (auditResponse.data?.items || []).map((log) => `
      <div class="activity-entry">
        <div>
          <strong>${escapeHtml(log.acao)}</strong>
          <div class="text-secondary">${escapeHtml(log.usuario_email || 'Sistema')} · ${formatDateTime(log.criado_em)}</div>
        </div>
      </div>
    `).join('');

    const deadlineItems = (stats.proximosPrazos || []).map((processo) => `
      <div class="file-item">
        <div>
          <strong>${escapeHtml(processo.numero_processo)}</strong>
          <div class="text-secondary">${escapeHtml(processo.titulo)}${getProcessClientSummary(processo) !== 'Sem cliente vinculado' ?` · ${escapeHtml(getProcessClientSummary(processo))}` : ''}</div>
        </div>
        ${getPriorityBadge(processo.prioridade)}
        <div>${getPrazoBadge(processo.prazo_final)}</div>
      </div>
    `).join('');

    const loginItems = (loginAuditResponse.data?.items || []).map((item) => `
      <div class="activity-entry">
        <div>
          <strong>Acesso autorizado</strong>
          <div class="text-secondary">${formatDateTime(item.criado_em)}</div>
        </div>
      </div>
    `).join('');

    const passwordNotice = getPasswordExpiryNotice();
    const auditCountToday = (auditResponse.data?.items || []).length;
    const activePortfolio = stats.total ?Math.round((((stats.porStatus?.em_andamento || 0) + (stats.porStatus?.distribuido || 0)) / stats.total) * 100) : 0;
    const deadlinePressure = stats.total ?Math.round((((stats.prazosAtrasados || 0) + (stats.prazosHoje || 0)) / stats.total) * 100) : 0;
    const healthScore = Math.max(0, Math.min(100, 100 - ((stats.prazosAtrasados || 0) * 8) - Math.round((deadlinePressure || 0) * 0.35)));
    const engagementRate = stats.total ?Math.round(((stats.recentActivityCount || 0) / stats.total) * 100) : 0;

    section.innerHTML = `
      <div class="dashboard-hero">
        <div class="hero-panel">
          <span class="section-kicker">Painel executivo</span>
          <h2>Uma visão mais clara da operação jurídica</h2>
          <p>Organize clientes, acompanhe prazos e navegue pelas rotinas principais sem se perder em excesso de informação.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" type="button" onclick="showSection('processos')">Abrir processos</button>
            <button class="btn btn-outline" type="button" onclick="showSection('clientes')">Abrir clientes</button>
            <a class="btn btn-outline" href="/consulta.html" target="_blank" rel="noopener">Consulta pública</a>
          </div>
        </div>
        <div class="hero-sidecard">
          <span class="section-kicker">Resumo rápido</span>
          <h3 class="card-title">O que precisa de atenção agora</h3>
          <div class="metric-stack">
            <div class="metric-line"><span>Prazos atrasados</span><strong>${escapeHtml(String(stats.prazosAtrasados || 0))}</strong></div>
            <div class="metric-line"><span>Prazos de hoje</span><strong>${escapeHtml(String(stats.prazosHoje || 0))}</strong></div>
            <div class="metric-line"><span>Atividades recentes</span><strong>${escapeHtml(String(auditCountToday))}</strong></div>
          </div>
          <div class="inline-kpis">
            <div class="mini-kpi"><span class="text-secondary">Novos no mês</span><strong>${escapeHtml(String(stats.recentCount || 0))}</strong></div>
            <div class="mini-kpi"><span class="text-secondary">Sem atividade</span><strong>${escapeHtml(String((stats.total || 0) - (stats.recentActivityCount || 0)))}</strong></div>
          </div>
        </div>
      </div>
      ${passwordNotice ?`<div class="alert alert-warning mb-3">${passwordNotice}</div>` : ''}
      <div class="stats-grid">
        ${cards.map((card) => `
          <div class="stat-card">
            <div class="stat-kicker">${escapeHtml(card.kicker)}</div>
            <div class="stat-value">${escapeHtml(String(card.value))}</div>
            <div class="stat-meta">${escapeHtml(card.meta)}</div>
          </div>
        `).join('')}
      </div>
      <div class="premium-band">
        <div class="premium-pill-card">
          <span class="text-secondary">Saúde da carteira</span>
          <strong>${healthScore}%</strong>
          <div class="text-secondary">Indicador sintético considerando atrasos e pressão de prazo.</div>
        </div>
        <div class="premium-pill-card">
          <span class="text-secondary">Portfólio ativo</span>
          <strong>${activePortfolio}%</strong>
          <div class="text-secondary">Percentual de processos distribuídos ou em andamento.</div>
        </div>
        <div class="premium-pill-card">
          <span class="text-secondary">Engajamento recente</span>
          <strong>${engagementRate}%</strong>
          <div class="text-secondary">Carteira com movimentação recente no período.</div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-item col-8">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">Distribuição por status</h3>
                <p>Mapa visual da carteira para leitura rápida do momento operacional.</p>
              </div>
            </div>
            <div class="card-body dashboard-split">
              <div class="chart-bars">${chartRows || renderEmptyState('Sem dados', 'Nenhum processo cadastrado.')}</div>
              <div class="donut-panel">
                <div class="data-ring success" style="--ring-value:${Math.max(0, Math.min(100, activePortfolio))}">
                  <div class="ring-center">
                    <strong>${activePortfolio}%</strong>
                    <span>ativos</span>
                  </div>
                </div>
                <div class="text-center text-secondary">Carteira em status mais operacionais.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="dashboard-item col-4">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">Prazos e alertas</h3>
                <p>Pontos que merecem resposta rápida da equipe.</p>
              </div>
            </div>
            <div class="card-body">
              <div class="inline-kpis mb-3">
                <div class="mini-kpi"><span class="text-secondary">Atrasados</span><strong>${escapeHtml(String(stats.prazosAtrasados || 0))}</strong></div>
                <div class="mini-kpi"><span class="text-secondary">Vencem hoje</span><strong>${escapeHtml(String(stats.prazosHoje || 0))}</strong></div>
                <div class="mini-kpi"><span class="text-secondary">Prox. 7 dias</span><strong>${escapeHtml(String(stats.prazosProximos || 0))}</strong></div>
              </div>
              <div class="file-list">${deadlineItems || renderEmptyState('Sem prazos ativos', 'Nenhum prazo cadastrado para os processos.')}</div>
            </div>
          </div>
        </div>
        <div class="dashboard-item col-8">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">Distribuição por prioridade</h3>
                <p>Entenda o peso da carteira e a concentração de casos mais sensíveis.</p>
              </div>
            </div>
            <div class="card-body dashboard-split">
              <div class="chart-bars">${priorityRows || renderEmptyState('Sem prioridades', 'Nenhum processo com prioridade definida.')}</div>
              <div class="donut-panel">
                <div class="data-ring warning" style="--ring-value:${Math.max(0, Math.min(100, deadlinePressure))}">
                  <div class="ring-center">
                    <strong>${deadlinePressure}%</strong>
                    <span>pressão</span>
                  </div>
                </div>
                <div class="text-center text-secondary">Peso relativo de atrasos e vencimentos imediatos.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="dashboard-item col-4">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">Atividade recente</h3>
                <p>?ltimos eventos relevantes capturados no sistema.</p>
              </div>
            </div>
            <div class="card-body activity-feed">${activity || renderEmptyState('Sem movimentação', 'Nenhuma atividade recente.')}</div>
          </div>
        </div>
        <div class="dashboard-item col-8">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">SLA, disponibilidade e acessos</h3>
                <p>Indicadores técnicos combinados com a trilha recente de acessos autorizados.</p>
              </div>
            </div>
            <div class="card-body">
              <div class="metric-grid-3">
                <div class="metric-card-soft"><span class="text-secondary">Disponibilidade</span><strong>${escapeHtml(String(slaResponse.data?.metricas?.disponibilidade ?? '-'))}%</strong></div>
                <div class="metric-card-soft"><span class="text-secondary">Taxa de erro</span><strong>${escapeHtml(String(slaResponse.data?.metricas?.taxaErro ?? '-'))}%</strong></div>
                <div class="metric-card-soft"><span class="text-secondary">Média diária</span><strong>${escapeHtml(String(slaResponse.data?.metricas?.mediaRequisicoesPorDia ?? '-'))}</strong></div>
              </div>
              <div class="activity-feed mt-3">${loginItems || renderEmptyState('Sem histórico de acesso', 'Nenhum login recente registrado.')}</div>
            </div>
          </div>
        </div>
        <div class="dashboard-item col-4">
          <div class="card dashboard-card-premium">
            <div class="card-header">
              <div class="card-heading">
                <h3 class="card-title">Anomalias</h3>
                <p>Leitura sintética sobre comportamento atípico recente.</p>
              </div>
            </div>
            <div class="card-body">
              <div class="donut-panel mb-3">
                <div class="data-ring ${anomaliasResponse.data?.temAnomalias ?'warning' : 'success'}" style="--ring-value:${anomaliasResponse.data?.temAnomalias ?68 : 92}">
                  <div class="ring-center">
                    <strong>${anomaliasResponse.data?.temAnomalias ?'AT' : 'OK'}</strong>
                    <span>${anomaliasResponse.data?.temAnomalias ?'alerta' : 'estavel'}</span>
                  </div>
                </div>
              </div>
              ${anomaliasResponse.data?.temAnomalias ?'<div class="alert alert-warning">Foram detectadas anomalias recentes na auditoria.</div>' : '<div class="alert alert-success">Nenhuma anomalia relevante detectada.</div>'}
              <div class="mini-list">
                <div class="mini-list-item"><span>Eventos auditados</span><strong>${auditCountToday}</strong></div>
                <div class="mini-list-item"><span>Saúde operacional</span><strong>${healthScore}%</strong></div>
                <div class="mini-list-item"><span>Carteira ativa</span><strong>${activePortfolio}%</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    section.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function getPasswordExpiryNotice() {
  if (!currentUser?.senha_expira_em) return '';
  const expiry = new Date(currentUser.senha_expira_em);
  const now = new Date();
  const diffDays = Math.ceil((expiry - now) / 86400000);
  if (Number.isNaN(diffDays)) return '';
  if (diffDays < 0) return 'A senha desta conta esta expirada. Faça a troca imediatamente para manter a seguranca.';
  if (diffDays <= 7) return `A senha desta conta expira em ${diffDays} dia(s). Recomendado trocar antes do vencimento.`;
  return '';
}

async function loadProcessos() {
  const section = document.getElementById('processosSection');
  section.innerHTML = `
    <div class="section-shell">
      <div class="page-header">
        <div class="page-title">
          <div><h2>Processos</h2><p>Controle dos casos, anexos e andamento.</p></div>
          <div class="page-actions">
            <button class="btn btn-primary" type="button" onclick="showProcessoForm()">Novo processo</button>
          </div>
        </div>
      </div>
      <div class="filters filters-premium">
        <div class="section-intro">
          <div>
            <span class="list-highlight">Carteira processual</span>
            <h3 class="card-title mt-2">Busca rápida e leitura mais operacional</h3>
            <p class="text-secondary">Filtre por situação, prioridade e termos-chave para encontrar o caso certo mais rápido.</p>
          </div>
        </div>
        <div class="filters-row">
          <input id="searchProcessos" class="form-control" placeholder="Buscar por número, título, autor, réu ou cliente">
          <select id="filterStatus" class="form-control">
            <option value="">Todos os status</option>
            <option value="distribuido">Distribuído</option>
            <option value="em_andamento">Em andamento</option>
            <option value="suspenso">Suspenso</option>
            <option value="arquivado">Arquivado</option>
            <option value="sentenciado">Sentenciado</option>
            <option value="transitado_em_julgado">Transitado em julgado</option>
          </select>
          <select id="filterPrioridade" class="form-control">
            <option value="">Todas as prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <button class="btn btn-ghost" type="button" onclick="clearProcessosFilters()">Limpar filtros</button>
        </div>
      </div>
      <div id="processosOverview" class="data-overview"></div>
      <div class="card"><div class="card-body" id="processosTable"></div></div>
    </div>
  `;

  document.getElementById('searchProcessos').addEventListener('input', () => {
    processosPage = 1;
    fetchProcessos();
  });
  document.getElementById('filterStatus').addEventListener('change', () => {
    processosPage = 1;
    fetchProcessos();
  });
  document.getElementById('filterPrioridade').addEventListener('change', () => {
    processosPage = 1;
    fetchProcessos();
  });

  await fetchProcessos();
}

async function fetchProcessos() {
  showLoading();
  try {
    const params = new URLSearchParams({
      page: String(processosPage),
      perPage: String(PROCESSOS_PER_PAGE),
      sortBy: 'criado_em',
      sortOrder: 'DESC'
    });
    const numero = document.getElementById('searchProcessos')?.value?.trim();
    const status = document.getElementById('filterStatus')?.value;
    const prioridade = document.getElementById('filterPrioridade')?.value;
    if (numero) params.append('numero', numero);
    if (status) params.append('status', status);
    if (prioridade) params.append('prioridade', prioridade);
    const response = await api(`/api/processos?${params.toString()}`);
    processosData = response.data.items || [];
    processosTotalPages = response.data.totalPages || 1;
    renderProcessosTable();
  } catch (error) {
    document.getElementById('processosTable').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function renderProcessosTable() {
  const container = document.getElementById('processosTable');
  const overview = document.getElementById('processosOverview');
  if (!container) return;

  const total = processosData.length;
  const urgentes = processosData.filter((processo) => processo.prioridade === 'urgente').length;
  const comPrazo = processosData.filter((processo) => processo.prazo_final).length;
  const atrasados = processosData.filter((processo) => processo.prazo_final && getPrazoInfo(processo.prazo_final).state === 'danger').length;

  if (overview) {
    overview.innerHTML = `
      <div class="overview-tile"><span class="text-secondary">Registros na página</span><strong>${total}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Urgentes</span><strong>${urgentes}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Com prazo definido</span><strong>${comPrazo}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Prazos atrasados</span><strong>${atrasados}</strong></div>
    `;
  }

  if (!processosData.length) {
    container.innerHTML = renderEmptyState('Nenhum processo encontrado', 'Ajuste os filtros ou cadastre um novo processo.');
    return;
  }

  container.innerHTML = `
    <div class="table-shell">
      <div class="table-meta">
        <div>
          <strong>Lista de processos</strong>
          <div class="table-note">Os itens mais novos aparecem primeiro, com prioridade e prazo visíveis.</div>
        </div>
        <span class="list-highlight">${processosTotalPages} pagina(s)</span>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr><th>Processo</th><th>Partes e cliente</th><th>Prioridade</th><th>Prazo</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${processosData.map((processo) => `
              <tr>
                <td class="entity-cell">
                  <strong>${escapeHtml(processo.numero_processo)}</strong>
                  <span class="text-secondary">${escapeHtml(processo.titulo)}</span>
                  <small>${escapeHtml(processo.tipo_acao || 'Tipo de ação não informado')}</small>
                </td>
                <td class="entity-cell">
                  <strong>${escapeHtml(getProcessClientSummary(processo))}</strong>
                  <span class="text-secondary">Autor: ${escapeHtml(processo.autor || '-')}</span>
                  <small>Réu: ${escapeHtml(processo.reu || '-')}</small>
                </td>
                <td>${getPriorityBadge(processo.prioridade)}</td>
                <td class="status-stack">${processo.prazo_final ?`<strong>${formatDate(processo.prazo_final)}</strong><span class="text-secondary">${escapeHtml(getPrazoInfo(processo.prazo_final).label)}</span>` : '<span class="text-secondary">Não definido</span>'}</td>
                <td>${getStatusBadge(processo.status)}</td>
                <td class="table-actions">
                  <button class="btn btn-sm btn-outline" type="button" onclick="viewProcesso(${processo.id})">Ver</button>
                  <button class="btn btn-sm btn-ghost" type="button" onclick="showProcessoForm(${processo.id})">Editar</button>
                  <button class="btn btn-sm btn-danger" type="button" onclick="deleteProcesso(${processo.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${createPagination(processosPage, processosTotalPages, 'goToProcessosPage')}
    </div>
  `;
}

function clearProcessosFilters() {
  document.getElementById('searchProcessos').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterPrioridade').value = '';
  processosPage = 1;
  fetchProcessos();
}

function goToProcessosPage(page) {
  processosPage = page;
  fetchProcessos();
}

async function loadClientes() {
  const section = document.getElementById('clientesSection');
  section.innerHTML = `
    <div class="section-shell">
      <div class="page-header">
        <div class="page-title">
          <div><h2>Clientes</h2><p>Cadastro com validação de CPF e CNPJ.</p></div>
          <div class="page-actions"><button class="btn btn-primary" type="button" onclick="showClienteForm()">Novo cliente</button></div>
        </div>
      </div>
      <div class="filters filters-premium">
        <div class="section-intro">
          <div>
            <span class="list-highlight">Base de clientes</span>
            <h3 class="card-title mt-2">Cadastro claro para pessoa física e jurídica</h3>
            <p class="text-secondary">Visual mais limpo para localizar documentos, contatos e clientes vinculados ao escritório.</p>
          </div>
        </div>
        <div class="filters-row">
          <input id="searchClientes" class="form-control" placeholder="Buscar por nome, documento ou email">
          <select id="filterTipoDocumento" class="form-control">
            <option value="">Todos os documentos</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
      </div>
      <div id="clientesOverview" class="data-overview"></div>
      <div class="card"><div class="card-body" id="clientesTable"></div></div>
    </div>
  `;

  document.getElementById('searchClientes').addEventListener('input', () => {
    clientesPage = 1;
    fetchClientes();
  });
  document.getElementById('filterTipoDocumento').addEventListener('change', () => {
    clientesPage = 1;
    fetchClientes();
  });
  await fetchClientes();
}

async function fetchClientes() {
  showLoading();
  try {
    const params = new URLSearchParams({
      page: String(clientesPage),
      perPage: String(CLIENTES_PER_PAGE),
      sortBy: 'nome',
      sortOrder: 'ASC'
    });
    const nome = document.getElementById('searchClientes')?.value?.trim();
    const tipo = document.getElementById('filterTipoDocumento')?.value;
    if (nome) params.append('nome', nome);
    if (tipo) params.append('tipo_documento', tipo);
    const response = await api(`/api/clientes?${params.toString()}`);
    clientesData = response.data.items || [];
    clientesTotalPages = response.data.totalPages || 1;
    renderClientesTable();
  } catch (error) {
    document.getElementById('clientesTable').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function renderClientesTable() {
  const container = document.getElementById('clientesTable');
  const overview = document.getElementById('clientesOverview');
  if (!container) return;

  const total = clientesData.length;
  const pf = clientesData.filter((cliente) => cliente.tipo_documento === 'CPF').length;
  const pj = clientesData.filter((cliente) => cliente.tipo_documento === 'CNPJ').length;
  const comEmail = clientesData.filter((cliente) => cliente.email).length;

  if (overview) {
    overview.innerHTML = `
      <div class="overview-tile"><span class="text-secondary">Registros na página</span><strong>${total}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Pessoas físicas</span><strong>${pf}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Empresas</span><strong>${pj}</strong></div>
      <div class="overview-tile"><span class="text-secondary">Com email</span><strong>${comEmail}</strong></div>
    `;
  }

  if (!clientesData.length) {
    container.innerHTML = renderEmptyState('Nenhum cliente encontrado', 'Cadastre clientes ou altere os filtros.');
    return;
  }

  container.innerHTML = `
    <div class="table-shell">
      <div class="table-meta">
        <div>
          <strong>Lista de clientes</strong>
          <div class="table-note">Documento, email e canais de contato ficam visíveis sem poluir a tela.</div>
        </div>
        <span class="list-highlight">${clientesTotalPages} pagina(s)</span>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr><th>Cliente</th><th>Documento</th><th>Contato principal</th><th>WhatsApp</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${clientesData.map((cliente) => `
              <tr>
                <td class="entity-cell">
                  <strong>${escapeHtml(cliente.nome)}</strong>
                  <span class="text-secondary">${cliente.tipo_documento === 'CNPJ' ?'Pessoa juridica' : 'Pessoa fisica'}</span>
                </td>
                <td><span class="badge badge-${cliente.tipo_documento === 'CNPJ' ?'info' : 'primary'}">${escapeHtml(cliente.tipo_documento)} ${escapeHtml(formatDocument(cliente.documento, cliente.tipo_documento))}</span></td>
                <td class="entity-cell">
                  <strong>${escapeHtml(cliente.email || 'Sem email cadastrado')}</strong>
                  <small>${cliente.email ?'Email principal do cadastro' : 'Atualize o cadastro para melhorar o contato.'}</small>
                </td>
                <td>${escapeHtml(formatPhone(cliente.whatsapp || '')) || '-'}</td>
                <td class="table-actions">
                  <button class="btn btn-sm btn-outline" type="button" onclick="viewCliente(${cliente.id})">Ver</button>
                  <button class="btn btn-sm btn-ghost" type="button" onclick="showClienteForm(${cliente.id})">Editar</button>
                  <button class="btn btn-sm btn-danger" type="button" onclick="deleteCliente(${cliente.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${createPagination(clientesPage, clientesTotalPages, 'goToClientesPage')}
    </div>
  `;
}

function goToClientesPage(page) {
  clientesPage = page;
  fetchClientes();
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSelectedAuditDate() {
  return document.getElementById('auditDate')?.value || getTodayInputValue();
}

function getAuditDateRange(dateValue) {
  return {
    start: `${dateValue}T00:00:00`,
    end: `${dateValue}T23:59:59`
  };
}

function formatDateLabel(dateValue) {
  if (!dateValue) return '-';
  const [year, month, day] = String(dateValue).split('-');
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
}

function getDocumentExpectedLength(type) {
  return String(type).toUpperCase() === 'CNPJ' ?14 : 11;
}

function updateDocumentInputFeedback(tipoSelect, documentoInput, feedbackElement) {
  if (!tipoSelect || !documentoInput || !feedbackElement) return;

  const type = String(tipoSelect.value || 'CPF').toUpperCase();
  const digits = normalizeDigits(documentoInput.value);
  const expectedLength = getDocumentExpectedLength(type);
  documentoInput.classList.remove('error', 'valid');
  feedbackElement.className = 'form-feedback info';

  if (!digits.length) {
    feedbackElement.textContent = `${type} será validado em tempo real enquanto voc?digita.`;
    return;
  }

  if (digits.length < expectedLength) {
    const remaining = expectedLength - digits.length;
    feedbackElement.textContent = `Digite mais ${remaining} número(s) para validar o ${type}.`;
    return;
  }

  if (validateDocument(documentoInput.value, type)) {
    documentoInput.classList.add('valid');
    feedbackElement.className = 'form-feedback success';
    feedbackElement.textContent = `${type} válido.`;
    return;
  }

  documentoInput.classList.add('error');
  feedbackElement.className = 'form-feedback error';
  feedbackElement.textContent = `${type} inválido. Verifique os números digitados.`;
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function getPendingAttachmentKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getProcessClientSummary(processo) {
  const clientes = Array.isArray(processo?.clientes) ?processo.clientes : [];
  const nomes = clientes.map((cliente) => cliente.nome).filter(Boolean);
  if (nomes.length) return nomes.join(' | ');
  return processo?.cliente_nomes || processo?.cliente_nome || 'Sem cliente vinculado';
}

function updateProcessClientFeedback(message, type = 'info') {
  const feedback = document.getElementById('processoClienteFeedback');
  if (!feedback) return;
  feedback.className = `form-feedback ${type}`;
  feedback.textContent = message;
}

function renderSelectedProcessClients() {
  const container = document.getElementById('selectedProcessClients');
  if (!container) return;

  if (!selectedProcessClients.length) {
    container.innerHTML = renderEmptyState(
      'Nenhum cliente vinculado',
      'Digite o CPF ou CNPJ de um cliente já cadastrado para adicionar um ou vários clientes a este processo.'
    );
    return;
  }

  container.innerHTML = `
    <div class="selected-entity-list">
      ${selectedProcessClients.map((cliente, index) => `
        <div class="selected-entity-chip">
          <div>
            <strong>${escapeHtml(cliente.nome)}</strong>
            <div class="text-secondary">${escapeHtml(cliente.tipo_documento)} ${escapeHtml(formatDocument(cliente.documento, cliente.tipo_documento))}</div>
          </div>
          <button class="btn btn-sm btn-danger" type="button" onclick="removeSelectedProcessClient(${index})">Remover</button>
        </div>
      `).join('')}
    </div>
  `;
}

async function findClientByDocument(documento) {
  const documentoNormalizado = normalizeDigits(documento);
  if (!documentoNormalizado) return null;

  const response = await api(`/api/clientes?documento=${encodeURIComponent(documentoNormalizado)}&perPage=20&sortBy=nome&sortOrder=ASC`);
  const items = response.data.items || [];
  return items.find((cliente) => normalizeDigits(cliente.documento) === documentoNormalizado) || null;
}

async function addProcessClientToForm() {
  const input = document.getElementById('processoClienteDocumentoInput');
  if (!input) return;

  const documento = input.value.trim();
  if (!documento) {
    updateProcessClientFeedback('Digite um CPF ou CNPJ para localizar o cliente.', 'error');
    input.classList.add('error');
    return;
  }

  if (!validateDocument(documento)) {
    updateProcessClientFeedback('CPF ou CNPJ inválido. Confira os números digitados.', 'error');
    input.classList.add('error');
    return;
  }

  showLoading();
  try {
    const cliente = await findClientByDocument(documento);
    if (!cliente) {
      updateProcessClientFeedback('Nenhum cliente cadastrado foi encontrado com este CPF ou CNPJ.', 'error');
      input.classList.add('error');
      return;
    }

    const normalized = normalizeDigits(cliente.documento);
    if (selectedProcessClients.some((item) => normalizeDigits(item.documento) === normalized)) {
      updateProcessClientFeedback('Este cliente já est?vinculado ao processo.', 'warning');
      input.value = '';
      input.classList.remove('error');
      return;
    }

    selectedProcessClients.push({
      id: cliente.id,
      nome: cliente.nome,
      documento: cliente.documento,
      tipo_documento: cliente.tipo_documento
    });
    input.value = '';
    input.classList.remove('error');
    updateProcessClientFeedback('Cliente vinculado ao processo.', 'success');
    renderSelectedProcessClients();
  } catch (error) {
    updateProcessClientFeedback(error.message, 'error');
    input.classList.add('error');
  } finally {
    hideLoading();
  }
}

function removeSelectedProcessClient(index) {
  selectedProcessClients = selectedProcessClients.filter((_, itemIndex) => itemIndex !== Number(index));
  renderSelectedProcessClients();
  updateProcessClientFeedback('Vínculos atualizados.', 'info');
}

function mapProcessFormAttachmentRecord(anexo, status) {
  return {
    id: anexo.id,
    nome_original: anexo.nome_original,
    nome_arquivo: anexo.nome_arquivo,
    mime_type: anexo.mime_type,
    tamanho_bytes: anexo.tamanho_bytes,
    criado_em: anexo.criado_em,
    url: anexo.url || '',
    status
  };
}

function renderPendingProcessAttachments(processoId = null) {
  const container = document.getElementById('pendingProcessFiles');
  if (!container) return;

  if (!processFormAttachments.length) {
    container.innerHTML = renderEmptyState(
      'Nenhum anexo selecionado',
      processoId
        ?'Selecione PDF, Word, imagem, planilhas ou texto. O envio acontece imediatamente.'
        : 'Selecione PDF, Word, imagem, planilhas ou texto. O envio acontece imediatamente e o arquivo fica reservado para este novo processo.'
    );
    return;
  }

  container.innerHTML = processFormAttachments.map((anexo) => `
    <div class="file-item pending">
      <div>
        <strong>${escapeHtml(anexo.nome_original)}</strong>
        <div class="text-secondary">${escapeHtml(anexo.mime_type || 'arquivo')} · ${formatFileSize(anexo.tamanho_bytes)}</div>
      </div>
      <div class="table-actions">
        <span class="badge badge-${anexo.status === 'salvo' ?'success' : 'info'}">${anexo.status === 'salvo' ?'Anexado' : 'Pronto para salvar'}</span>
        ${anexo.url ?`<button class="btn btn-sm btn-outline" type="button" onclick="previewAnexo('${anexo.url}', '${escapeHtml(anexo.nome_original)}', '${anexo.mime_type}')">Visualizar</button>` : ''}
        <button class="btn btn-sm btn-danger" type="button" onclick="removeProcessFormAttachment(${anexo.id}, ${processoId || 'null'})">Remover</button>
      </div>
    </div>
  `).join('');
}

async function uploadSingleProcessAttachment(file, processoId = null) {
  const formData = new FormData();
  formData.append('arquivo', file);

  const endpoint = processoId
    ?`/api/processos/${processoId}/anexos`
    : '/api/processos/anexos-temporarios';

  const response = await api(endpoint, 'POST', formData);
  return mapProcessFormAttachmentRecord(response.data, processoId ?'salvo' : 'temporario');
}

async function handlePendingProcessAttachments(input, processoId = null) {
  const files = Array.from(input?.files || []);
  if (!files.length) return;

  const existing = new Set(processFormAttachments.map((item) => item.nome_arquivo));
  const uploaded = [];
  const failed = [];

  showLoading();
  try {
    for (const file of files) {
      const record = await uploadSingleProcessAttachment(file, processoId).catch((error) => {
        failed.push({ name: file.name, message: error.message });
        return null;
      });

      if (!record || existing.has(record.nome_arquivo)) continue;
      processFormAttachments.push(record);
      existing.add(record.nome_arquivo);
      uploaded.push(file.name);
    }
  } finally {
    hideLoading();
    input.value = '';
    renderPendingProcessAttachments(processoId);
  }

  if (uploaded.length && failed.length) {
    showToast(`${uploaded.length} arquivo(s) enviados e ${failed.length} falharam`, 'warning', 6000);
  } else if (uploaded.length) {
    showToast(`${uploaded.length} arquivo(s) enviados com sucesso`, 'success');
  } else if (failed.length) {
    showToast(failed[0].message || 'Não foi possível enviar os arquivos selecionados', 'error');
  }
}

async function removeProcessFormAttachment(anexoId, processoId = null) {
  if (!confirm('Remover este anexo?')) return;

  showLoading();
  try {
    const endpoint = processoId
      ?`/api/processos/${processoId}/anexos/${anexoId}`
      : `/api/processos/anexos-temporarios/${anexoId}`;
    await api(endpoint, 'DELETE');
    processFormAttachments = processFormAttachments.filter((anexo) => Number(anexo.id) !== Number(anexoId));
    renderPendingProcessAttachments(processoId);
    showToast('Anexo removido com sucesso', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function uploadAttachmentsBatch(processoId, files) {
  const uploaded = [];
  const failed = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append('arquivo', file);

    try {
      await api(`/api/processos/${processoId}/anexos`, 'POST', formData);
      uploaded.push(file.name);
    } catch (error) {
      failed.push({ name: file.name, message: error.message });
    }
  }

  return { uploaded, failed };
}

async function showProcessoForm(id = null) {
  showLoading();
  try {
    const isEdit = Boolean(id);
    if (!isEdit) {
      try {
        await api('/api/processos/anexos-temporarios', 'DELETE');
      } catch (error) {}
    }

    const response = isEdit ?await api(`/api/processos/${id}`) : { data: { processo: {}, anexos: [] } };
    const processo = response.data.processo || {};
    const anexos = response.data.anexos || [];
    selectedProcessClients = Array.isArray(processo.clientes)
      ?processo.clientes.map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        documento: cliente.documento || cliente.cpf,
        tipo_documento: cliente.tipo_documento
      }))
      : [];
    processFormAttachments = isEdit
      ?anexos.map((anexo) => mapProcessFormAttachmentRecord(anexo, 'salvo'))
      : [];

    showModal(
      isEdit ?'Editar processo' : 'Novo processo',
      `
        <form id="processoForm">
          <div class="modal-intro">
            <p>Preencha os dados principais do caso, vincule clientes por CPF ou CNPJ e deixe prazos e prioridade bem definidos para o painel trabalhar a seu favor.</p>
          </div>
          <div class="form-shell">
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Identificação do processo</div>
                  <div class="form-section-description">Os campos desta área aparecem como referência principal nas listagens.</div>
                </div>
                <span class="section-kicker">Essencial</span>
              </div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label required">Número do processo</label><input name="numero_processo" class="form-control" value="${escapeHtml(processo.numero_processo || '')}" required><div class="form-text">Use o padrão CNJ com 20 dígitos.</div></div>
                <div class="form-group field-card"><label class="form-label required">Status</label><select name="status" class="form-control" required>${Object.entries(PROCESS_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${processo.status === value ?'selected' : ''}>${label}</option>`).join('')}</select></div>
              </div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label required">Título</label><input name="titulo" class="form-control" value="${escapeHtml(processo.titulo || '')}" required></div>
                <div class="form-group field-card"><label class="form-label">Tipo de ação</label><input name="tipo_acao" class="form-control" value="${escapeHtml(processo.tipo_acao || '')}" placeholder="Ex.: cobrança, família, cível"></div>
              </div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label required">Autor</label><input name="autor" class="form-control" value="${escapeHtml(processo.autor || '')}" required></div>
                <div class="form-group field-card"><label class="form-label required">Réu</label><input name="reu" class="form-control" value="${escapeHtml(processo.reu || '')}" required></div>
              </div>
            </section>
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Vínculo e estratégia</div>
                  <div class="form-section-description">Conecte um ou vários clientes pelo CPF ou CNPJ e registre dados operacionais que ajudam nos filtros.</div>
                </div>
                <span class="section-kicker">Controle</span>
              </div>
              <div class="form-group field-card">
                <label class="form-label">Clientes vinculados</label>
                <div class="process-client-picker">
                  <div class="process-client-picker-row">
                    <input id="processoClienteDocumentoInput" class="form-control" placeholder="Digite o CPF ou CNPJ do cliente">
                    <button class="btn btn-outline" type="button" onclick="addProcessClientToForm()">Adicionar cliente</button>
                  </div>
                  <div id="processoClienteFeedback" class="form-feedback info">Digite um CPF ou CNPJ já cadastrado para vincular um ou vários clientes a este processo.</div>
                  <div id="selectedProcessClients"></div>
                </div>
              </div>
              <div class="form-row cols-3">
                <div class="form-group field-card"><label class="form-label">Data de distribuição</label><input name="data_distribuicao" type="date" class="form-control" value="${formatDateInput(processo.data_distribuicao)}"></div>
                <div class="form-group field-card"><label class="form-label">Valor da causa</label><input name="valor_causa" type="number" min="0" step="0.01" class="form-control" value="${escapeHtml(processo.valor_causa || '')}"></div>
                <div class="form-group field-card"><label class="form-label">Prioridade</label><select name="prioridade" class="form-control"><option value="baixa" ${processo.prioridade === 'baixa' ?'selected' : ''}>Baixa</option><option value="media" ${!processo.prioridade || processo.prioridade === 'media' ?'selected' : ''}>Média</option><option value="alta" ${processo.prioridade === 'alta' ?'selected' : ''}>Alta</option><option value="urgente" ${processo.prioridade === 'urgente' ?'selected' : ''}>Urgente</option></select></div>
              </div>
              <div class="form-row cols-3">
                <div class="form-group field-card"><label class="form-label">Prazo final</label><input name="prazo_final" type="date" class="form-control" value="${formatDateInput(processo.prazo_final)}"></div>
                <div class="form-group field-card"><label class="form-label">Vara</label><input name="vara" class="form-control" value="${escapeHtml(processo.vara || '')}"></div>
                <div class="form-group field-card"><label class="form-label">Comarca</label><input name="comarca" class="form-control" value="${escapeHtml(processo.comarca || '')}"></div>
              </div>
            </section>
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Equipe e observações</div>
                  <div class="form-section-description">Deixe o histórico inicial do processo claro para quem assumir o caso depois.</div>
                </div>
                <span class="section-kicker">Contexto</span>
              </div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label">Advogado do autor</label><input name="advogado_autor" class="form-control" value="${escapeHtml(processo.advogado_autor || '')}"></div>
                <div class="form-group field-card"><label class="form-label">Advogado do réu</label><input name="advogado_reu" class="form-control" value="${escapeHtml(processo.advogado_reu || '')}"></div>
              </div>
              <div class="form-group field-card"><label class="form-label">Descrição</label><textarea name="descricao" class="form-control">${escapeHtml(processo.descricao || '')}</textarea></div>
              <div class="form-group field-card"><label class="form-label">Observações internas</label><textarea name="observacoes" class="form-control">${escapeHtml(processo.observacoes || '')}</textarea></div>
            </section>
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Anexos do processo</div>
                  <div class="form-section-description">${isEdit ?'Selecione os arquivos e o envio acontece imediatamente para este processo.' : 'Selecione os arquivos e o envio acontece imediatamente. Eles ficam reservados até a criação do processo.'}</div>
                </div>
                <span class="section-kicker">Arquivos</span>
              </div>
              <div class="file-dropzone mb-3">
                <input id="processoAnexosInput" type="file" class="form-control" multiple accept="${PROCESS_ATTACHMENT_ACCEPT}">
                <div class="form-text">Aceita PDF, Word, imagem, planilhas e texto.</div>
              </div>
              <div id="pendingProcessFiles" class="file-list"></div>
            </section>
          </div>
        </form>
      `,
      `<button class="btn btn-secondary" type="button" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="button" onclick="saveProcesso(${id || 'null'})">${isEdit ?'Salvar processo' : 'Criar processo'}</button>`
    );

    const processClientInput = document.getElementById('processoClienteDocumentoInput');
    processClientInput?.addEventListener('input', (event) => {
      event.target.value = formatDocument(event.target.value);
      event.target.classList.remove('error');
      updateProcessClientFeedback('Digite um CPF ou CNPJ já cadastrado para vincular um ou vários clientes a este processo.', 'info');
    });
    processClientInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addProcessClientToForm();
      }
    });
    document.getElementById('processoAnexosInput')?.addEventListener('change', (event) => {
      handlePendingProcessAttachments(event.target, id);
    });
    renderSelectedProcessClients();
    renderPendingProcessAttachments(id);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function saveProcesso(id) {
  const form = document.getElementById('processoForm');
  if (!validateForm(form)) {
    showToast('Preencha os campos obrigatórios', 'error');
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  data.cliente_documentos = selectedProcessClients.map((cliente) => normalizeDigits(cliente.documento));
  if (normalizeDigits(data.numero_processo).length !== 20) {
    showToast('Número do processo deve seguir o padrão CNJ', 'error');
    return;
  }

  showLoading();
  try {
    const response = await api(id ?`/api/processos/${id}` : '/api/processos', id ?'PUT' : 'POST', data);
    processFormAttachments = [];
    selectedProcessClients = [];
    closeModal();
    const totalClientes = Array.isArray(response.data?.clientes) ?response.data.clientes.length : data.cliente_documentos.length;
    const totalAnexos = Number(response.data?.anexos_importados || 0);
    const clientMessage = totalClientes ?` com ${totalClientes} cliente(s) vinculado(s)` : '';
    const attachmentMessage = !id && totalAnexos ?` e ${totalAnexos} anexo(s) incorporado(s)` : '';
    showToast(`Processo ${id ?'atualizado' : 'criado'} com sucesso${clientMessage}${attachmentMessage}`, 'success', 5000);
    await fetchProcessos();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function showClienteForm(id = null) {
  showLoading();
  try {
    const isEdit = Boolean(id);
    const response = isEdit ?await api(`/api/clientes/${id}`) : { data: { cliente: {} } };
    const cliente = response.data.cliente || {};

    showModal(
      isEdit ?'Editar cliente' : 'Novo cliente',
      `
        <form id="clienteForm">
          <div class="modal-intro">
            <p>Cadastre pessoas físicas e jurídicas com documento validado, contatos bem organizados e espação para anotações importantes de atendimento.</p>
          </div>
          <div class="form-shell">
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Identificação do cliente</div>
                  <div class="form-section-description">Esses dados aparecem em toda a operação, por isso ficam em destaque.</div>
                </div>
                <span class="section-kicker">Cadastro</span>
              </div>
              <div class="form-group field-card"><label class="form-label required">Nome</label><input name="nome" class="form-control" value="${escapeHtml(cliente.nome || '')}" required></div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label required">Tipo de documento</label><select name="tipo_documento" id="clienteTipoDocumento" class="form-control" required><option value="CPF" ${cliente.tipo_documento !== 'CNPJ' ?'selected' : ''}>CPF</option><option value="CNPJ" ${cliente.tipo_documento === 'CNPJ' ?'selected' : ''}>CNPJ</option></select></div>
                <div class="form-group field-card"><label class="form-label required">Documento</label><input name="documento" id="clienteDocumentoInput" class="form-control" value="${escapeHtml(formatDocument(cliente.documento || '', cliente.tipo_documento || 'CPF'))}" required><div id="clienteDocumentoFeedback" class="form-feedback info">CPF ou CNPJ será validado em tempo real enquanto voc?digita.</div></div>
              </div>
            </section>
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Contato</div>
                  <div class="form-section-description">Deixe os canais principais prontos para atendimento rápido e acompanhamento.</div>
                </div>
                <span class="section-kicker">Relacionamento</span>
              </div>
              <div class="form-row cols-2">
                <div class="form-group field-card"><label class="form-label">Email</label><input name="email" type="email" class="form-control" value="${escapeHtml(cliente.email || '')}"></div>
                <div class="form-group field-card"><label class="form-label">WhatsApp</label><input name="whatsapp" class="form-control" data-mask="phone" value="${escapeHtml(formatPhone(cliente.whatsapp || ''))}"></div>
              </div>
              <div class="form-group field-card"><label class="form-label">Telefone secundário</label><input name="telefone_secundario" class="form-control" data-mask="phone" value="${escapeHtml(formatPhone(cliente.telefone_secundario || ''))}"></div>
            </section>
            <section class="form-section">
              <div class="form-section-header">
                <div>
                  <div class="form-section-title">Endereço e observações</div>
                  <div class="form-section-description">Centralize aqui informações complementares para a equipe trabalhar com contexto.</div>
                </div>
                <span class="section-kicker">Contexto</span>
              </div>
              <div class="form-group field-card"><label class="form-label">Endereço</label><textarea name="endereco" class="form-control">${escapeHtml(cliente.endereco || '')}</textarea></div>
              <div class="form-group field-card"><label class="form-label">Observações</label><textarea name="observacoes" class="form-control">${escapeHtml(cliente.observacoes || '')}</textarea></div>
            </section>
          </div>
        </form>
      `,
      `<button class="btn btn-secondary" type="button" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="button" onclick="saveCliente(${id || 'null'})">${isEdit ?'Salvar cliente' : 'Criar cliente'}</button>`
    );

    const tipoSelect = document.getElementById('clienteTipoDocumento');
    const documentoInput = document.getElementById('clienteDocumentoInput');
    const feedbackElement = document.getElementById('clienteDocumentoFeedback');
    const applyMask = () => {
      documentoInput.value = formatDocument(documentoInput.value, tipoSelect.value);
      updateDocumentInputFeedback(tipoSelect, documentoInput, feedbackElement);
    };
    tipoSelect.addEventListener('change', applyMask);
    documentoInput.addEventListener('input', applyMask);
    documentoInput.addEventListener('blur', applyMask);
    applyMask();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function saveCliente(id) {
  const form = document.getElementById('clienteForm');
  if (!validateForm(form)) {
    showToast('Preencha os campos obrigatórios', 'error');
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  if (!validateDocument(data.documento, data.tipo_documento)) {
    showToast(`${data.tipo_documento} inválido`, 'error');
    return;
  }

  showLoading();
  try {
    await api(id ?`/api/clientes/${id}` : '/api/clientes', id ?'PUT' : 'POST', data);
    closeModal();
    showToast(`Cliente ${id ?'atualizado' : 'criado'} com sucesso`, 'success');
    await fetchClientes();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function viewProcesso(id) {
  showLoading();
  try {
    const response = await api(`/api/processos/${id}`);
    const processo = response.data.processo;
    const anexos = response.data.anexos || [];
    const movimentacoes = response.data.movimentacoes || [];

    showModal(
      `Processo ${processo.numero_processo}`,
      `
        <div class="form-row cols-2 mb-3">
          <div><strong>Título</strong><div>${escapeHtml(processo.titulo)}</div></div>
          <div><strong>Status</strong><div>${getStatusBadge(processo.status)}</div></div>
          <div><strong>Clientes</strong><div>${escapeHtml(getProcessClientSummary(processo) || '-')}</div></div>
          <div><strong>Distribuição</strong><div>${formatDate(processo.data_distribuicao)}</div></div>
          <div><strong>Autor</strong><div>${escapeHtml(processo.autor)}</div></div>
          <div><strong>Réu</strong><div>${escapeHtml(processo.reu)}</div></div>
        </div>
        <div class="inline-kpis mb-3">
          <div class="mini-kpi"><span class="text-secondary">Prioridade</span><strong>${escapeHtml(PRIORITY_LABELS[processo.prioridade || 'media'] || 'Média')}</strong></div>
          <div class="mini-kpi"><span class="text-secondary">Prazo final</span><strong>${processo.prazo_final ?formatDate(processo.prazo_final) : 'Não definido'}</strong></div>
          <div class="mini-kpi"><span class="text-secondary">Situação do prazo</span><strong>${escapeHtml(getPrazoInfo(processo.prazo_final).label)}</strong></div>
        </div>
        ${processo.descricao ?`<div class="mb-3"><strong>Descrição</strong><div>${escapeHtml(processo.descricao)}</div></div>` : ''}
        <div class="card mb-3">
          <div class="card-header"><h4 class="card-title">Anexos</h4></div>
          <div class="card-body">
            <div class="file-dropzone mb-3">
              <input type="file" id="uploadAnexoInput" class="form-control" multiple accept="${PROCESS_ATTACHMENT_ACCEPT}">
              <div class="text-secondary mt-2">PDF, Word, imagem, planilhas e outros documentos. Visualização em modal quando suportado.</div>
            </div>
            <button class="btn btn-primary mb-3" type="button" onclick="uploadAnexo(${id})">Anexar arquivo(s)</button>
            <div class="file-list">
              ${anexos.length ?anexos.map((anexo) => renderAnexoItem(id, anexo)).join('') : renderEmptyState('Sem anexos', 'Anexe documentos do processo para consulta rápida.')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4 class="card-title">Timeline do processo</h4><button class="btn btn-sm btn-primary" type="button" onclick="showMovimentacaoForm(${id})">Nova movimentação</button></div>
          <div class="card-body">
            ${renderMovimentacoesTimeline(id, movimentacoes)}
          </div>
        </div>
      `,
      `<button class="btn btn-secondary" type="button" onclick="closeModal()">Fechar</button><button class="btn btn-primary" type="button" onclick="showProcessoForm(${id})">Editar processo</button>`
    );
    document.getElementById('uploadAnexoInput')?.addEventListener('change', () => {
      uploadAnexo(id);
    });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderMovimentacoesTimeline(processoId, movimentacoes) {
  if (!movimentacoes.length) {
    return renderEmptyState('Sem movimentações', 'Ainda não h?movimentações registradas.');
  }

  return `
    <div class="timeline">
      ${movimentacoes.map((mov) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <strong>${escapeHtml(mov.tipo)}</strong>
            <div class="timeline-meta">${formatDate(mov.data_movimentacao)} · registrado em ${formatDateTime(mov.criado_em)}</div>
            <div>${escapeHtml(mov.descricao)}</div>
          </div>
          <div class="table-actions">
            <button class="btn btn-sm btn-ghost" type="button" onclick="showMovimentacaoForm(${processoId}, ${mov.id})">Editar</button>
            <button class="btn btn-sm btn-danger" type="button" onclick="deleteMovimentacao(${processoId}, ${mov.id})">Excluir</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function showMovimentacaoForm(processoId, movimentacaoId = null) {
  showLoading();
  try {
    const processoResponse = await api(`/api/processos/${processoId}`);
    const processo = processoResponse.data.processo;
    const movimentacoes = processoResponse.data.movimentacoes || [];
    const movimentacao = movimentacaoId ?movimentacoes.find((item) => Number(item.id) === Number(movimentacaoId)) : null;

    showModal(
      movimentacao ?'Editar movimentação' : 'Nova movimentação',
      `
        <form id="movimentacaoForm">
          <div class="alert alert-info mb-3">Processo: <strong>${escapeHtml(processo.numero_processo)}</strong></div>
          <div class="form-row cols-2">
            <div class="form-group"><label class="form-label required">Tipo</label><input name="tipo" class="form-control" value="${escapeHtml(movimentacao?.tipo || '')}" required></div>
            <div class="form-group"><label class="form-label required">Data da movimentação</label><input name="data_movimentacao" type="date" class="form-control" value="${formatDateInput(movimentacao?.data_movimentacao || new Date().toISOString())}" required></div>
          </div>
          <div class="form-group"><label class="form-label required">Descrição</label><textarea name="descricao" class="form-control" required>${escapeHtml(movimentacao?.descricao || '')}</textarea></div>
        </form>
      `,
      `<button class="btn btn-secondary" type="button" onclick="viewProcesso(${processoId})">Cancelar</button><button class="btn btn-primary" type="button" onclick="saveMovimentacao(${processoId}, ${movimentacaoId || 'null'})">${movimentacao ?'Salvar movimentação' : 'Criar movimentação'}</button>`
    );
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function saveMovimentacao(processoId, movimentacaoId) {
  const form = document.getElementById('movimentacaoForm');
  if (!validateForm(form)) {
    showToast('Preencha os campos obrigatórios da movimentação', 'error');
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  data.processo_id = processoId;

  showLoading();
  try {
    await api(movimentacaoId ?`/api/movimentacoes/${movimentacaoId}` : '/api/movimentacoes', movimentacaoId ?'PUT' : 'POST', data);
    showToast(`Movimentação ${movimentacaoId ?'atualizada' : 'criada'} com sucesso`, 'success');
    await refreshProcessMovimentacoesContext(processoId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteMovimentacao(processoId, movimentacaoId) {
  if (!confirm('Excluir esta movimentação?')) return;
  showLoading();
  try {
    await api(`/api/movimentacoes/${movimentacaoId}`, 'DELETE');
    showToast('Movimentação excluída com sucesso', 'success');
    await refreshProcessMovimentacoesContext(processoId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderAnexoItem(processoId, anexo) {
  const sizeMb = `${(Number(anexo.tamanho_bytes || 0) / (1024 * 1024)).toFixed(2)} MB`;
  return `<div class="file-item"><div><strong>${escapeHtml(anexo.nome_original)}</strong><div class="text-secondary">${escapeHtml(anexo.mime_type)} · ${sizeMb}</div></div><button class="btn btn-sm btn-outline" type="button" onclick="previewAnexo('${anexo.url}', '${escapeHtml(anexo.nome_original)}', '${anexo.mime_type}')">Visualizar</button><button class="btn btn-sm btn-danger" type="button" onclick="deleteAnexo(${processoId}, ${anexo.id})">Excluir</button></div>`;
}

function previewAnexo(url, nome, mimeType) {
  if (!url) {
    showToast('Não foi possível localizar o arquivo para visualização', 'error');
    return;
  }
  const safeUrl = escapeHtml(url);
  const body = String(mimeType).startsWith('image/')
    ?`<img src="${safeUrl}" alt="${escapeHtml(nome)}" class="viewer-image">`
    : mimeType === 'application/pdf'
      ?`<iframe src="${safeUrl}" title="${escapeHtml(nome)}" class="viewer-frame"></iframe>`
      : `<div class="text-center"><p>Visualização direta indisponível para este formato.</p><a class="btn btn-primary" href="${safeUrl}" target="_blank" rel="noopener">Abrir arquivo</a></div>`;
  showModal(
    nome,
    body,
    `<button class="btn btn-secondary" type="button" onclick="closeModal()">Fechar</button>`,
    { preservePrevious: true }
  );
}

async function uploadAnexo(processoId) {
  const files = Array.from(document.getElementById('uploadAnexoInput')?.files || []);
  if (!files.length) {
    showToast('Selecione ao menos um arquivo para anexar', 'warning');
    return;
  }
  showLoading();
  try {
    const summary = await uploadAttachmentsBatch(processoId, files);
    if (summary.failed.length) {
      showToast(`${summary.uploaded.length} arquivo(s) enviados e ${summary.failed.length} falharam`, 'warning', 6000);
    } else {
      showToast(`${summary.uploaded.length} arquivo(s) anexados com sucesso`, 'success');
    }
    document.getElementById('uploadAnexoInput').value = '';
    await viewProcesso(processoId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteAnexo(processoId, anexoId) {
  if (!confirm('Excluir este anexo?')) return;
  showLoading();
  try {
    await api(`/api/processos/${processoId}/anexos/${anexoId}`, 'DELETE');
    showToast('Anexo excluído com sucesso', 'success');
    await viewProcesso(processoId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteProcesso(id) {
  if (!confirm('Deseja excluir este processo?')) return;
  showLoading();
  try {
    await api(`/api/processos/${id}`, 'DELETE');
    showToast('Processo excluído com sucesso', 'success');
    await fetchProcessos();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function viewCliente(id) {
  showLoading();
  try {
    const response = await api(`/api/clientes/${id}`);
    const { cliente, processos } = response.data;
    showModal(
      cliente.nome,
      `
        <div class="form-row cols-2 mb-3">
          <div><strong>Documento</strong><div>${escapeHtml(cliente.tipo_documento)} ${escapeHtml(formatDocument(cliente.documento, cliente.tipo_documento))}</div></div>
          <div><strong>Email</strong><div>${escapeHtml(cliente.email || '-')}</div></div>
          <div><strong>WhatsApp</strong><div>${escapeHtml(formatPhone(cliente.whatsapp || ''))}</div></div>
          <div><strong>Telefone secundário</strong><div>${escapeHtml(formatPhone(cliente.telefone_secundario || ''))}</div></div>
        </div>
        ${cliente.endereco ?`<div class="mb-3"><strong>Endereço</strong><div>${escapeHtml(cliente.endereco)}</div></div>` : ''}
        ${cliente.observacoes ?`<div class="mb-3"><strong>Observações</strong><div>${escapeHtml(cliente.observacoes)}</div></div>` : ''}
        <div class="card"><div class="card-header"><h4 class="card-title">Processos vinculados</h4></div><div class="card-body file-list">${processos.length ?processos.map((processo) => `<div class="file-item"><div><strong>${escapeHtml(processo.numero_processo)}</strong><div class="text-secondary">${escapeHtml(processo.titulo)}</div></div>${getStatusBadge(processo.status)}</div>`).join('') : renderEmptyState('Sem processos', 'Nenhum processo vinculado a este cliente.')}</div></div>
      `,
      `<button class="btn btn-secondary" type="button" onclick="closeModal()">Fechar</button>`
    );
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteCliente(id) {
  if (!confirm('Deseja excluir este cliente?')) return;
  showLoading();
  try {
    await api(`/api/clientes/${id}`, 'DELETE');
    showToast('Cliente excluído com sucesso', 'success');
    await fetchClientes();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function loadMovimentacoes() {
  const section = document.getElementById('movimentacoesSection');
  section.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <div><h2>Movimentações</h2><p>Abra a timeline de qualquer processo e registre andamentos com mais contexto.</p></div>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Selecione um processo</label>
          <select id="movimentacaoProcessoSelect" class="form-control">
            <option value="">Selecione um processo</option>
          </select>
        </div>
        <div id="movimentacoesPanel">${renderEmptyState('Selecione um processo', 'A timeline será carregada aqui com prazos, histórico e ações.')}</div>
      </div>
    </div>
  `;

  loadMovimentacoesPanel();
}

async function renderMovimentacoesProcessoPanel(processoId) {
  const panel = document.getElementById('movimentacoesPanel');
  if (!panel || !processoId) return;

  const processoResponse = await api(`/api/processos/${processoId}`);
  const processo = processoResponse.data.processo;
  const movimentacoes = processoResponse.data.movimentacoes || [];

  panel.innerHTML = `
    <div class="inline-kpis mb-3">
      <div class="mini-kpi"><span class="text-secondary">Processo</span><strong>${escapeHtml(processo.numero_processo)}</strong></div>
      <div class="mini-kpi"><span class="text-secondary">Status</span><strong>${escapeHtml(PROCESS_STATUS_LABELS[processo.status] || processo.status)}</strong></div>
      <div class="mini-kpi"><span class="text-secondary">Prazo</span><strong>${processo.prazo_final ?formatDate(processo.prazo_final) : 'Não definido'}</strong></div>
    </div>
    <div class="page-actions mb-3">
      <button class="btn btn-primary" type="button" onclick="showMovimentacaoForm(${processo.id})">Nova movimentação</button>
      <button class="btn btn-outline" type="button" onclick="viewProcesso(${processo.id})">Abrir processo completo</button>
    </div>
    ${renderMovimentacoesTimeline(processo.id, movimentacoes)}
  `;
}

async function refreshProcessMovimentacoesContext(processoId) {
  const select = document.getElementById('movimentacaoProcessoSelect');
  const movimentacoesSection = document.getElementById('movimentacoesSection');
  const panelOpen = movimentacoesSection && movimentacoesSection.style.display !== 'none';

  if (panelOpen && select && String(select.value) === String(processoId)) {
    closeModal();
    await renderMovimentacoesProcessoPanel(processoId);
    return;
  }

  await viewProcesso(processoId);
}

async function loadMovimentacoesPanel() {
  const select = document.getElementById('movimentacaoProcessoSelect');
  if (!select) return;

  showLoading();
  try {
    const response = await api('/api/processos?perPage=100&sortBy=criado_em&sortOrder=DESC');
    const processos = response.data.items || [];
    select.innerHTML = `<option value="">Selecione um processo</option>${processos.map((processo) => `<option value="${processo.id}">${escapeHtml(processo.numero_processo)} · ${escapeHtml(processo.titulo)}</option>`).join('')}`;

    select.addEventListener('change', async (event) => {
      const processoId = event.target.value;
      if (!processoId) {
        document.getElementById('movimentacoesPanel').innerHTML = renderEmptyState('Selecione um processo', 'A timeline será carregada aqui com prazos, histórico e ações.');
        return;
      }
      await renderMovimentacoesProcessoPanel(processoId);
    });
  } catch (error) {
    document.getElementById('movimentacoesPanel').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

async function loadNotifications() {
  const section = document.getElementById('notificacoesSection');
  section.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <div><h2>Notificações</h2><p>Alertas operacionais de prazo, inatividade e acompanhamento da carteira.</p></div>
        <div class="page-actions">
          <button class="btn btn-outline" type="button" onclick="loadNotifications()">Atualizar</button>
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body" id="notificationsList"></div></div>
  `;

  showLoading();
  try {
    const response = await api('/api/processos/notifications?limit=20');
    document.getElementById('notificationsList').innerHTML = renderNotificationsList(response.data || []);
  } catch (error) {
    document.getElementById('notificationsList').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function renderNotificationsList(items) {
  if (!items.length) {
    return renderEmptyState('Sem notificações críticas', 'Nenhum alerta operacional relevante encontrado agora.');
  }

  return `<div class="file-list">${items.map((item) => {
    const labels = {
      prazo_atrasado: 'Prazo atrasado',
      prazo_proximo: 'Prazo próximo',
      sem_movimentacao_recente: 'Sem movimentação recente'
    };
    const badgeType = item.tipo_notificacao === 'prazo_atrasado'
      ?'danger'
      : item.tipo_notificacao === 'prazo_proximo'
        ?'warning'
        : 'secondary';
    return `
      <div class="file-item">
        <div>
          <strong>${escapeHtml(item.numero_processo)}</strong>
          <div>${escapeHtml(item.titulo)}</div>
          <div class="text-secondary">${escapeHtml(getProcessClientSummary(item))}</div>
        </div>
        <div>
          <span class="badge badge-${badgeType}">${escapeHtml(labels[item.tipo_notificacao] || item.tipo_notificacao)}</span>
          ${item.prazo_final ?`<div class="text-secondary mt-2">${formatDate(item.prazo_final)} · ${escapeHtml(getPrazoInfo(item.prazo_final).label)}</div>` : ''}
        </div>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline" type="button" onclick="viewProcesso(${item.id})">Abrir</button>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

async function loadUsuarios() {
  const section = document.getElementById('usuariosSection');
  if (!hasPermission('usuarios.manage')) {
    section.innerHTML = '<div class="alert alert-error">Você não tem permissão para acessar usuários.</div>';
    return;
  }
  section.innerHTML = `<div class="page-header"><div class="page-title"><div><h2>Usuários</h2><p>Senhas fortes e perfis controlados.</p></div><div class="page-actions"><button class="btn btn-primary" type="button" onclick="showUsuarioForm()">Novo usuário</button></div></div></div><div class="card"><div class="card-body" id="usuariosTable"></div></div>`;
  showLoading();
  try {
    const response = await api(`/api/usuarios?page=${usuariosPage}&perPage=${USUARIOS_PER_PAGE}&sortBy=nome&sortOrder=ASC`);
    usuariosData = response.data.items || [];
    usuariosTotalPages = response.data.totalPages || 1;
    renderUsuariosTable();
  } catch (error) {
    document.getElementById('usuariosTable').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function renderUsuariosTable() {
  const container = document.getElementById('usuariosTable');
  if (!container) return;
  if (!usuariosData.length) {
    container.innerHTML = renderEmptyState('Nenhum usuário cadastrado', 'Crie usuários para conceder acesso.');
    return;
  }
  container.innerHTML = `<div class="table-container"><table class="table"><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>2FA</th><th>Status</th><th>Ações</th></tr></thead><tbody>${usuariosData.map((usuario) => `<tr><td>${escapeHtml(usuario.nome)}</td><td>${escapeHtml(usuario.email)}</td><td><span class="badge badge-primary">${escapeHtml(usuario.perfil)}</span></td><td><span class="badge badge-${usuario.twofa_enabled ?'success' : 'secondary'}">${usuario.twofa_enabled ?'Ativo' : 'Inativo'}</span></td><td><span class="badge badge-${usuario.ativo ?'success' : 'danger'}">${usuario.ativo ?'Ativo' : 'Inativo'}</span></td><td class="table-actions"><button class="btn btn-sm btn-ghost" type="button" onclick="showUsuarioForm(${usuario.id})">Editar</button><button class="btn btn-sm btn-outline" type="button" onclick="toggleUsuarioStatus(${usuario.id}, ${usuario.ativo ?0 : 1})">${usuario.ativo ?'Desativar' : 'Ativar'}</button><button class="btn btn-sm btn-danger" type="button" onclick="deleteUsuario(${usuario.id})">Excluir</button></td></tr>`).join('')}</tbody></table></div>${createPagination(usuariosPage, usuariosTotalPages, 'goToUsuariosPage')}`;
}

function goToUsuariosPage(page) {
  usuariosPage = page;
  loadUsuarios();
}

async function showUsuarioForm(id = null) {
  showLoading();
  try {
    const isEdit = Boolean(id);
    const response = isEdit ?await api(`/api/usuarios/${id}`) : { data: { usuario: {} } };
    const usuario = response.data.usuario || {};
    const passwordField = !isEdit ?`
      <div class="form-group">
        <label class="form-label required">Senha</label>
        <div class="input-with-action">
          <input id="usuarioSenha" name="senha" type="password" class="form-control" minlength="6" required>
          <button class="input-action-btn" type="button" onclick="togglePasswordVisibility('usuarioSenha', this)">Mostrar</button>
        </div>
        <div class="form-text">Minimo de 6 caracteres. Pode ser apenas numerica.</div>
      </div>
    ` : '';

    showModal(
      isEdit ?'Editar usuario' : 'Novo usuario',
      `<form id="usuarioForm">
        <div class="form-group">
          <label class="form-label required">Nome</label>
          <input name="nome" class="form-control" value="${escapeHtml(usuario.nome || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input name="email" type="email" class="form-control" value="${escapeHtml(usuario.email || '')}" required>
        </div>
        ${passwordField}
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label required">Perfil</label>
            <select name="perfil" class="form-control" required>
              <option value="advogado" ${usuario.perfil === 'advogado' ?'selected' : ''}>Advogado</option>
              <option value="secretaria" ${usuario.perfil === 'secretaria' ?'selected' : ''}>Secretaria</option>
              <option value="gestor" ${usuario.perfil === 'gestor' ?'selected' : ''}>Gestor</option>
              <option value="admin" ${usuario.perfil === 'admin' ?'selected' : ''}>Administrador</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="ativo" class="form-control">
              <option value="1" ${usuario.ativo !== 0 ?'selected' : ''}>Ativo</option>
              <option value="0" ${usuario.ativo === 0 ?'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>
      </form>`,
      `<button class="btn btn-secondary" type="button" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="button" onclick="saveUsuario(${id || 'null'})">${isEdit ?'Salvar usuario' : 'Criar usuario'}</button>`
    );
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function saveUsuario(id) {
  const form = document.getElementById('usuarioForm');
  if (!validateForm(form)) {
    showToast('Preencha os campos obrigatorios', 'error');
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  if (!id) {
    const passwordValidation = validatePasswordPolicy(data.senha);
    if (!passwordValidation.valid) {
      showToast(passwordValidation.message, 'error');
      return;
    }
  }

  showLoading();
  try {
    await api(id ?`/api/usuarios/${id}` : '/api/usuarios', id ?'PUT' : 'POST', data);
    closeModal();
    showToast(`Usuario ${id ?'atualizado' : 'criado'} com sucesso`, 'success');
    await loadUsuarios();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function toggleUsuarioStatus(id, ativo) {
  showLoading();
  try {
    await api(`/api/usuarios/${id}`, 'PUT', { ativo });
    showToast('Status atualizado com sucesso', 'success');
    await loadUsuarios();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteUsuario(id) {
  if (!confirm('Deseja excluir este usuário?')) return;
  showLoading();
  try {
    await api(`/api/usuarios/${id}`, 'DELETE');
    showToast('Usuário excluído com sucesso', 'success');
    await loadUsuarios();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function loadPermissoes() {
  const section = document.getElementById('permissoesSection');
  if (!hasPermission('usuarios.manage')) {
    section.innerHTML = '<div class="alert alert-error">Você não tem permissão para acessar permissões.</div>';
    return;
  }
  showLoading();
  try {
    const [permissoesResponse, usuariosResponse] = await Promise.all([api('/api/permissoes'), api('/api/usuarios?perPage=100&sortBy=nome&sortOrder=ASC')]);
    const usuarios = usuariosResponse.data.items || [];
    const porModulo = permissoesResponse.data.porModulo || {};
    section.innerHTML = `<div class="page-header"><div class="page-title"><div><h2>Permissões</h2><p>Controle fino por usuário.</p></div></div></div><div class="card"><div class="card-body"><div class="form-group"><label class="form-label">Selecione um usuário</label><select id="usuarioPermissaoSelect" class="form-control"><option value="">Escolha um usuário</option>${usuarios.map((usuario) => `<option value="${usuario.id}">${escapeHtml(usuario.nome)} · ${escapeHtml(usuario.email)}</option>`).join('')}</select></div><div id="permissionsEditor">${renderEmptyState('Selecione um usuário', 'As permissões aparecem aqui.')}</div></div></div>`;
    document.getElementById('usuarioPermissaoSelect').addEventListener('change', async (event) => {
      const usuarioId = event.target.value;
      if (!usuarioId) {
        document.getElementById('permissionsEditor').innerHTML = renderEmptyState('Selecione um usuário', 'As permissões aparecem aqui.');
        return;
      }
      await loadPermissionsEditor(usuarioId, porModulo);
    });
  } catch (error) {
    section.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

async function loadPermissionsEditor(usuarioId, porModulo) {
  showLoading();
  try {
    const response = await api(`/api/permissoes/usuario/${usuarioId}`);
    const concedidas = new Set((response.data.permissoes.concedidas || []).map((item) => item.id));
    document.getElementById('permissionsEditor').innerHTML = `<form id="permissionsForm">${Object.entries(porModulo).map(([modulo, permissoes]) => `<div class="card mb-3"><div class="card-header"><h4 class="card-title">${escapeHtml(modulo)}</h4></div><div class="card-body">${permissoes.map((permissao) => `<label class="file-item"><div><strong>${escapeHtml(permissao.codigo)}</strong><div class="text-secondary">${escapeHtml(permissao.descricao)}</div></div><input type="checkbox" name="permissao_ids" value="${permissao.id}" ${concedidas.has(permissao.id) ?'checked' : ''}></label>`).join('')}</div></div>`).join('')}<button class="btn btn-primary" type="button" onclick="savePermissions(${usuarioId})">Salvar permissões</button></form>`;
  } catch (error) {
    document.getElementById('permissionsEditor').innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

async function savePermissions(usuarioId) {
  const ids = Array.from(document.querySelectorAll('#permissionsForm input[name="permissao_ids"]:checked')).map((input) => Number(input.value));
  showLoading();
  try {
    await api(`/api/permissoes/usuario/${usuarioId}`, 'PUT', { permissao_ids: ids });
    showToast('Permissões atualizadas com sucesso', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function loadAuditoria() {
  const section = document.getElementById('auditoriaSection');
  if (!hasPermission('auditoria.view')) {
    section.innerHTML = '<div class="alert alert-error">Voce nao tem permissao para acessar auditoria.</div>';
    return;
  }
  section.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <div><h2>Auditoria</h2><p>Veja apenas o dia desejado, com leitura mais objetiva do uso do sistema.</p></div>
      </div>
    </div>
    <div class="filters audit-toolbar">
      <div class="audit-highlight">
        <strong>Auditoria diária</strong>
        <p class="text-secondary">Por padrão o painel mostra somente os registros do dia atual. Escolha outra data para investigar um dia específico.</p>
      </div>
      <div class="filters-row">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Data</label>
          <input id="auditDate" type="date" class="form-control" value="${getTodayInputValue()}">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Ação</label>
          <input id="auditSearchAction" class="form-control" placeholder="Ex.: login, criar_processo">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Usuário</label>
          <input id="auditSearchUser" class="form-control" placeholder="Email do usuário">
        </div>
        <button class="btn btn-outline" type="button" onclick="fetchAuditoria()">Atualizar</button>
      </div>
      <div id="auditSummary" class="audit-summary"></div>
    </div>
    <div class="card"><div class="card-body" id="auditoriaTable"></div></div>
  `;
  document.getElementById('auditDate').addEventListener('change', () => {
    auditoriaPage = 1;
    fetchAuditoria();
  });
  document.getElementById('auditSearchAction').addEventListener('input', () => {
    auditoriaPage = 1;
    fetchAuditoria();
  });
  document.getElementById('auditSearchUser').addEventListener('input', () => {
    auditoriaPage = 1;
    fetchAuditoria();
  });
  await fetchAuditoria();
}

async function fetchAuditoria() {
  const container = document.getElementById('auditoriaTable');
  if (!container) return;
  showLoading();
  try {
    const selectedDate = getSelectedAuditDate();
    const { start, end } = getAuditDateRange(selectedDate);
    const params = new URLSearchParams({
      page: String(auditoriaPage),
      perPage: String(AUDITORIA_PER_PAGE),
      sortBy: 'criado_em',
      sortOrder: 'DESC',
      data_inicio: start,
      data_fim: end
    });
    const acao = document.getElementById('auditSearchAction')?.value || '';
    const usuario_email = document.getElementById('auditSearchUser')?.value || '';
    if (acao) params.append('acao', acao);
    if (usuario_email) params.append('usuario_email', usuario_email);
    const response = await api(`/api/auditoria?${params.toString()}`);
    const items = response.data.items || [];
    auditoriaTotalPages = response.data.totalPages || 1;
    const summary = document.getElementById('auditSummary');
    const errors = items.filter((log) => Number(log.status_http) >= 400).length;
    const users = new Set(items.map((log) => log.usuario_email || 'Sistema')).size;
    if (summary) {
      summary.innerHTML = `
        <div class="audit-summary-card"><span class="text-secondary">Data analisada</span><strong>${formatDateLabel(selectedDate)}</strong></div>
        <div class="audit-summary-card"><span class="text-secondary">Registros do dia</span><strong>${items.length}</strong></div>
        <div class="audit-summary-card"><span class="text-secondary">Usuários envolvidos</span><strong>${users}</strong></div>
        <div class="audit-summary-card"><span class="text-secondary">Ocorrências com erro</span><strong>${errors}</strong></div>
      `;
    }
    container.innerHTML = items.length
      ?`<div class="table-container"><table class="table"><thead><tr><th>Horário</th><th>Usuário</th><th>Ação</th><th>Tela</th><th>HTTP</th></tr></thead><tbody>${items.map((log) => `<tr><td>${new Date(log.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td><td>${escapeHtml(log.usuario_email || 'Sistema')}</td><td>${escapeHtml(log.acao)}</td><td>${escapeHtml(log.tela || '-')}</td><td>${log.status_http ?`<span class="badge badge-${log.status_http >= 400 ?'danger' : 'success'}">${log.status_http}</span>` : '-'}</td></tr>`).join('')}</tbody></table></div>${createPagination(auditoriaPage, auditoriaTotalPages, 'goToAuditoriaPage')}`
      : renderEmptyState('Sem registros neste dia', 'Não h?eventos para a data escolhida com os filtros atuais.');
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  } finally {
    hideLoading();
  }
}

function goToAuditoriaPage(page) {
  auditoriaPage = page;
  fetchAuditoria();
}

function loadConfiguracoes() {
  document.getElementById('configuracoesSection').innerHTML = `<div class="page-header"><div class="page-title"><div><h2>Configurações</h2><p>Rotinas críticas do sistema.</p></div></div></div><div id="desktopUpdaterMount"></div><div class="card mb-3"><div class="card-body"><div class="page-title"><div><h3>Backup e restauração</h3><p>Gere uma cópia segura ou restaure um backup existente.</p></div><div class="page-actions"><button class="btn btn-primary" type="button" onclick="backupSystem()">Fazer backup</button><button class="btn btn-outline" type="button" onclick="document.getElementById('restoreFile').click()">Restaurar backup</button></div></div><input id="restoreFile" type="file" accept=".json" style="display:none" onchange="restoreFromFile(this)"></div></div><div class="card"><div class="card-body"><div class="page-title"><div><h3>Reset do sistema</h3><p class="text-danger">Apaga todos os dados e recria o admin inicial.</p></div><div class="page-actions"><button class="btn btn-danger" type="button" onclick="resetSystem()">Resetar sistema</button></div></div></div></div>`;
  if (typeof refreshDesktopUpdaterUI === 'function') {
    refreshDesktopUpdaterUI();
  }
}

async function exportData(format) {
  showLoading();
  try {
    const response = await fetch(`/api/export/processos/${format}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Erro ao exportar dados');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `processos.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exportação concluída', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

function exportProcessos(format) {
  return exportData(format);
}

async function backupSystem() {
  showLoading();
  try {
    const response = await fetch('/api/backup/backup', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': await getCsrfToken() } });
    if (!response.ok) throw new Error('Erro ao gerar backup');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Backup gerado com sucesso', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function restoreFromFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!confirm('Restaurar backup substituir?os dados atuais. Continuar?')) {
    input.value = '';
    return;
  }
  showLoading();
  try {
    const backupData = JSON.parse(await file.text());
    await api('/api/backup/restore', 'POST', backupData);
    showToast('Backup restaurado com sucesso. Recarregando...', 'success');
    setTimeout(() => window.location.reload(), 1500);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
    input.value = '';
  }
}

async function resetSystem() {
  const answer = prompt('Digite RESETAR para confirmar a limpeza total do sistema.');
  if (answer !== 'RESETAR') return;
  showLoading();
  try {
    await fetch('/api/backup/reset', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() } });
    showToast('Sistema resetado. Redirecionando para o login...', 'success');
    setTimeout(() => window.location.href = '/login.html', 1500);
  } catch (error) {
    showToast('Erro ao resetar sistema', 'error');
  } finally {
    hideLoading();
  }
}

