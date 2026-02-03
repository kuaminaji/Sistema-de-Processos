# Correção: Tela Piscando entre Login e Administração

## Problema Resolvido

A tela ficava piscando/alternando rapidamente entre `login.html` e `admin.html`, com erro no console:

```
GET http://localhost:3000/api/auth/me 401 (Unauthorized)
(anonymous) @ login.html:278
```

## Causa Raiz

### Incompatibilidade de Autenticação

O sistema tinha uma **incompatibilidade crítica** entre o método de autenticação usado pelo backend e pelo frontend:

| Componente | Método de Autenticação | Status |
|------------|------------------------|--------|
| **Backend** | Sessões (express-session + cookies) | ✅ Correto |
| **login.html** | Sessões (credentials: 'include') | ✅ Correto |
| **admin.html** | Tokens (localStorage + Bearer) | ❌ **INCORRETO** |

### O Loop de Redirecionamento

1. Usuário acessa `/` → redireciona para `/admin.html`
2. `admin.html` verifica `localStorage.getItem('token')` → **NÃO ENCONTRADO** (nunca foi criado!)
3. Redireciona imediatamente para `/login.html`
4. `login.html` verifica sessão (pode estar vazia)
5. Volta para `/` → **LOOP INFINITO** = Tela piscando

## Solução Implementada

### Mudanças em `admin.html`

Convertemos `admin.html` de autenticação baseada em **tokens** para autenticação baseada em **sessões**.

#### 1. Função `checkAuth()`

**ANTES (Quebrado):**
```javascript
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html'; // Redirect imediato!
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}` // Backend não usa isso!
            }
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        currentUser = await response.json(); // Parse errado
        updateUserInfo();
    } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
}
```

**DEPOIS (Funcional):**
```javascript
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include' // Envia cookie de sessão
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Authentication failed');
        }

        currentUser = data.user; // Parse correto
        updateUserInfo();
        
        // Hide admin-only menu if not admin
        if (currentUser.role !== 'admin') {
            document.getElementById('menu-usuarios').style.display = 'none';
        }
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = '/login.html';
    }
}
```

#### 2. Função `apiRequest()`

**ANTES:**
```javascript
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return;
    }

    return response;
}
```

**DEPOIS:**
```javascript
async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Envia cookies
    });

    if (response.status === 401) {
        window.location.href = '/login.html';
        return;
    }

    return response;
}
```

#### 3. Função `handleLogout()`

**ANTES:**
```javascript
function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
}
```

**DEPOIS:**
```javascript
async function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
        window.location.href = '/login.html';
    }
}
```

## Como o Backend Funciona

### Controlador de Autenticação (`authController.js`)

```javascript
// Login - Cria sessão
async login(req, res) {
    // ... validação de credenciais ...
    
    // Cria sessão com cookies
    req.session.userId = usuario.id;
    req.session.userEmail = usuario.email;
    req.session.userName = usuario.nome;
    req.session.userRole = usuario.role;
    
    res.json({
        success: true,
        message: 'Login realizado com sucesso',
        user: { id, nome, email, role }
    });
}

// Verifica autenticação
async getCurrentUser(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Não autenticado' 
        });
    }
    
    // ... busca usuário ...
    
    res.json({
        success: true,
        user: usuario
    });
}
```

### Middleware de Autenticação (`auth.js`)

```javascript
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Autenticação necessária' 
        });
    }
    next();
};
```

## Comportamento Esperado Após a Correção

### Cenário 1: Usuário Não Autenticado

1. ✅ Acessa `/` → redireciona para `/admin.html`
2. ✅ `admin.html` verifica sessão via `/api/auth/me`
3. ✅ Resposta: `401 Unauthorized`
4. ✅ Redireciona para `/login.html`
5. ✅ **PERMANECE** em `/login.html` (sem loop!)

### Cenário 2: Usuário Faz Login

1. ✅ Preenche email e senha
2. ✅ Backend cria sessão
3. ✅ Cookie de sessão armazenado no navegador
4. ✅ Redireciona para `/`
5. ✅ `/` redireciona para `/admin.html`
6. ✅ `admin.html` verifica sessão → **SUCESSO**
7. ✅ **PERMANECE** em `/admin.html` (autenticado!)

### Cenário 3: Usuário Faz Logout

1. ✅ Clica em "Sair"
2. ✅ Chama `/api/auth/logout`
3. ✅ Backend destrói sessão
4. ✅ Cookie removido
5. ✅ Redireciona para `/login.html`

## Verificação

### Checklist de Teste

- [ ] Limpar cookies e localStorage do navegador
- [ ] Acessar `http://localhost:3000/`
- [ ] Verificar: Deve redirecionar para `/login.html` SEM piscar
- [ ] Fazer login: `admin@sistema.com` / `admin123`
- [ ] Verificar: Deve acessar `/admin.html` e permanecer
- [ ] Console do navegador deve estar limpo (sem erros 401)
- [ ] Fazer logout
- [ ] Verificar: Deve retornar para `/login.html`
- [ ] Tentar acessar `/admin.html` diretamente
- [ ] Verificar: Deve redirecionar para `/login.html`

### Console do Navegador

**ANTES (Com o bug):**
```
❌ GET http://localhost:3000/api/auth/me 401 (Unauthorized)
❌ (múltiplas vezes em loop)
```

**DEPOIS (Corrigido):**
```
✅ (vazio ou apenas logs normais da aplicação)
```

## Arquitetura de Autenticação

### Fluxo Completo

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. POST /api/auth/login
       │    { email, senha }
       ▼
┌─────────────────┐
│   Backend       │
│  (Express +     │
│   Session)      │
└──────┬──────────┘
       │
       │ 2. Cria sessão
       │    Set-Cookie: connect.sid=...
       ▼
┌─────────────┐
│   Browser   │
│  (Cookie    │
│   salvo)    │
└──────┬──────┘
       │
       │ 3. GET /api/auth/me
       │    Cookie: connect.sid=...
       ▼
┌─────────────────┐
│   Backend       │
│  (Verifica      │
│   sessão)       │
└──────┬──────────┘
       │
       │ 4. Retorna dados do usuário
       │    { success: true, user: {...} }
       ▼
┌─────────────┐
│   Browser   │
│  (Autenticado)│
└─────────────┘
```

## Resumo das Mudanças

| Componente | Antes | Depois | Status |
|------------|-------|---------|--------|
| checkAuth() | localStorage token | credentials: 'include' | ✅ Corrigido |
| apiRequest() | Bearer token | credentials: 'include' | ✅ Corrigido |
| handleLogout() | localStorage.removeItem | POST /api/auth/logout | ✅ Corrigido |
| Response parsing | await response.json() | data.user | ✅ Corrigido |

## Conclusão

A correção alinha **completamente** o frontend com o backend:

- ✅ **Backend**: Usa sessões (express-session)
- ✅ **login.html**: Usa sessões (credentials: 'include')
- ✅ **admin.html**: Usa sessões (credentials: 'include') ← **CORRIGIDO**

**Resultado**: Sistema de autenticação consistente, sem loops de redirecionamento e sem tela piscando!
