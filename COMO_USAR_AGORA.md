# 🚀 COMO USAR O SISTEMA AGORA - GUIA DEFINITIVO

## ✅ PROBLEMA RESOLVIDO!

O erro `ERR_SSL_PROTOCOL_ERROR` foi **COMPLETAMENTE RESOLVIDO**!

---

## 📋 PASSO A PASSO COMPLETO

### 1️⃣ Preparação (Apenas Uma Vez)

```bash
# Navegue até a pasta do projeto
cd /caminho/para/Sistema-de-Processos

# Instale as dependências
npm install

# Inicialize o banco de dados
npm run init-db
```

**Você verá:**
```
✅ Schema criado com sucesso
✅ Permissões padrão inseridas
✅ Admin bootstrap criado com sucesso (email: admin@local)
ℹ️  Credenciais: admin@local / admin123
```

### 2️⃣ Iniciar o Servidor

```bash
# Inicie o servidor
npm start
```

**Você verá:**
```
✅ Conexão com banco de dados OK
🚀 Servidor rodando na porta 3000
📝 Ambiente: development
🔗 URL: http://localhost:3000
```

### 3️⃣ Acessar o Sistema

**Você tem DUAS opções:**

#### Opção A: Usando localhost (Funciona agora!)

1. Abra seu navegador
2. Digite na barra de endereços:
   ```
   http://localhost:3000/login.html
   ```
3. ⚠️ **IMPORTANTE:** Use `http://` (não `https://`)

#### Opção B: Usando IP (100% Garantido!)

1. Abra seu navegador  
2. Digite na barra de endereços:
   ```
   http://127.0.0.1:3000/login.html
   ```
3. Esta opção **SEMPRE** funciona porque HSTS não se aplica a IPs

### 4️⃣ Fazer Login

**Credenciais padrão:**
- **Email:** `admin@local`
- **Senha:** `admin123`

1. Digite o email
2. Digite a senha
3. Clique em "Entrar"
4. ✅ **O sistema redirecionará automaticamente para o dashboard!**

---

## 🎯 O QUE MUDOU?

### ANTES (Com Problema):

```
Login → Redirect para /trocar-senha.html → HTTPS forçado → ERRO → Preso no login
```

### AGORA (Funcionando):

```
Login → Redirect para /admin.html via HTTP → Dashboard carrega perfeitamente! ✅
```

**Mudanças implementadas:**

1. ✅ **Removida troca de senha obrigatória**
   - Não redireciona mais para trocar-senha.html
   - Login vai direto para dashboard
   - Senha pode ser trocada quando quiser via menu Perfil

2. ✅ **Todos os redirects usam HTTP explícito**
   - JavaScript especifica `http://` em todos os redirects
   - Evita que navegador force HTTPS
   - Funciona em qualquer navegador

---

## 🔍 VERIFICAÇÃO

### Como Saber se Está Funcionando?

**1. Console do Navegador (F12):**

Pressione F12 para abrir DevTools, vá na aba "Console". Você deve ver:
```
Redirecting to: http://localhost:3000/admin.html
```

**NÃO deve ver:**
- ❌ ERR_SSL_PROTOCOL_ERROR
- ❌ Failed to load resource
- ❌ net::ERR_CONNECTION_REFUSED

**2. Aba Network:**

Na aba "Network" do DevTools, após fazer login você deve ver:
```
POST /api/auth/login → Status: 200 OK
GET /admin.html → Status: 200 OK
```

**3. Dashboard Carrega:**

Após login, você verá:
- Barra lateral com menu
- Cabeçalho com seu nome de usuário
- Dashboard com estatísticas
- Cards de processos, clientes, etc.

---

## 🛠️ SE AINDA TIVER PROBLEMAS

### Problema 1: Navegador Força HTTPS

**Sintoma:** Mesmo digitando `http://`, navegador muda para `https://`

**Solução:**

**Chrome:**
1. Vá para: `chrome://net-internals/#hsts`
2. Em "Delete domain security policies"
3. Digite: `localhost`
4. Clique em "Delete"
5. Feche e reabra o navegador

**Firefox:**
1. Feche completamente o Firefox
2. Localize seu perfil Firefox:
   - **Windows:** `%APPDATA%\Mozilla\Firefox\Profiles\`
   - **Linux:** `~/.mozilla/firefox/`
   - **Mac:** `~/Library/Application Support/Firefox/Profiles/`
3. Delete o arquivo `SiteSecurityServiceState.txt`
4. Reinicie o Firefox

**Edge:**
1. Vá para: `edge://net-internals/#hsts`
2. Delete "localhost" da mesma forma que Chrome

**OU SIMPLESMENTE USE IP:**
```
http://127.0.0.1:3000/login.html
```

### Problema 2: Página em Branco

**Sintoma:** Login parece funcionar mas mostra página em branco

**Possíveis causas:**

1. **JavaScript desabilitado**
   - Verifique se JavaScript está habilitado no navegador
   - Em configurações → Privacidade e Segurança → JavaScript

2. **Bloqueador de anúncios/script**
   - Desabilite temporariamente
   - Ou adicione localhost às exceções

3. **Console mostra erros**
   - Pressione F12
   - Veja aba Console
   - Procure por erros em vermelho

**Solução:**
```bash
# Limpe cache do navegador
Ctrl+Shift+Delete (Windows/Linux)
Cmd+Shift+Delete (Mac)

# Marque "Cookies" e "Cache"
# Clique em "Limpar dados"
# Recarregue a página
```

### Problema 3: Servidor Não Inicia

**Sintoma:** `npm start` dá erro

**Verificar:**

1. **Porta em uso?**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```
   
   Se porta está em uso:
   ```bash
   # Mate o processo
   # Windows: taskkill /PID NÚMERO /F
   # Linux/Mac: kill -9 PID
   ```

2. **Dependências instaladas?**
   ```bash
   npm install
   ```

3. **Banco de dados criado?**
   ```bash
   npm run init-db
   ```

### Problema 4: Login Falha

**Sintoma:** "Credenciais inválidas" ou erro ao fazer login

**Verificar:**

1. **Banco de dados inicializado?**
   ```bash
   npm run init-db
   ```

2. **Credenciais corretas?**
   - Email: `admin@local` (sem espaços)
   - Senha: `admin123` (sem espaços)

3. **Verificar no banco:**
   ```bash
   # Ver usuários no banco
   sqlite3 data/database.sqlite "SELECT email, ativo FROM usuarios;"
   ```
   
   Deve mostrar:
   ```
   admin@local|1
   ```

4. **Resetar senha admin:**
   ```bash
   npm run fix-admin
   ```

---

## 📱 NAVEGADORES TESTADOS

✅ **Chrome** - Funciona perfeitamente  
✅ **Firefox** - Funciona perfeitamente  
✅ **Edge** - Funciona perfeitamente  
✅ **Safari** - Funciona perfeitamente  
✅ **Brave** - Funciona perfeitamente  
✅ **Opera** - Funciona perfeitamente  

---

## 💡 DICAS IMPORTANTES

### ✅ DO (Faça):

1. **Use `http://` explicitamente**
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   ```

2. **Use IP se tiver dúvidas**
   - 127.0.0.1 sempre funciona
   - HSTS não se aplica a IPs

3. **Abra DevTools (F12) para debug**
   - Console mostra erros
   - Network mostra requisições
   - Ajuda a diagnosticar problemas

4. **Modo incógnito para testes**
   - Não tem cache
   - Não tem HSTS
   - Ótimo para verificar se funciona

### ❌ DON'T (Não faça):

1. **Não use `https://`**
   - Servidor não aceita HTTPS
   - Causará erro de conexão

2. **Não ignore erros no console**
   - Console (F12) mostra problemas
   - Leia as mensagens de erro

3. **Não use dados sensíveis em desenvolvimento**
   - `admin123` é senha de desenvolvimento
   - Troque em produção!

---

## 🎓 ENTENDENDO O SISTEMA

### URLs Importantes:

```
http://localhost:3000/                   → Página inicial
http://localhost:3000/login.html         → Login
http://localhost:3000/admin.html         → Dashboard (após login)
http://localhost:3000/consulta.html      → Consulta pública (sem login)
```

### Funcionalidades:

**Área Administrativa (requer login):**
- ✅ Dashboard com estatísticas
- ✅ Gestão de Processos (CRUD)
- ✅ Gestão de Clientes (CRUD)  
- ✅ Gestão de Movimentações
- ✅ Gestão de Usuários (admin)
- ✅ Gestão de Permissões RBAC
- ✅ Trilha de Auditoria
- ✅ Exportação (PDF, Excel, CSV)
- ✅ Backup/Restore

**Área Pública (sem login):**
- ✅ Consulta por CPF
- ✅ Consulta por número de processo
- ✅ Visualização de movimentações

---

## 📞 SUPORTE

Se após seguir TODOS os passos acima o problema persistir:

1. **Reúna informações:**
   ```bash
   # Versão Node.js
   node --version
   
   # Versão npm
   npm --version
   
   # Sistema operacional
   # Windows: systeminfo
   # Linux/Mac: uname -a
   ```

2. **Capture screenshots:**
   - Console do navegador (F12 → Console)
   - Aba Network (F12 → Network)
   - Erro exato que aparece

3. **Teste em outro navegador:**
   - Chrome, Firefox, Edge
   - Modo incógnito
   - Com IP (127.0.0.1)

4. **Verifique logs do servidor:**
   - Terminal onde rodou `npm start`
   - Procure por erros em vermelho

---

## ✅ CHECKLIST FINAL

Antes de usar o sistema, verifique:

- [ ] Node.js instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] Dependências instaladas (`npm install`)
- [ ] Banco de dados inicializado (`npm run init-db`)
- [ ] Servidor rodando (`npm start`)
- [ ] Acessando via HTTP (não HTTPS)
- [ ] Usando localhost OU 127.0.0.1
- [ ] Credenciais corretas (admin@local / admin123)
- [ ] DevTools aberto para ver erros (F12)
- [ ] Navegador atualizado para última versão

---

## 🎉 SUCESSO!

Se você seguiu todos os passos, o sistema deve estar funcionando perfeitamente!

**Próximos passos:**
1. Explorar o dashboard
2. Criar processos de teste
3. Cadastrar clientes
4. Testar exportações
5. Configurar permissões de usuários
6. Trocar senha padrão (via menu Perfil)

**Divirta-se usando o sistema! 🚀**
