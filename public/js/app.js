let csrfToken = null;
let desktopUpdateState = null;
let lastDesktopUpdateStatus = '';
let desktopUpdateInitialized = false;
let desktopManualCheckPending = false;

const PROCESS_STATUS_LABELS = {
  distribuido: 'Distribuído',
  em_andamento: 'Em andamento',
  suspenso: 'Suspenso',
  arquivado: 'Arquivado',
  sentenciado: 'Sentenciado',
  transitado_em_julgado: 'Transitado em julgado'
};

const PROCESS_STATUS_BADGES = {
  distribuido: 'info',
  em_andamento: 'primary',
  suspenso: 'warning',
  arquivado: 'secondary',
  sentenciado: 'success',
  transitado_em_julgado: 'success'
};

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente'
};

const PRIORITY_BADGES = {
  baixa: 'secondary',
  media: 'info',
  alta: 'warning',
  urgente: 'danger'
};

async function getCsrfToken() {
  if (csrfToken) return csrfToken;

  const response = await fetch('/api/csrf-token', { credentials: 'include' });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function api(url, method = 'GET', body = null, extraOptions = {}) {
  const options = {
    method,
    credentials: 'include',
    ...extraOptions,
    headers: {
      Accept: 'application/json',
      ...(extraOptions.headers || {})
    }
  };

  if (!(body instanceof FormData) && body !== null && options.headers['Content-Type'] === undefined) {
    options.headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET') {
    const token = await getCsrfToken();
    options.headers['X-CSRF-Token'] = token;
  }

  if (body instanceof FormData) {
    options.body = body;
    delete options.headers['Content-Type'];
  } else if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    csrfToken = null;
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('consulta.html') && !window.location.pathname.includes('index.html')) {
      window.location.href = '/login.html';
    }
    throw new Error(data.message || 'Não autenticado');
  }
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }

  return data;
}

async function checkAuth() {
  try {
    const response = await api('/api/auth/me');
    if (!response.success || !response.data?.usuario) return null;

    return {
      ...response.data.usuario,
      role: response.data.usuario.perfil,
      permissions: (response.data.permissoes || []).map((item) => item.codigo || item)
    };
  } catch (error) {
    return null;
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', 'POST');
  } finally {
    csrfToken = null;
    window.location.href = '/login.html';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ?'OK' : type === 'error' ?'ER' : type === 'warning' ?'AT' : 'IN'}</div>
    <div class="toast-content">
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" type="button">x</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function showLoading() {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

function closeModal(targetOverlay = null) {
  const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
  const overlay = targetOverlay || overlays[overlays.length - 1];
  overlay?.remove();
}

function applyDisplayProfile() {
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac OS X');
  const isRetina = window.devicePixelRatio >= 2;
  const compactWidth = window.innerWidth <= 1440;
  const compactHeight = window.innerHeight <= 900;
  const isMacbookAir13 = isMac && isRetina && compactWidth && compactHeight;

  [root, body].forEach((node) => {
    node.classList.toggle('platform-mac', isMac);
    node.classList.toggle('retina-display', isRetina);
    node.classList.toggle('compact-workspace', compactWidth || compactHeight);
    node.classList.toggle('macbook-air-13', isMacbookAir13);
  });
}

function scheduleDisplayProfileRefresh() {
  window.requestAnimationFrame(() => applyDisplayProfile());
}

function showModal(title, content, footer = '', options = {}) {
  if (!options?.preservePrevious) {
    closeModal();
  }

  const closeOnBackdrop = options?.closeOnBackdrop === true;
  const closeOnEscape = options?.closeOnEscape === true;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.closeOnEscape = closeOnEscape ?'true' : 'false';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" type="button">x</button>
      </div>
      <div class="modal-body">${content}</div>
      ${footer ?`<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  if (closeOnBackdrop) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });
  }
  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  document.body.appendChild(overlay);
}

function validateForm(formElement) {
  let isValid = true;
  formElement.querySelectorAll('[required]').forEach((input) => {
    const ok = String(input.value || '').trim().length > 0;
    input.classList.toggle('error', !ok);
    if (!ok) isValid = false;
  });
  return isValid;
}

function normalizeDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function formatCPF(value) {
  const digits = normalizeDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
  if (digits.length <= 9) return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
}

function validateCPF(value) {
  const cpf = normalizeDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = sum % 11 < 2 ?0 : 11 - (sum % 11);
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = sum % 11 < 2 ?0 : 11 - (sum % 11);
  return digit === Number(cpf[10]);
}

function formatCNPJ(value) {
  const digits = normalizeDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
  if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (digits.length <= 12) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
}

function validateCNPJ(value) {
  const cnpj = normalizeDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  const digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i -= 1) {
    sum += Number(numbers[length - i]) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ?0 : 11 - (sum % 11);
  if (result !== Number(digits[0])) return false;

  length += 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i -= 1) {
    sum += Number(numbers[length - i]) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ?0 : 11 - (sum % 11);
  return result === Number(digits[1]);
}

function inferDocumentType(value, explicitType = '') {
  const digits = normalizeDigits(value);
  const type = String(explicitType || '').toUpperCase();
  if (type === 'CPF' || type === 'CNPJ') return type;
  if (digits.length <= 11) return 'CPF';
  return 'CNPJ';
}

function formatDocument(value, type = '') {
  const docType = inferDocumentType(value, type);
  return docType === 'CNPJ' ?formatCNPJ(value) : formatCPF(value);
}

function validateDocument(value, type = '') {
  const docType = inferDocumentType(value, type);
  return docType === 'CNPJ' ?validateCNPJ(value) : validateCPF(value);
}

function formatPhone(value) {
  const digits = normalizeDigits(value).slice(0, 13);
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return digits;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR');
}

function formatDateInput(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toISOString().split('T')[0];
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getPriorityBadge(priority) {
  const normalized = String(priority || 'media').toLowerCase();
  const badgeClass = PRIORITY_BADGES[normalized] || 'secondary';
  return `<span class="badge badge-${badgeClass}">${escapeHtml(PRIORITY_LABELS[normalized] || normalized)}</span>`;
}

function getPrazoInfo(dateString) {
  if (!dateString) {
    return { status: 'sem_prazo', label: 'Sem prazo', badge: 'secondary', days: null };
  }

  const target = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) {
    return { status: 'atrasado', label: `${Math.abs(diffDays)} dia(s) atrasado`, badge: 'danger', days: diffDays };
  }
  if (diffDays === 0) {
    return { status: 'hoje', label: 'Vence hoje', badge: 'warning', days: diffDays };
  }
  if (diffDays <= 7) {
    return { status: 'proximo', label: `Vence em ${diffDays} dia(s)`, badge: 'warning', days: diffDays };
  }
  return { status: 'em_dia', label: `Prazo em ${diffDays} dia(s)`, badge: 'success', days: diffDays };
}

function getPrazoBadge(dateString) {
  const prazo = getPrazoInfo(dateString);
  return `<span class="badge badge-${prazo.badge}">${escapeHtml(prazo.label)}</span>`;
}

function validatePasswordPolicy(password) {
  const normalizedPassword = String(password || '');
  if (normalizedPassword.length < 6) {
    return { valid: false, message: 'A senha deve ter no minimo 6 caracteres.' };
  }

  return { valid: true, message: 'Senha valida.' };
}

function calculatePasswordStrength(password) {
  const normalizedPassword = String(password || '');
  if (!normalizedPassword) return { score: 0, text: 'Muito fraca' };

  const policy = validatePasswordPolicy(normalizedPassword);
  if (!policy.valid) return { score: 1, text: 'Muito fraca' };

  if (/^\d+$/.test(normalizedPassword)) {
    if (normalizedPassword.length >= 10) return { score: 3, text: 'Numerica forte' };
    if (normalizedPassword.length >= 8) return { score: 2, text: 'Numerica media' };
    return { score: 2, text: 'Numerica valida' };
  }

  let score = 1;
  if (normalizedPassword.length >= 8) score += 1;
  if (normalizedPassword.length >= 12) score += 1;
  if (/[a-z]/.test(normalizedPassword) && /[A-Z]/.test(normalizedPassword)) score += 1;
  if (/\d/.test(normalizedPassword) && /[^A-Za-z0-9]/.test(normalizedPassword)) score += 1;

  if (score <= 2) return { score: 1, text: 'Fraca' };
  if (score <= 4) return { score: 2, text: 'Media' };
  return { score: 3, text: 'Forte' };
}

function togglePasswordVisibility(inputId, trigger = null) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isVisible = input.type === 'text';
  input.type = isVisible ?'password' : 'text';

  if (trigger) {
    trigger.textContent = isVisible ?'Mostrar' : 'Ocultar';
  }
}

function createPagination(currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination">';
  html += `<button class="pagination-btn" ${currentPage === 1 ?'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">Anterior</button>`;

  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
      html += `<button class="pagination-btn ${page === currentPage ?'active' : ''}" onclick="${onPageChange}(${page})">${page}</button>`;
    } else if (Math.abs(page - currentPage) === 2) {
      html += '<span class="pagination-ellipsis">...</span>';
    }
  }

  html += `<button class="pagination-btn" ${currentPage === totalPages ?'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">Próxima</button>`;
  html += '</div>';
  return html;
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenuDropdown');
  if (!menu) return;
  menu.classList.toggle('open');
}

document.addEventListener('click', (event) => {
  const menu = document.getElementById('userMenuDropdown');
  const trigger = document.querySelector('.user-menu');
  if (menu && trigger && !menu.contains(event.target) && !trigger.contains(event.target)) {
    menu.classList.remove('open');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
  const overlay = overlays[overlays.length - 1];
  if (overlay?.dataset.closeOnEscape === 'true') {
    closeModal(overlay);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  applyDisplayProfile();
  window.addEventListener('resize', scheduleDisplayProfileRefresh, { passive: true });

  document.body.addEventListener('input', (event) => {
    const input = event.target;
    if (input.matches('[data-mask="cpf"]')) input.value = formatCPF(input.value);
    if (input.matches('[data-mask="cnpj"]')) input.value = formatCNPJ(input.value);
    if (input.matches('[data-mask="documento"]')) input.value = formatDocument(input.value, input.dataset.documentType);
    if (input.matches('[data-mask="phone"]')) input.value = formatPhone(input.value);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  initDesktopUpdater().catch(() => {});
});

function getStatusBadge(status) {
  const badgeClass = PROCESS_STATUS_BADGES[status] || 'secondary';
  return `<span class="badge badge-${badgeClass}">${escapeHtml(PROCESS_STATUS_LABELS[status] || status || 'Não informado')}</span>`;
}

function renderEmptyState(title, message) {
  return `
    <div class="empty-state">
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <div class="empty-state-message">${escapeHtml(message)}</div>
    </div>
  `;
}

function isDesktopRuntime() {
  return Boolean(window.desktopUpdater);
}

function getDesktopUpdateStatusMeta(status) {
  const normalized = String(status || 'idle').toLowerCase();
  const meta = {
    idle: { label: 'Pronto', badge: 'info' },
    checking: { label: 'Verificando', badge: 'info' },
    downloading: { label: 'Baixando', badge: 'warning' },
    downloaded: { label: 'Pronto para instalar', badge: 'success' },
    installing: { label: 'Instalando', badge: 'warning' },
    'not-available': { label: 'Atualizado', badge: 'success' },
    unconfigured: { label: 'Nao configurado', badge: 'secondary' },
    manual: { label: 'Atualizacao manual', badge: 'secondary' },
    disabled: { label: 'Somente no app instalado', badge: 'secondary' },
    error: { label: 'Erro', badge: 'danger' }
  };

  return meta[normalized] || { label: normalized, badge: 'secondary' };
}

function updateDesktopUpdateChip() {
  const chip = document.getElementById('desktopUpdateChip');
  if (!chip || !desktopUpdateState || !isDesktopRuntime()) return;

  const statusMeta = getDesktopUpdateStatusMeta(desktopUpdateState.status);
  chip.style.display = 'block';
  chip.innerHTML = `
    <span class="header-chip-label">Versao</span>
    <strong>${escapeHtml(desktopUpdateState.currentVersion || '-')}</strong>
    <small class="desktop-update-chip-meta">
      <span class="badge badge-${statusMeta.badge}">${escapeHtml(statusMeta.label)}</span>
      <span>${escapeHtml((desktopUpdateState.channel || 'stable').toUpperCase())}</span>
    </small>
  `;
}

function buildDesktopUpdaterPanelMarkup() {
  if (!isDesktopRuntime()) {
    return '';
  }

  const state = desktopUpdateState || {
    currentVersion: '',
    channel: 'stable',
    feedUrl: '',
    releasesUrl: '',
    autoCheck: true,
    status: 'idle',
    configured: false,
    supported: true,
    packaged: false,
    progressPercent: 0,
    message: ''
  };
  const statusMeta = getDesktopUpdateStatusMeta(state.status);
  const progress = Math.max(0, Math.min(100, Number(state.progressPercent || 0)));
  const statusMessage = state.error || state.message || 'Atualizacao automatica pronta para configuracao.';

  return `
    <div class="card mb-3">
      <div class="card-body">
        <div class="page-title">
          <div>
            <h3>Atualizacao do aplicativo</h3>
            <p>Automatize novas versoes, altere o canal e mantenha o update com mais seguranca operacional.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" type="button" onclick="checkDesktopUpdates()">Verificar agora</button>
            <button class="btn btn-primary" type="button" onclick="installDesktopUpdate()" ${state.status !== 'downloaded' ?'disabled' : ''}>Reiniciar e atualizar</button>
          </div>
        </div>
        <div class="desktop-update-grid">
          <div class="desktop-update-summary">
            <div class="desktop-update-summary-item">
              <span class="text-secondary">Versao atual</span>
              <strong>${escapeHtml(state.currentVersion || '-')}</strong>
            </div>
            <div class="desktop-update-summary-item">
              <span class="text-secondary">Canal</span>
              <strong>${escapeHtml((state.channel || 'stable').toUpperCase())}</strong>
            </div>
            <div class="desktop-update-summary-item">
              <span class="text-secondary">Status</span>
              <strong><span class="badge badge-${statusMeta.badge}">${escapeHtml(statusMeta.label)}</span></strong>
            </div>
          </div>
          <div class="desktop-update-form">
            <div class="form-row cols-2">
              <div class="form-group">
                <label class="form-label">Canal de atualizacao</label>
                <select id="desktopUpdateChannel" class="form-control">
                  <option value="stable" ${state.channel !== 'beta' ?'selected' : ''}>Stable</option>
                  <option value="beta" ${state.channel === 'beta' ?'selected' : ''}>Beta</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Politica</label>
                <label class="desktop-update-checkbox">
                  <input id="desktopUpdateAutoCheck" type="checkbox" ${state.autoCheck !== false ?'checked' : ''}>
                  <span>Verificar novas versoes automaticamente</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">URL do feed de atualizacao</label>
              <input id="desktopUpdateFeedUrl" class="form-control" value="${escapeHtml(state.feedUrl || '')}" placeholder="https://seu-servidor/releases">
            </div>
            <div class="form-group">
              <label class="form-label">Pagina de releases</label>
              <input id="desktopUpdateReleasesUrl" class="form-control" value="${escapeHtml(state.releasesUrl || '')}" placeholder="https://seu-servidor/releases">
            </div>
            <div class="desktop-update-progress">
              <div class="desktop-update-progress-bar">
                <span style="width:${progress}%"></span>
              </div>
              <div class="desktop-update-progress-meta">
                <span>${escapeHtml(statusMessage)}</span>
                <strong>${progress}%</strong>
              </div>
            </div>
            ${state.backupPath ?`<div class="alert alert-success mt-3">Backup da atualizacao: ${escapeHtml(state.backupPath)}</div>` : ''}
            <div class="page-actions mt-3">
              <button class="btn btn-secondary" type="button" onclick="saveDesktopUpdateSettings()">Salvar configuracao</button>
              <button class="btn btn-ghost" type="button" onclick="openDesktopUpdateReleasePage()">Abrir pagina de versoes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function refreshDesktopUpdaterUI() {
  updateDesktopUpdateChip();

  const panelMount = document.getElementById('desktopUpdaterMount');
  if (panelMount) {
    panelMount.innerHTML = buildDesktopUpdaterPanelMarkup();
  }
}

function handleDesktopUpdateState(state, options = {}) {
  if (!state) return;

  const previousStatus = lastDesktopUpdateStatus;
  desktopUpdateState = state;
  lastDesktopUpdateStatus = state.status || '';
  refreshDesktopUpdaterUI();

  if (options.silent) return;

  if (state.status === 'downloading' && previousStatus !== 'downloading') {
    showToast(state.message || 'Nova versao encontrada. Download iniciado.', 'info');
    desktopManualCheckPending = false;
  }

  if (state.status === 'downloaded' && previousStatus !== 'downloaded') {
    showToast(state.message || 'Atualizacao pronta para instalar.', 'success', 6500);
    desktopManualCheckPending = false;
  }

  if (state.status === 'error' && state.error && previousStatus !== 'error') {
    showToast(state.error, 'error', 6500);
  }

  if (desktopManualCheckPending && state.status === 'not-available') {
    showToast('O aplicativo ja esta atualizado.', 'success');
    desktopManualCheckPending = false;
  }

  if (desktopManualCheckPending && state.status === 'manual') {
    showToast(state.message || 'Atualizacao manual nesta plataforma.', 'warning', 6500);
    desktopManualCheckPending = false;
  }

  if (desktopManualCheckPending && state.status === 'unconfigured') {
    showToast('Configure a URL do feed para automatizar novas versoes.', 'warning', 6500);
    desktopManualCheckPending = false;
  }

  if (desktopManualCheckPending && state.status === 'error') {
    desktopManualCheckPending = false;
  }
}

async function initDesktopUpdater() {
  if (!isDesktopRuntime() || desktopUpdateInitialized) {
    return;
  }

  desktopUpdateInitialized = true;
  const state = await window.desktopUpdater.getState();
  handleDesktopUpdateState(state, { silent: true });
  window.desktopUpdater.onStateChanged((nextState) => {
    handleDesktopUpdateState(nextState);
  });
}

async function checkDesktopUpdates() {
  if (!isDesktopRuntime()) return;

  try {
    desktopManualCheckPending = true;
    const response = await window.desktopUpdater.checkNow();
    if (!response?.success) {
      desktopManualCheckPending = false;
      throw new Error(response?.message || 'Nao foi possivel verificar atualizacoes.');
    }

    if (response.data?.status === 'checking') {
      showToast('Verificacao iniciada. O sistema vai procurar novas versoes.', 'info');
    }
  } catch (error) {
    desktopManualCheckPending = false;
    showToast(error.message, 'error');
  }
}

async function saveDesktopUpdateSettings() {
  if (!isDesktopRuntime()) return;

  try {
    const payload = {
      channel: document.getElementById('desktopUpdateChannel')?.value || 'stable',
      feedUrl: document.getElementById('desktopUpdateFeedUrl')?.value || '',
      releasesUrl: document.getElementById('desktopUpdateReleasesUrl')?.value || '',
      autoCheck: document.getElementById('desktopUpdateAutoCheck')?.checked !== false
    };

    const response = await window.desktopUpdater.saveSettings(payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Nao foi possivel salvar a configuracao de atualizacao.');
    }

    handleDesktopUpdateState(response.data, { silent: true });
    showToast('Configuracao de atualizacao salva com sucesso.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function installDesktopUpdate() {
  if (!isDesktopRuntime()) return;

  try {
    const response = await window.desktopUpdater.installNow();
    if (!response?.success) {
      throw new Error(response?.message || 'Nao foi possivel instalar a atualizacao.');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function openDesktopUpdateReleasePage() {
  if (!isDesktopRuntime()) return;

  try {
    const response = await window.desktopUpdater.openReleasePage();
    if (!response?.success) {
      throw new Error(response?.message || 'Nenhuma pagina de versoes foi configurada.');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}


