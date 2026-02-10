# 🔍 Guia Completo de Erros no Console do Navegador

## 📌 Sobre Este Guia

Este documento explica **TODOS** os erros que podem aparecer no Console do navegador ao usar o Sistema de Processos Jurídicos.

> 💡 **Dica:** Para ver erros no console, pressione **F12** no navegador e clique na aba **Console**.

---

## 🎯 Índice de Erros

1. [ERR_SSL_PROTOCOL_ERROR](#1-err_ssl_protocol_error)
2. [404 Not Found - CSRF Token](#2-404-not-found---csrf-token)
3. [404 Not Found - favicon.ico](#3-404-not-found---faviconico)
4. [404 Not Found - Consulta Pública](#4-404-not-found---consulta-pública)
5. [429 Too Many Requests](#5-429-too-many-requests)
6. [401 Unauthorized](#6-401-unauthorized)
7. [403 Forbidden - CSRF](#7-403-forbidden---csrf)
8. [422 Unprocessable Entity](#8-422-unprocessable-entity)
9. [500 Internal Server Error](#9-500-internal-server-error)
10. [CORS Errors](#10-cors-errors)

---

## 1. ERR_SSL_PROTOCOL_ERROR

### 🔴 Como Aparece no Console

```
GET https://localhost:3000/trocar-senha.html net::ERR_SSL_PROTOCOL_ERROR
Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR
```

### 📝 O Que Significa

O navegador está tentando acessar o sistema usando **HTTPS** (conexão segura), mas o servidor está configurado para aceitar apenas **HTTP** (conexão normal).

### 🤔 Por Que Acontece

1. **HSTS (HTTP Strict Transport Security):** O navegador "lembra" de uma tentativa anterior de usar HTTPS e força todas as conexões futuras a usar HTTPS
2. **Cache do navegador:** Informações antigas guardadas no navegador
3. **Redirecionamento automático:** Algumas configurações ou extensões do navegador forçam HTTPS

### ✅ Como Resolver

**Solução 1: Limpar HSTS (Recomendado)**

**No Chrome/Edge:**
```
1. Cole na barra de endereço: chrome://net-internals/#hsts
2. Na seção "Delete domain security policies"
3. Digite: localhost
4. Clique em "Delete"
5. Feche e abra o navegador novamente
```

**No Firefox:**
```
1. Feche TODAS as janelas do Firefox
2. Vá em: about:support
3. Clique em "Limpar todas as informações do HSTS"
4. Reinicie o Firefox
```

**Solução 2: Usar IP ao invés de localhost (Mais Fácil)**

```
Ao invés de: http://localhost:3000
Use: http://127.0.0.1:3000
```

O HSTS não se aplica a endereços IP!

**Solução 3: Modo Incógnito + IP**

```
1. Abra janela anônima: Ctrl+Shift+N
2. Acesse: http://127.0.0.1:3000
```

### 📖 Documentação Relacionada

- `SOLUCAO_SSL_ERROR.md` - Guia completo sobre SSL
- `CORRECAO_DEFINITIVA.md` - Correção automática implementada

---

## 2. 404 Not Found - CSRF Token

### 🔴 Como Aparece no Console

```
GET http://localhost:3000/api/auth/csrf-token 404 (Not Found)
Failed to load resource: the server responded with a status of 404 (Not Found)
```

### 📝 O Que Significa

O navegador tentou buscar o **token CSRF** (proteção contra ataques) mas não encontrou no endereço especificado.

### 🤔 Por Que Acontece

Versão antiga do código onde o endpoint estava em `/api/auth/csrf-token` mas foi movido para `/api/csrf-token`.

### ✅ Como Resolver

**Status:** ✅ **JÁ CORRIGIDO** na versão atual!

Se ainda aparece:

```bash
# 1. Atualizar código
git pull origin copilot/create-legal-process-management-system

# 2. Reinstalar dependências
npm install

# 3. Reiniciar servidor
npm start

# 4. Limpar cache do navegador (Ctrl+Shift+Delete)
```

### 🔍 Como Verificar se Está Correto

Abra DevTools (F12) → Network → Recarregue a página

Deve aparecer:
```
✅ GET /api/csrf-token → 200 OK
```

### 📖 Documentação Relacionada

- `CORRECAO_LOGIN.md` - Detalhes da correção

---

## 3. 404 Not Found - favicon.ico

### 🔴 Como Aparece no Console

```
GET http://localhost:3000/favicon.ico 404 (Not Found)
Failed to load resource: the server responded with a status of 404 (Not Found)
```

### 📝 O Que Significa

O navegador procurou o ícone do site (favicon) no formato `.ico` mas o sistema usa formato `.svg`.

### 🤔 Por Que Acontece

Navegadores procuram automaticamente por `favicon.ico`, mas o sistema fornece `favicon.svg`.

### ✅ Como Resolver

**Status:** ✅ **JÁ CORRIGIDO** na versão atual!

O servidor agora redireciona automaticamente `/favicon.ico` → `/favicon.svg`

Se ainda aparece:
```bash
# Limpar cache do navegador
Ctrl+Shift+Delete → Limpar cache de imagens
```

### 🎨 Nota

Este erro é **cosmético** e não afeta funcionalidade. O favicon será carregado corretamente.

---

## 4. 404 Not Found - Consulta Pública

### 🔴 Como Aparece no Console

```
GET http://localhost:3000/api/public/consultarPorCPF/12345678900 404 (Not Found)
POST http://localhost:3000/api/public/consultar-cpf 404 (Not Found)
```

### 📝 O Que Significa

A consulta pública (por CPF ou número de processo) não encontrou a rota no servidor.

### 🤔 Por Que Acontece

Frontend e backend estavam usando formatos diferentes:
- Frontend: `/consultarPorCPF/:cpf` (parâmetro na URL)
- Backend antigo: `/consultar-cpf?cpf=xxx` (query string)

### ✅ Como Resolver

**Status:** ✅ **JÁ CORRIGIDO** na versão atual!

Ambas as rotas agora funcionam:
- ✅ `/api/public/consultarPorCPF/12345678900`
- ✅ `/api/public/consultar-cpf?cpf=12345678900`

Se ainda aparece:
```bash
git pull origin copilot/create-legal-process-management-system
npm start
```

### 🔍 Como Testar

```bash
# Teste no terminal
curl http://localhost:3000/api/public/consultarPorCPF/12345678900

# Ou na página
http://localhost:3000/consulta.html
```

---

## 5. 429 Too Many Requests

### 🔴 Como Aparece no Console

```
POST http://localhost:3000/api/auth/login 429 (Too Many Requests)
Response: {"erro":"Muitas requisições. Tente novamente mais tarde."}
```

### 📝 O Que Significa

Você fez **muitas requisições muito rápido** e o sistema bloqueou temporariamente para evitar ataques.

### 🤔 Por Que Acontece

**Rate Limiting (Limitação de Taxa):**
- Versão antiga: 100 requisições por 15 minutos
- Versão atual: 1000 requisições por 15 minutos

**Brute Force Protection:**
- Múltiplas tentativas de login falhadas
- Bloqueio progressivo: 1min, 2min, 4min, 8min...

### ✅ Como Resolver

**Solução 1: Aguardar**
```
Aguarde 15 minutos e tente novamente
```

**Solução 2: Reiniciar Servidor**
```bash
# Mata processo e reinicia
Ctrl+C (no terminal do servidor)
npm start
```

**Solução 3: Resetar Database (Último Recurso)**
```bash
rm -rf data/
npm run init-db
npm start
```

### 🔍 Verificar Configuração

```bash
cat .env | grep RATE_LIMIT
# Deve mostrar: RATE_LIMIT_MAX_REQUESTS=1000
```

### 📖 Documentação Relacionada

- `CORRECAO_LOGIN.md` - Ajustes no rate limiting

---

## 6. 401 Unauthorized

### 🔴 Como Aparece no Console

```
GET http://localhost:3000/api/processos 401 (Unauthorized)
Response: {"erro":"Não autorizado"}
```

### 📝 O Que Significa

Você tentou acessar uma área **protegida** sem estar **logado** ou sua **sessão expirou**.

### 🤔 Por Que Acontece

1. Não fez login
2. Sessão expirou (após 30 minutos de inatividade)
3. Cookie de sessão foi deletado
4. Servidor foi reiniciado

### ✅ Como Resolver

```
1. Faça login novamente em:
   http://localhost:3000/login.html

2. Use credenciais válidas:
   Email: admin@local
   Senha: admin123
```

### 🔒 Nota de Segurança

Este erro é **esperado e correto** - protege suas informações!

---

## 7. 403 Forbidden - CSRF

### 🔴 Como Aparece no Console

```
POST http://localhost:3000/api/processos 403 (Forbidden)
Response: {"erro":"Token CSRF inválido"}
```

### 📝 O Que Significa

A requisição não incluiu um **token CSRF válido** ou o token **expirou**.

### 🤔 Por Que Acontece

1. Token CSRF não foi obtido antes da requisição
2. Token expirou (sessão antiga)
3. Cookie bloqueado por configurações do navegador

### ✅ Como Resolver

**Solução 1: Recarregar Página**
```
F5 ou Ctrl+R
```

**Solução 2: Verificar Cookies**
```
1. DevTools (F12) → Application
2. Cookies → http://localhost:3000
3. Verificar se existe cookie com CSRF token
```

**Solução 3: Fazer Logout e Login Novamente**
```
1. Clicar em "Sair"
2. Fazer login novamente
```

### 🔍 Debug

```javascript
// Ver token CSRF no console
console.log(document.cookie);
```

---

## 8. 422 Unprocessable Entity

### 🔴 Como Aparece no Console

```
POST http://localhost:3000/api/processos 422 (Unprocessable Entity)
Response: {
  "erro":"Erro de validação",
  "detalhes":[
    {"campo":"numero_processo","mensagem":"Número de processo inválido"}
  ]
}
```

### 📝 O Que Significa

Os **dados enviados** não passaram na **validação** do servidor.

### 🤔 Por Que Acontece

Campos obrigatórios:
- Vazios
- Formato incorreto
- Dados inválidos

### ✅ Exemplos Comuns e Soluções

**Número de Processo CNJ:**
```
❌ Errado: 123456
✅ Correto: 1234567-12.2024.8.02.0001
```

**CPF:**
```
❌ Errado: 123.456.789-00 (dígitos inválidos)
✅ Correto: 123.456.789-09
```

**Email:**
```
❌ Errado: usuario@
✅ Correto: usuario@exemplo.com
```

**Senha:**
```
❌ Errado: 123 (muito curta)
✅ Correto: Senha@123 (min 10 chars, maiúscula, número, símbolo)
```

### 🎨 Interface

O sistema destaca o **campo com erro** em vermelho e mostra a mensagem de validação.

---

## 9. 500 Internal Server Error

### 🔴 Como Aparece no Console

```
GET http://localhost:3000/api/processos 500 (Internal Server Error)
Response: {"erro":"Erro interno do servidor"}
```

### 📝 O Que Significa

Ocorreu um **erro inesperado** no servidor.

### 🤔 Possíveis Causas

1. Banco de dados não inicializado
2. Arquivo de banco corrompido
3. Erro de código (bug)
4. Falta de dependências

### ✅ Como Resolver

**1. Verificar Terminal do Servidor**
```bash
# O erro completo aparece aqui
# Procure por linhas com ERROR ou Exception
```

**2. Verificar Banco de Dados**
```bash
# Verificar se existe
ls -la data/database.sqlite

# Se não existir, criar:
npm run init-db
```

**3. Reinstalar Dependências**
```bash
rm -rf node_modules
npm install
npm start
```

**4. Resetar Sistema**
```bash
# ATENÇÃO: Apaga todos os dados!
rm -rf data/
npm run init-db
npm start
```

### 📋 Informações para Reportar

Se persistir, reportar com:
```
1. Log do terminal (erro completo)
2. Passos para reproduzir
3. Screenshot do console (F12)
4. Versão: git log --oneline | head -1
```

---

## 10. CORS Errors

### 🔴 Como Aparece no Console

```
Access to fetch at 'http://localhost:3000/api/processos' from origin 'http://example.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

### 📝 O Que Significa

O navegador bloqueou a requisição porque o **frontend** e o **backend** estão em **domínios diferentes**.

### 🤔 Por Que Acontece

Política de segurança do navegador (Same-Origin Policy).

### ✅ Como Resolver

**Uso Normal (mesmo domínio):**
```
Frontend: http://localhost:3000/login.html
Backend:  http://localhost:3000/api/auth/login
✅ Mesmo domínio - Funciona!
```

**Se aparecer erro CORS:**
```
Verifique se está acessando frontend e backend pela MESMA URL:
- CERTO: http://localhost:3000
- ERRADO: Misturar localhost e 127.0.0.1
```

### ⚙️ Configuração do Servidor

O servidor já está configurado com CORS para localhost:
```javascript
// src/server.js
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

---

## 🛠️ Como Usar o DevTools para Debug

### Abrir DevTools

```
Windows/Linux: F12 ou Ctrl+Shift+I
Mac: Cmd+Option+I
```

### Abas Importantes

**1. Console**
- Mostra erros JavaScript
- Mensagens de log
- Warnings

**2. Network (Rede)**
- Mostra todas as requisições HTTP
- Status codes (200, 404, 500, etc)
- Tempo de resposta
- Headers e payload

**3. Application**
- Cookies
- Local Storage
- Session Storage

### Dicas de Debug

**Ver todas as requisições:**
```
1. DevTools → Network
2. Recarregar página (F5)
3. Ver lista de requisições
4. Clicar em cada uma para detalhes
```

**Filtrar por tipo:**
```
- All: Todas
- XHR: Requisições AJAX
- JS: JavaScript
- CSS: Estilos
- Img: Imagens
```

**Ver detalhes de erro:**
```
1. Clicar na requisição com erro (vermelho)
2. Ver aba "Response" - resposta do servidor
3. Ver aba "Headers" - cabeçalhos HTTP
```

---

## 📊 Fluxograma de Troubleshooting

```
Erro no Console?
    ↓
    ├─ ERR_SSL_PROTOCOL_ERROR?
    │   → Limpar HSTS ou usar 127.0.0.1
    │
    ├─ 404 Not Found?
    │   → Verificar URL e atualizar código
    │
    ├─ 429 Too Many Requests?
    │   → Aguardar 15min ou reiniciar servidor
    │
    ├─ 401 Unauthorized?
    │   → Fazer login novamente
    │
    ├─ 403 Forbidden?
    │   → Recarregar página (F5)
    │
    ├─ 422 Validation Error?
    │   → Corrigir dados do formulário
    │
    ├─ 500 Server Error?
    │   → Verificar terminal e resetar DB
    │
    └─ CORS Error?
        → Usar mesma URL para tudo
```

---

## ✅ Checklist Antes de Reportar Erro

Antes de pedir ajuda, verificar:

- [ ] Servidor está rodando (`npm start`)
- [ ] URL é HTTP (não HTTPS)
- [ ] Browser cache foi limpo
- [ ] HSTS foi deletado (se erro SSL)
- [ ] Testado em modo incógnito
- [ ] Testado com `127.0.0.1` ao invés de `localhost`
- [ ] DevTools aberto (F12) para ver erros completos
- [ ] Screenshot do console
- [ ] Screenshot do Network
- [ ] Log do terminal do servidor
- [ ] Versão do código: `git log --oneline | head -1`

---

## 📚 Documentação Relacionada

| Documento | Conteúdo |
|-----------|----------|
| `ERROS_CONSOLE_EXPLICADOS.md` | Este guia |
| `SOLUCAO_SSL_ERROR.md` | Detalhes sobre SSL |
| `CORRECAO_LOGIN.md` | Correções de login |
| `PROBLEMA_LOGIN_RESOLVIDO.md` | Solução login travado |
| `GUIA_RAPIDO_ERROS.md` | Referência rápida |
| `README.md` | Documentação geral |

---

## 🎓 Glossário

**Console:** Ferramenta do navegador que mostra mensagens e erros JavaScript

**DevTools:** Ferramentas de desenvolvedor do navegador (F12)

**CSRF:** Cross-Site Request Forgery - proteção contra ataques

**HSTS:** HTTP Strict Transport Security - força HTTPS

**Rate Limiting:** Limitação de requisições por tempo

**Session:** Sessão - mantém você logado

**Token:** Código de segurança temporário

**API:** Interface para comunicação entre frontend e backend

**Status Code:** Código numérico de resposta HTTP (200, 404, 500, etc)

---

## 💡 Dicas Finais

1. **Sempre abra o DevTools (F12)** ao testar - veja o que está acontecendo

2. **Modo incógnito** é seu amigo - sem cache, sem HSTS, sem cookies antigos

3. **Use 127.0.0.1** ao invés de localhost - evita problemas de HSTS

4. **Leia a mensagem de erro completa** - geralmente diz exatamente o que está errado

5. **Consulte a documentação** - cada erro tem um guia específico

6. **Terminal do servidor** também mostra erros - não ignore!

---

**Criado em:** 2026-02-10  
**Versão:** 1.0.0  
**Status:** ✅ Completo e atualizado

**Perguntas?** Consulte os outros guias em `/docs` ou abra o DevTools (F12)!
