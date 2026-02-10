# 🎯 Guia Rápido de Solução de Erros - Sistema de Processos

## 📋 Índice de Problemas e Soluções

### 1. ❌ Erro: `ERR_SSL_PROTOCOL_ERROR`

**Sintoma:**
```
GET https://localhost:3000/trocar-senha.html net::ERR_SSL_PROTOCOL_ERROR
```

**Causa:** Browser forçando HTTPS quando servidor está em HTTP

**Solução Rápida:**
1. Chrome: `chrome://net-internals/#hsts` → Delete `localhost`
2. OU modo incógnito: `Ctrl+Shift+N`
3. OU use: `http://127.0.0.1:3000`

📖 **Documentação completa:** `SOLUCAO_SSL_ERROR.md`

---

### 2. ❌ Erro: `404 Not Found` no CSRF Token

**Sintoma:**
```
GET /api/auth/csrf-token 404 (Not Found)
```

**Causa:** Endpoint errado no frontend

**Status:** ✅ **JÁ CORRIGIDO** na versão atual
- Mudado de `/api/auth/csrf-token` → `/api/csrf-token`

📖 **Documentação completa:** `CORRECAO_LOGIN.md`

---

### 3. ❌ Erro: `429 Too Many Requests`

**Sintoma:**
```
POST /api/auth/login 429 (Too Many Requests)
```

**Causa:** Rate limiting muito agressivo

**Status:** ✅ **JÁ CORRIGIDO** na versão atual
- Limite aumentado: 100 → 1000 req/15min
- CSRF token excluído do rate limiting

📖 **Documentação completa:** `CORRECAO_LOGIN.md`

---

### 4. ❌ Login bem-sucedido mas não redireciona

**Sintoma:** Aparece "Login realizado com sucesso" mas fica na tela de login

**Causa:** Erros 1, 2 ou 3 acima impedindo o fluxo

**Status:** ✅ **JÁ CORRIGIDO** com as correções acima

📖 **Documentação completa:** `ANTES_DEPOIS_LOGIN.md`

---

## 🚀 Processo de Teste Completo

### Passo 1: Preparar Ambiente

```bash
# 1. Ir para o diretório do projeto
cd /home/runner/work/Sistema-de-Processos/Sistema-de-Processos

# 2. Verificar que .env existe
ls -la .env
# Se não existir:
cp .env.example .env

# 3. Verificar configuração
cat .env | grep COOKIE_SECURE
# Deve mostrar: COOKIE_SECURE=false
```

### Passo 2: Limpar Browser

**Chrome/Edge:**
```
1. Deletar HSTS: chrome://net-internals/#hsts
   - Delete domain: localhost
   
2. Limpar cache: Ctrl+Shift+Delete
   - Período: Todo
   - Marcar: Cookies + Cache
```

**OU usar modo incógnito:**
```
Ctrl+Shift+N (Windows/Linux)
Cmd+Shift+N (Mac)
```

### Passo 3: Iniciar Servidor

```bash
npm start
```

**Verificar output:**
```
✅ Conexão com banco de dados OK
🚀 Servidor rodando na porta 3000
🔗 URL: http://localhost:3000
```

### Passo 4: Testar Automaticamente

**Opção A: Página de Testes**
```
Abrir: http://localhost:3000/test-login.html
Clicar: "Executar Todos os Testes"
Verificar: Todos devem mostrar "Sucesso" (verde)
```

**Opção B: Login Manual**
```
1. Abrir: http://localhost:3000/login.html
2. Login: admin@local / admin123
3. Resultado: Redirecionamento para trocar-senha.html
```

### Passo 5: Verificar DevTools

```
1. Abrir DevTools: F12
2. Aba Console: Não deve ter erros vermelhos
3. Aba Network:
   ✅ /api/csrf-token → 200 OK
   ✅ /api/auth/login → 200 OK
   ✅ Todas as URLs com http:// (não https://)
```

---

## 🔧 Troubleshooting por Erro

### Se aparecer SSL_PROTOCOL_ERROR:

```
1. HSTS: chrome://net-internals/#hsts → Delete localhost
2. Cache: Ctrl+Shift+Delete → Limpar tudo
3. Incógnito: Ctrl+Shift+N
4. IP: Use http://127.0.0.1:3000
```

Ver: `SOLUCAO_SSL_ERROR.md`

### Se aparecer 404 no CSRF:

```
Verificar versão do código:
git log --oneline | head -5

Deve conter:
"Fix login issues: CSRF route, rate limiting"
```

Se não tiver, atualizar:
```bash
git pull origin copilot/create-legal-process-management-system
npm install
npm start
```

### Se aparecer 429 Rate Limit:

```
Opção 1: Aguardar 15 minutos
Opção 2: Reiniciar servidor
Opção 3: Resetar brute force:
  rm -f data/database.sqlite
  npm run init-db
  npm start
```

### Se login não redirecionar:

```
1. Verificar console do browser (F12)
2. Deve aparecer:
   ✅ "Login realizado com sucesso!"
   ✅ Sem erros vermelhos
   
3. Se tiver erros, resolver conforme acima
```

---

## 📚 Documentação Disponível

| Arquivo | Conteúdo |
|---------|----------|
| `SOLUCAO_SSL_ERROR.md` | Solução completa para erro SSL |
| `CORRECAO_LOGIN.md` | Correção de CSRF e rate limiting |
| `ANTES_DEPOIS_LOGIN.md` | Comparação antes/depois das correções |
| `README.md` | Documentação geral do sistema |
| `test-login.html` | Página de testes automatizados |
| `GUIA_RAPIDO_ERROS.md` | Este arquivo |

---

## ✅ Checklist de Verificação

Antes de reportar problemas, verificar:

- [ ] Servidor está rodando (`npm start`)
- [ ] Porta 3000 está livre
- [ ] Arquivo `.env` existe
- [ ] `COOKIE_SECURE=false` no `.env`
- [ ] Browser cache foi limpo
- [ ] HSTS foi deletado (chrome://net-internals/#hsts)
- [ ] Testado em modo incógnito
- [ ] URL começa com `http://` (não `https://`)
- [ ] DevTools (F12) aberto para ver erros
- [ ] Testado com `http://127.0.0.1:3000`

---

## 🆘 Suporte

Se nenhuma solução funcionar:

1. **Capture informações:**
   - Screenshot do console (F12 → Console)
   - Screenshot do Network (F12 → Network)
   - Output do terminal (`npm start`)
   - Browser e versão
   - Sistema operacional

2. **Verifique:**
   - `git log --oneline | head -1` (última versão)
   - `cat .env` (configuração)
   - `curl http://localhost:3000` (servidor responde?)

3. **Tente:**
   - Outro browser (Firefox, Edge, Safari)
   - Outro computador
   - Porta diferente (PORT=3001 no .env)

---

**Última atualização:** 2026-02-10  
**Versão:** 1.0.0  
**Status:** ✅ Sistema totalmente funcional com documentação completa
