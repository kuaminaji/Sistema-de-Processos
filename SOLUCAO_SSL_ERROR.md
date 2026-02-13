# 🔧 Solução para Erro SSL_PROTOCOL_ERROR

## ❌ Erro Reportado

```
GET https://localhost:3000/trocar-senha.html net::ERR_SSL_PROTOCOL_ERROR
app.js:44
checkAuth @ app.js:70
(anônimo) @ login.html:150
```

## 🔍 Causa do Problema

O servidor está rodando em **HTTP** (`http://localhost:3000`) mas o browser está tentando acessar via **HTTPS** (`https://localhost:3000`).

### Por que isso acontece?

1. **Cache do Browser**: O browser tentou acessar via HTTPS antes e guardou isso em cache
2. **HSTS (HTTP Strict Transport Security)**: O browser pode ter um registro HSTS para localhost
3. **Redirecionamento Automático**: Algumas extensões de browser forçam HTTPS
4. **Configuração do Browser**: Configuração de "sempre usar HTTPS" ativa

## ✅ Soluções (em ordem de prioridade)

### Solução 1: Limpar Estado HSTS do Browser (RECOMENDADO)

#### Chrome / Edge / Brave:

1. Acesse: `chrome://net-internals/#hsts`
2. Na seção **"Delete domain security policies"**
3. Digite: `localhost`
4. Clique em **"Delete"**
5. Verifique na seção **"Query HSTS/PKP domain"** que `localhost` não está mais listado

#### Firefox:

1. Feche completamente o Firefox
2. Localize o perfil do Firefox:
   - Windows: `%APPDATA%\Mozilla\Firefox\Profiles\`
   - Linux: `~/.mozilla/firefox/`
   - Mac: `~/Library/Application Support/Firefox/Profiles/`
3. Dentro da pasta do perfil, delete o arquivo `SiteSecurityServiceState.txt`
4. Reinicie o Firefox

#### Safari (Mac):

1. Feche o Safari
2. Abra o Terminal
3. Execute: `rm ~/Library/Cookies/HSTS.plist`
4. Reinicie o Safari

### Solução 2: Usar Modo Incógnito/Anônimo

O modo incógnito não usa cache ou configurações de HSTS:

- **Chrome/Edge**: Ctrl+Shift+N (Windows/Linux) ou Cmd+Shift+N (Mac)
- **Firefox**: Ctrl+Shift+P (Windows/Linux) ou Cmd+Shift+P (Mac)
- **Safari**: Cmd+Shift+N

### Solução 3: Limpar Cache Completo do Browser

#### Chrome / Edge:

1. Pressione `Ctrl+Shift+Delete` (Windows/Linux) ou `Cmd+Shift+Delete` (Mac)
2. Selecione **"Todo o período"**
3. Marque:
   - ✅ Cookies e outros dados do site
   - ✅ Imagens e arquivos armazenados em cache
4. Clique em **"Limpar dados"**

#### Firefox:

1. Pressione `Ctrl+Shift+Delete` (Windows/Linux) ou `Cmd+Shift+Delete` (Mac)
2. Selecione **"Tudo"**
3. Marque:
   - ✅ Cookies
   - ✅ Cache
   - ✅ Histórico de navegação
4. Clique em **"Limpar agora"**

### Solução 4: Usar IP ao invés de localhost

Ao invés de `http://localhost:3000`, use:
- `http://127.0.0.1:3000`

O IP não tem políticas HSTS associadas.

### Solução 5: Usar uma Porta Diferente

Se o problema persistir, altere a porta no `.env`:

```env
PORT=3001
```

Depois acesse: `http://localhost:3001`

### Solução 6: Desabilitar Extensões que Forçam HTTPS

Algumas extensões forçam HTTPS automaticamente:
- HTTPS Everywhere
- Smart HTTPS
- HTTP to HTTPS Redirect

**Desabilite temporariamente** essas extensões para testar.

## 🚀 Verificação Passo a Passo

### 1. Confirmar que o Servidor está em HTTP

```bash
cd /home/runner/work/Sistema-de-Processos/Sistema-de-Processos
npm start
```

Você deve ver:
```
🚀 Servidor rodando na porta 3000
🔗 URL: http://localhost:3000
```

**Confirme que a URL é HTTP, não HTTPS!**

### 2. Verificar Configuração (.env)

```bash
cat .env | grep COOKIE_SECURE
```

Deve mostrar:
```
COOKIE_SECURE=false
```

Se não existir `.env`, crie:
```bash
cp .env.example .env
```

### 3. Testar com cURL (sem browser)

```bash
curl -v http://localhost:3000/login.html
```

Se funcionar, o problema é no browser.

### 4. Abrir DevTools e Verificar

1. Abra `http://localhost:3000/login.html` (com HTTP!)
2. Pressione F12 para abrir DevTools
3. Vá para a aba **Network**
4. Faça login
5. Verifique as requisições:
   - ✅ Devem ser para `http://localhost:3000`
   - ❌ NÃO devem ser para `https://localhost:3000`

## 📋 Checklist de Troubleshooting

- [ ] Servidor está rodando em HTTP (não HTTPS)
- [ ] Arquivo `.env` existe com `COOKIE_SECURE=false`
- [ ] Cache do browser foi limpo
- [ ] Estado HSTS foi deletado (chrome://net-internals/#hsts)
- [ ] Testado em modo incógnito
- [ ] URL digitada começa com `http://` (não `https://`)
- [ ] Nenhuma extensão está forçando HTTPS
- [ ] DevTools mostra requisições em HTTP

## 🎯 Solução Rápida (Mais Provável)

**90% dos casos** são resolvidos com:

1. **Deletar HSTS no Chrome**:
   - Vá para `chrome://net-internals/#hsts`
   - Delete domain: `localhost`

2. **Limpar Cache**:
   - Pressione `Ctrl+Shift+Delete`
   - Limpe "Todo o período"

3. **Usar Modo Incógnito**:
   - Pressione `Ctrl+Shift+N`
   - Acesse `http://localhost:3000/login.html`

## 🔧 Se Nada Funcionar

### Opção 1: Acessar via IP

Sempre use `http://127.0.0.1:3000` ao invés de `http://localhost:3000`

### Opção 2: Usar outro Browser

Teste com um browser diferente que você não usou antes.

### Opção 3: Configurar HTTPS (Avançado)

Se você realmente precisa de HTTPS em desenvolvimento:

1. Instale `mkcert`:
```bash
# Linux/Mac
brew install mkcert
# Windows (com Chocolatey)
choco install mkcert
```

2. Gere certificados:
```bash
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

3. Configure o servidor para usar HTTPS (requer modificação do código)

**Mas para desenvolvimento local, HTTP é suficiente!**

## 📝 Notas Importantes

⚠️ **O servidor NUNCA roda em HTTPS automaticamente**
- Apenas HTTP (`http://localhost:3000`)
- HTTPS requer certificados SSL
- HTTPS é configurado com proxy reverso (Nginx/Caddy) em produção

⚠️ **HSTS é persistente**
- Uma vez ativado, o browser SEMPRE usa HTTPS
- Precisa ser deletado manualmente
- `chrome://net-internals/#hsts` é a solução

⚠️ **Sempre digite a URL completa**
- ✅ `http://localhost:3000`
- ❌ `localhost:3000` (browser pode assumir HTTPS)

## 🆘 Suporte Adicional

Se o problema persistir após todas as soluções:

1. **Capture screenshots**:
   - DevTools → Network (F12)
   - Console de erros
   - URL na barra de endereços

2. **Capture logs do servidor**:
   - Output do terminal onde `npm start` está rodando

3. **Verifique**:
   - Versão do browser
   - Sistema operacional
   - Extensões instaladas

---

**Status**: ✅ Problema identificado (HSTS/Cache do browser)  
**Solução**: Limpar HSTS e cache, ou usar modo incógnito  
**Data**: 2026-02-10
