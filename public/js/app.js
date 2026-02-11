// Sistema de Processos - Main JavaScript Utilities

// ========== CSRF TOKEN MANAGEMENT ==========
let csrfToken = null;

async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    
    try {
        const response = await fetch('/api/csrf-token', {
            credentials: 'include'
        });
        const data = await response.json();
        csrfToken = data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Error getting CSRF token:', error);
        return null;
    }
}

// ========== API WRAPPER ==========
async function api(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
    };

    // Add CSRF token for non-GET requests
    if (method !== 'GET') {
        const token = await getCsrfToken();
        if (token) {
            options.headers['X-CSRF-Token'] = token;
        }
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
        // Clear auth and redirect to login
        csrfToken = null;
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('consulta.html') &&
            !window.location.pathname.includes('index.html')) {
            // Force HTTP protocol to prevent HSTS upgrade
            const protocol = 'http:';
            const host = window.location.host;
            const loginUrl = `${protocol}//${host}/login.html`;
            window.location.href = loginUrl;
        }
        throw new Error('Não autenticado');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Erro na requisição');
    }

    return data;
}

// ========== AUTHENTICATION ==========
async function checkAuth() {
    try {
        const response = await api('/api/auth/me');
        // The API returns response.data.usuario, not response.user
        if (response.success && response.data && response.data.usuario) {
            return response.data.usuario;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function logout() {
    try {
        await api('/api/auth/logout', 'POST');
        csrfToken = null;
        showToast('Logout realizado com sucesso', 'success');
        setTimeout(() => {
            // Force HTTP protocol to prevent HSTS upgrade
            const protocol = 'http:';
            const host = window.location.host;
            const loginUrl = `${protocol}//${host}/login.html`;
            window.location.href = loginUrl;
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        // Force HTTP protocol to prevent HSTS upgrade
        const protocol = 'http:';
        const host = window.location.host;
        const loginUrl = `${protocol}//${host}/login.html`;
        window.location.href = loginUrl;
    }
}

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info', duration = 4000) {
    // Create toast container if it doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// ========== LOADING STATES ==========
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
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========== MODAL HANDLING ==========
function showModal(title, content, footer = null) {
    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    // Create modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
    `;

    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close on escape key
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    });

    return overlay;
}

function closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
}

// ========== FORM VALIDATION ==========
function validateForm(formElement) {
    const inputs = formElement.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });

    return isValid;
}

// ========== CPF UTILITIES ==========
function formatCPF(cpf) {
    // Remove non-digits
    cpf = cpf.replace(/\D/g, '');
    
    // Apply mask: 000.000.000-00
    if (cpf.length <= 11) {
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    return cpf;
}

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Check if all digits are the same
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validate check digits
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

// ========== DATE UTILITIES ==========
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

function formatDateInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// ========== PASSWORD STRENGTH ==========
function calculatePasswordStrength(password) {
    let score = 0;
    
    if (!password) return { score: 0, text: 'Muito fraca' };
    
    // Length
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Character variety
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // Normalize to 0-3
    if (score < 3) return { score: 1, text: 'Fraca' };
    if (score < 5) return { score: 2, text: 'Média' };
    return { score: 3, text: 'Forte' };
}

// ========== WHATSAPP UTILITIES ==========
function formatPhone(phone) {
    // Remove non-digits
    phone = phone.replace(/\D/g, '');
    
    // Apply mask
    if (phone.length === 11) {
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 10) {
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    
    return phone;
}

function generateWhatsAppLink(phone, message = '') {
    // Remove non-digits
    phone = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (!phone.startsWith('55')) {
        phone = '55' + phone;
    }
    
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}${message ? '?text=' + encodedMessage : ''}`;
}

// ========== TABLE UTILITIES ==========
function createTable(headers, rows, actions = null) {
    let html = '<div class="table-container"><table class="table"><thead><tr>';
    
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    
    if (actions) {
        html += '<th>Ações</th>';
    }
    
    html += '</tr></thead><tbody>';
    
    if (rows.length === 0) {
        html += `<tr><td colspan="${headers.length + (actions ? 1 : 0)}" class="text-center text-secondary">Nenhum registro encontrado</td></tr>`;
    } else {
        rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            if (actions) {
                html += `<td class="table-actions">${actions(row)}</td>`;
            }
            html += '</tr>';
        });
    }
    
    html += '</tbody></table></div>';
    
    return html;
}

// ========== PAGINATION ==========
function createPagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">← Anterior</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span>...</span>';
        }
    }
    
    // Next button
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">Próximo →</button>`;
    
    html += '</div>';
    
    return html;
}

// ========== TABS ==========
document.addEventListener('DOMContentLoaded', () => {
    // Handle tabs
    const tabButtons = document.querySelectorAll('.tabs-nav button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and tabs
            document.querySelectorAll('.tabs-nav button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked button and corresponding tab
            button.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });
});

// ========== UTILITY FUNCTIONS ==========
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copiado para a área de transferência', 'success');
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copiado para a área de transferência', 'success');
    }
}

// ========== AUTO-FORMAT INPUTS ==========
document.addEventListener('DOMContentLoaded', () => {
    // Auto-format CPF inputs
    document.querySelectorAll('input[type="text"]#cpf').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = formatCPF(e.target.value);
        });
    });
    
    // Auto-format phone inputs
    document.querySelectorAll('input[type="tel"], input[name="telefone"], input[name="celular"]').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = formatPhone(e.target.value);
        });
    });
});

// ========== SIDEBAR TOGGLE ==========
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// ========== USER MENU TOGGLE ==========
function toggleUserMenu() {
    const menu = document.getElementById('userMenuDropdown');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenuDropdown');
    const userMenuBtn = document.querySelector('.user-menu');
    
    if (menu && userMenuBtn && !userMenuBtn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// ========== CHART UTILITIES ==========
function drawPieChart(canvas, data, labels, colors) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    
    const total = data.reduce((a, b) => a + b, 0);
    let currentAngle = -0.5 * Math.PI;
    
    // Draw slices
    data.forEach((value, index) => {
        const sliceAngle = (2 * Math.PI * value) / total;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();
        
        currentAngle += sliceAngle;
    });
    
    // Draw legend
    let legendY = 20;
    labels.forEach((label, index) => {
        ctx.fillStyle = colors[index];
        ctx.fillRect(10, legendY, 15, 15);
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText(`${label}: ${data[index]}`, 30, legendY + 12);
        legendY += 25;
    });
}

function drawBarChart(canvas, data, labels, color) {
    const ctx = canvas.getContext('2d');
    const padding = 40;
    const barWidth = (canvas.width - 2 * padding) / data.length;
    const maxValue = Math.max(...data);
    const heightScale = (canvas.height - 2 * padding) / maxValue;
    
    // Draw bars
    data.forEach((value, index) => {
        const barHeight = value * heightScale;
        const x = padding + index * barWidth;
        const y = canvas.height - padding - barHeight;
        
        ctx.fillStyle = color;
        ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
        
        // Draw label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(labels[index], x + barWidth / 2, canvas.height - 20);
        
        // Draw value
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });
}
