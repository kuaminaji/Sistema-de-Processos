# 🚀 INÍCIO RÁPIDO - Sistema de Processos

## ⚠️ IMPORTANTE: USE O IP, NÃO USE "localhost"

Se você está vendo erros de SSL (`ERR_SSL_PROTOCOL_ERROR`), é porque seu navegador está forçando HTTPS no endereço "localhost".

**SOLUÇÃO SIMPLES: Use o IP 127.0.0.1 em vez de localhost!**

---

## 📋 Passos para Começar

### 1️⃣ Instalar Dependências
```bash
npm install
```

### 2️⃣ Inicializar Banco de Dados
```bash
npm run init-db
```

### 3️⃣ Iniciar Servidor
```bash
npm start
```

### 4️⃣ Acessar o Sistema

**✅ USE ESTE ENDEREÇO:**
```
http://127.0.0.1:3000/login.html
```

**❌ NÃO USE ESTE:**
```
http://localhost:3000/login.html  ← Vai dar erro SSL!
```

### 5️⃣ Fazer Login

**Credenciais padrão:**
- Email: `admin@local`
- Senha: `admin123`

---

## 🎯 Pronto!

Após o login, você será redirecionado para o dashboard:
```
http://127.0.0.1:3000/admin.html
```

---

## ❓ Por que usar 127.0.0.1 em vez de localhost?

**O Problema:**
- Navegadores modernos (Chrome, Edge, Firefox) têm uma política chamada HSTS
- HSTS força HTTPS no endereço "localhost" por segurança
- Nosso servidor roda apenas em HTTP (não HTTPS)
- Resultado: Erro `ERR_SSL_PROTOCOL_ERROR`

**A Solução:**
- HSTS não se aplica a endereços IP
- `127.0.0.1` é o mesmo que `localhost`, mas é um IP
- Usando o IP, o navegador não força HTTPS
- Tudo funciona perfeitamente!

---

## 🆘 Ainda com Problemas?

### Se ainda aparecer erro SSL:

1. **Limpe o cache HSTS do navegador**
   
   **Chrome:**
   ```
   1. Vá para: chrome://net-internals/#hsts
   2. Em "Delete domain security policies"
   3. Digite: localhost
   4. Clique "Delete"
   5. Feche o Chrome completamente
   6. Abra novamente e use http://127.0.0.1:3000
   ```

   **Firefox:**
   ```
   1. Feche o Firefox
   2. Abra novamente
   3. Use http://127.0.0.1:3000
   ```

2. **Use modo anônimo/privado**
   ```
   Ctrl+Shift+N (Chrome) ou Ctrl+Shift+P (Firefox)
   Acesse: http://127.0.0.1:3000/login.html
   ```

3. **Reinicie o servidor**
   ```bash
   # Pare o servidor (Ctrl+C)
   # Inicie novamente
   npm start
   ```

---

## 📚 Documentação Completa

Para mais informações, consulte:
- `README.md` - Documentação completa
- `SOLUCAO_DEFINITIVA_SSL.md` - Detalhes sobre SSL
- `COMO_USAR_AGORA.md` - Guia completo de uso

---

## ✅ Checklist de Sucesso

Marque conforme avança:

- [ ] Instalei as dependências (`npm install`)
- [ ] Inicializei o banco (`npm run init-db`)
- [ ] Iniciei o servidor (`npm start`)
- [ ] Acessei via **IP**: `http://127.0.0.1:3000/login.html`
- [ ] Fiz login com admin@local / admin123
- [ ] Dashboard carregou sem erros!

Se todos os itens estão marcados, **está tudo funcionando!** 🎉

---

## 🎊 Sucesso!

Agora você pode:
- Gerenciar processos
- Cadastrar clientes
- Registrar movimentações
- Criar usuários
- Configurar permissões
- E muito mais!

**Aproveite o sistema!** ⚖️
