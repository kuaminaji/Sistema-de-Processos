# Frontend - Sistema de Processos Judiciais

## 📁 Estrutura de Arquivos

```
public/
├── css/
│   └── styles.css          # Estilos completos e responsivos
├── js/
│   ├── app.js              # Utilitários e funções comuns
│   ├── admin.js            # Lógica da área administrativa
│   └── consulta.js         # Lógica da consulta pública
├── index.html              # Página inicial (redirect)
├── login.html              # Página de login
├── admin.html              # Painel administrativo
├── consulta.html           # Consulta pública
├── trocar-senha.html       # Trocar senha
└── setup-2fa.html          # Configurar 2FA
```

## 🎨 Características do Design

### Responsivo - 9 Breakpoints
- **320px**: Small mobile
- **375px**: Mobile
- **425px**: Large mobile
- **576px**: Tablet portrait
- **768px**: Tablet landscape
- **992px**: Small desktop
- **1200px**: Desktop
- **1400px**: Large desktop
- **1600px+**: Extra large desktop

### Mobile-First
- Sidebar colapsável em telas pequenas
- Formulários adaptáveis
- Tabelas com scroll horizontal
- Botões e ações otimizados para toque

### Tema
- **Cores principais**: Azul profissional (#1e40af) e cinza
- **Status colors**: Success (verde), Warning (amarelo), Error (vermelho), Info (azul)
- **Sombras suaves**: Para profundidade
- **Bordas arredondadas**: Design moderno

## 🚀 Funcionalidades

### Páginas Públicas

#### **index.html** - Página Inicial
- Verifica se usuário está logado
- Se logado: redireciona para admin.html
- Se não: mostra opções de login ou consulta pública

#### **login.html** - Login
- Formulário de email/senha
- Suporte a 2FA (mostra campo se necessário)
- Opção "Lembrar-me"
- Validação de formulário
- Feedback de erros

#### **consulta.html** - Consulta Pública
- **Aba 1**: Consultar por CPF
  - Validação de CPF
  - Formatação automática
  - Mostra todos os processos do cliente
- **Aba 2**: Consultar por Número
  - Busca por número exato do processo
- Exibição completa de processos e movimentações
- Não requer login

### Área Administrativa (admin.html)

#### Dashboard
- **Cards de Estatísticas**:
  - Total de processos
  - Processos ativos
  - Processos arquivados
  - Processos suspensos
- **Gráfico**: Processos por status (Pizza/Donut)
- **Atividade Recente**: Últimas ações no sistema
- **Ações Rápidas**: Exportar (PDF, Excel, CSV) e Backup

#### Gestão de Processos
- **Listar**: Tabela com paginação
- **Buscar**: Por número, tipo, cliente
- **Filtrar**: Por status
- **Criar**: Formulário completo
- **Editar**: Atualizar informações
- **Visualizar**: Detalhes completos
- **Excluir**: Com confirmação
- **Exportar**: CSV, Excel

#### Gestão de Clientes
- **Listar**: Todos os clientes
- **Buscar**: Por nome ou CPF
- **Criar**: Novo cliente com validação de CPF
- **Editar**: Atualizar informações
- **Visualizar**: Detalhes do cliente
- **Excluir**: Com confirmação
- Auto-formatação de CPF e telefone

#### Movimentações
- Informação: Gerenciadas através dos processos
- Link para seção de processos

#### Usuários (Admin only)
- **Listar**: Todos os usuários
- **Criar**: Novo usuário
- **Editar**: Atualizar informações
- **Ativar/Desativar**: Toggle de status
- **Excluir**: Com confirmação
- Visualização de status 2FA
- Controle de permissões por cargo

#### Permissões (Admin only)
- Selecionar usuário
- Visualizar permissões atuais
- Atribuir/Remover permissões:
  - Gerenciar Usuários
  - Gerenciar Permissões
  - Visualizar Auditoria
  - Exportar Dados
  - Backup e Restauração

#### Auditoria (Admin only)
- **Listar**: Todos os logs
- **Filtrar**: Por data e usuário
- **Visualizar**: Ação, tabela, detalhes, timestamp
- **Exportar**: CSV, Excel

### Segurança

#### **trocar-senha.html**
- Campo senha atual (validação)
- Nova senha com requisitos:
  - Mínimo 8 caracteres
  - Letra maiúscula
  - Letra minúscula
  - Número
- **Indicador de força**: Fraca, Média, Forte
- Confirmação de senha
- Validação antes de envio

#### **setup-2fa.html**
- **Setup**:
  - Gera QR Code
  - Exibe código manual (backup)
  - Valida token para ativar
- **Desativar**:
  - Requer token atual
  - Confirmação

## 🔧 Funcionalidades Técnicas

### API Wrapper (app.js)
```javascript
// Todas as requisições passam por aqui
await api('/api/endpoint', 'POST', { data });

// CSRF token automático
// Tratamento de 401 (redirect para login)
// Suporte a credentials (cookies)
```

### Autenticação
```javascript
// Verificar se está autenticado
const user = await checkAuth();

// Logout
await logout();
```

### Notificações Toast
```javascript
showToast('Mensagem', 'success');  // success, error, warning, info
```

### Modals
```javascript
showModal('Título', 'Conteúdo HTML', 'Footer HTML');
closeModal();
```

### Loading States
```javascript
showLoading();  // Overlay fullscreen
hideLoading();
```

### Validação de CPF
```javascript
formatCPF('12345678900');  // 123.456.789-00
validateCPF('123.456.789-00');  // true/false
```

### Formatação de Datas
```javascript
formatDate('2024-01-15');  // 15/01/2024
formatDateTime('2024-01-15T10:30:00');  // 15/01/2024 10:30:00
formatDateInput('2024-01-15');  // 2024-01-15 (for <input type="date">)
```

### Senha - Força
```javascript
calculatePasswordStrength('senha123');
// { score: 1-3, text: 'Fraca/Média/Forte' }
```

### WhatsApp
```javascript
formatPhone('11987654321');  // (11) 98765-4321
generateWhatsAppLink('11987654321', 'Olá!');  
// https://wa.me/5511987654321?text=Ol%C3%A1!
```

### Tabelas
```javascript
createTable(headers, rows, actionsCallback);
// Gera HTML de tabela completa
```

### Paginação
```javascript
createPagination(currentPage, totalPages, 'callbackFunction');
// Gera HTML de paginação
```

### Charts (Canvas)
```javascript
drawPieChart(canvas, data, labels, colors);
drawBarChart(canvas, data, labels, color);
```

## 🎯 Fluxo de Uso

### Usuário Público
1. Acessa `index.html`
2. Clica em "Consulta Pública"
3. Escolhe: Por CPF ou Por Número
4. Digite e consulta
5. Visualiza processos e movimentações

### Usuário Logado
1. Acessa `index.html` → redireciona para `admin.html`
2. Ou acessa `login.html` diretamente
3. Login com email/senha (+ 2FA se ativo)
4. Acessa dashboard
5. Navega pelas seções (processos, clientes, etc.)
6. Realiza operações CRUD
7. Exporta dados conforme necessário
8. Logout pelo menu do usuário

### Administrador
- Todas as funcionalidades do usuário logado
- **+ Usuários**: Criar, editar, ativar/desativar
- **+ Permissões**: Atribuir permissões específicas
- **+ Auditoria**: Visualizar logs completos
- **+ Backup**: Fazer backup do sistema

## 📱 Componentes Reutilizáveis

### Cards
```html
<div class="card">
    <div class="card-header">
        <h3 class="card-title">Título</h3>
    </div>
    <div class="card-body">
        Conteúdo
    </div>
    <div class="card-footer">
        Footer (opcional)
    </div>
</div>
```

### Stat Cards
```html
<div class="stat-card">
    <div class="stat-icon primary">📋</div>
    <div class="stat-content">
        <div class="stat-label">Label</div>
        <div class="stat-value">100</div>
    </div>
</div>
```

### Badges
```html
<span class="badge badge-success">Ativo</span>
<span class="badge badge-warning">Suspenso</span>
<span class="badge badge-danger">Cancelado</span>
```

### Buttons
```html
<button class="btn btn-primary">Primário</button>
<button class="btn btn-secondary">Secundário</button>
<button class="btn btn-success">Sucesso</button>
<button class="btn btn-danger">Perigo</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
```

### Forms
```html
<div class="form-group">
    <label class="form-label required">Campo Obrigatório</label>
    <input type="text" class="form-control" required>
    <span class="form-text">Texto de ajuda</span>
    <span class="form-error">Mensagem de erro</span>
</div>
```

### Alerts
```html
<div class="alert alert-success">Mensagem de sucesso</div>
<div class="alert alert-error">Mensagem de erro</div>
<div class="alert alert-warning">Mensagem de aviso</div>
<div class="alert alert-info">Mensagem informativa</div>
```

### Empty States
```html
<div class="empty-state">
    <div class="empty-state-icon">📋</div>
    <div class="empty-state-title">Título</div>
    <div class="empty-state-message">Mensagem</div>
</div>
```

## 🔐 Segurança Implementada

1. **CSRF Protection**: Token em todas as requisições POST/PUT/DELETE
2. **Authentication**: Verificação automática e redirect
3. **Permission-based UI**: Menus e ações mostrados conforme permissões
4. **Password Strength**: Validação e indicador visual
5. **2FA Support**: Setup e validação completos
6. **Input Validation**: Client-side e preparado para server-side
7. **XSS Prevention**: Sanitização de inputs (preparado para backend)

## 📊 Métricas de Performance

- **CSS**: ~30KB minificado
- **JavaScript Total**: ~80KB
  - app.js: ~15KB
  - admin.js: ~45KB
  - consulta.js: ~8KB
- **HTML**: ~5-12KB por página
- **Total**: ~120KB (sem imagens)

## 🌐 Compatibilidade

- ✅ Chrome/Edge (últimas 2 versões)
- ✅ Firefox (últimas 2 versões)
- ✅ Safari (últimas 2 versões)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## 📝 Notas de Desenvolvimento

### Auto-Formatação
- CPF inputs são auto-formatados
- Telefone inputs são auto-formatados
- Datas formatadas automaticamente

### Debounce
- Busca em tabelas usa debounce (300ms)

### Loading States
- Overlay global para operações longas
- Spinners em botões para operações específicas

### Mensagens
- Todas as mensagens estão em português
- Feedback claro e amigável ao usuário

## 🐛 Tratamento de Erros

- **Network errors**: Toast com mensagem amigável
- **401 Unauthorized**: Redirect automático para login
- **Validation errors**: Feedback inline em formulários
- **Server errors**: Toast com mensagem do servidor

## 🔄 Estado e Cache

- User info é cacheado após login
- CSRF token é cacheado e reutilizado
- Dados de listagens não são cacheados (sempre frescos)

## 📖 Como Usar

### Desenvolvimento Local
1. Backend rodando em `http://localhost:3000`
2. Abrir `public/index.html` no navegador
3. Ou usar servidor estático: `npx http-server public -p 8080`

### Produção
1. Deploy do backend
2. Servir arquivos estáticos do diretório `public/`
3. Configurar servidor web (nginx/apache) para:
   - Servir arquivos estáticos
   - Proxy /api/* para backend
   - SPA routing (todas as rotas → index.html)

## 🎓 Guia Rápido de Customização

### Alterar Cores
Editar variáveis CSS em `styles.css`:
```css
:root {
    --primary-color: #1e40af;  /* Azul principal */
    --success-color: #10b981;  /* Verde sucesso */
    /* etc */
}
```

### Adicionar Nova Seção
1. Adicionar link na sidebar (`admin.html`)
2. Criar função `loadMinhaSecao()` em `admin.js`
3. Adicionar case no `showSection()`
4. Implementar CRUD functions

### Personalizar Formulários
- Usar classes `.form-group`, `.form-label`, `.form-control`
- Adicionar `required` para campos obrigatórios
- Usar `.form-row.cols-2` para 2 colunas

## ✨ Recursos Especiais

- **Print-friendly**: Estilos otimizados para impressão
- **Keyboard navigation**: Suporte completo
- **ARIA labels**: Acessibilidade
- **No dependencies**: Vanilla JavaScript puro
- **Progressive enhancement**: Funciona sem JavaScript básico

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar console do navegador para erros
2. Verificar Network tab para requisições falhadas
3. Validar que backend está rodando e acessível
4. Verificar CORS settings no backend

---

**Frontend desenvolvido com ❤️ para o Sistema de Processos Judiciais**
