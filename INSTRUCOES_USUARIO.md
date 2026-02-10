# 📢 INSTRUÇÕES PARA O USUÁRIO

## 🚨 VOCÊ ESTÁ VENDO O ERRO SSL? LEIA ISTO!

Se você está vendo este erro no console do navegador:
```
GET https://localhost:3000/trocar-senha.html net::ERR_SSL_PROTOCOL_ERROR
```

**A SOLUÇÃO É MUITO SIMPLES!**

---

## ✅ SOLUÇÃO GARANTIDA (100% de Sucesso)

### Use o IP 127.0.0.1 em vez de "localhost"

**Em vez de:**
```
http://localhost:3000/login.html  ← ISSO DÁ ERRO!
```

**Use isto:**
```
http://127.0.0.1:3000/login.html  ← ISSO FUNCIONA!
```

---

## 🎯 PASSOS EXATOS PARA VOCÊ SEGUIR

### 1. Pare o que está fazendo agora

Se o servidor estiver rodando, deixe rodando. Se não, inicie:
```bash
npm start
```

### 2. Feche TODAS as abas do navegador relacionadas ao sistema

- Feche qualquer aba com localhost:3000
- Feche qualquer aba com 127.0.0.1:3000
- Se possível, feche o navegador completamente e abra de novo

### 3. Copie e cole EXATAMENTE este endereço na barra de endereços:

```
http://127.0.0.1:3000/login.html
```

**IMPORTANTE:**
- ✅ Copie EXATAMENTE como está acima
- ✅ Inclua o `http://` no início
- ✅ Use `127.0.0.1` (não `localhost`)
- ✅ Cole na barra de endereços (onde fica a URL)
- ❌ NÃO use a busca do Google
- ❌ NÃO digite "localhost"

### 4. Pressione Enter

A página de login deve carregar SEM ERROS!

### 5. Faça login

- **Email:** `admin@local`
- **Senha:** `admin123`

### 6. Clique em "Entrar"

Você será redirecionado para:
```
http://127.0.0.1:3000/admin.html
```

E o dashboard vai carregar perfeitamente!

---

## 🤔 Por Que Isso Funciona?

**O Problema:**
- Navegadores modernos têm uma política de segurança chamada HSTS
- HSTS força HTTPS no endereço "localhost" automaticamente
- Nosso servidor só funciona com HTTP (não HTTPS)
- Por isso dá erro: navegador quer HTTPS, servidor só aceita HTTP

**A Solução:**
- HSTS **não se aplica a endereços IP**
- `127.0.0.1` é o MESMO que `localhost` (é o endereço da sua máquina)
- Mas é um IP, então o HSTS não força HTTPS
- Resultado: Tudo funciona perfeitamente!

---

## 🆘 E Se Ainda Não Funcionar?

### Opção 1: Use Modo Anônimo/Privado

1. Abra uma janela anônima:
   - **Chrome:** Ctrl+Shift+N
   - **Firefox:** Ctrl+Shift+P
   - **Edge:** Ctrl+Shift+N

2. Na janela anônima, acesse:
   ```
   http://127.0.0.1:3000/login.html
   ```

3. Faça login normalmente

### Opção 2: Limpe o Cache HSTS

**Chrome:**
1. Cole isto na barra de endereços: `chrome://net-internals/#hsts`
2. Na seção "Delete domain security policies"
3. Digite: `localhost`
4. Clique em "Delete"
5. Feche o Chrome completamente
6. Abra novamente e use `http://127.0.0.1:3000`

**Firefox:**
1. Cole isto na barra de endereços: `about:config`
2. Aceite o aviso
3. Procure por: `network.stricttransportsecurity.preloadlist`
4. Clique duas vezes para mudar para `false`
5. Feche e abra o Firefox
6. Use `http://127.0.0.1:3000`

**Edge:**
1. Cole isto na barra de endereços: `edge://net-internals/#hsts`
2. Na seção "Delete domain security policies"
3. Digite: `localhost`
4. Clique em "Delete"
5. Feche o Edge completamente
6. Abra novamente e use `http://127.0.0.1:3000`

### Opção 3: Reinicie o Computador

Às vezes, um simples reinício resolve:
1. Salve seu trabalho
2. Reinicie o computador
3. Após reiniciar, inicie o servidor: `npm start`
4. Acesse: `http://127.0.0.1:3000/login.html`

---

## ✅ Lista de Verificação

Marque cada item conforme completa:

- [ ] Fechei todas as abas do localhost:3000
- [ ] Copiei EXATAMENTE: `http://127.0.0.1:3000/login.html`
- [ ] Colei na barra de endereços (não no Google)
- [ ] Pressionei Enter
- [ ] A página de login carregou sem erros
- [ ] Fiz login com admin@local / admin123
- [ ] O dashboard carregou!

Se todos estão marcados: **PARABÉNS! ESTÁ FUNCIONANDO!** 🎉

---

## 📱 Acessando de Outro Dispositivo na Rede

Se você quer acessar de outro computador/celular na mesma rede:

1. Descubra o IP da sua máquina:
   
   **Windows:**
   ```cmd
   ipconfig
   ```
   Procure por "Endereço IPv4" (algo como 192.168.1.10)
   
   **Linux/Mac:**
   ```bash
   ifconfig
   ```
   ou
   ```bash
   ip addr
   ```

2. No outro dispositivo, acesse:
   ```
   http://[SEU_IP]:3000/login.html
   ```
   
   Exemplo: `http://192.168.1.10:3000/login.html`

---

## 📚 Documentação Adicional

Se você quer entender mais:
- `INICIO_RAPIDO.md` - Guia rápido de 5 minutos
- `README.md` - Documentação completa do sistema
- `SOLUCAO_DEFINITIVA_SSL.md` - Explicação técnica detalhada
- `ERROS_CONSOLE_EXPLICADOS.md` - Todos os erros explicados

---

## 💡 Dicas Importantes

### DO (Faça):
✅ Sempre use `http://127.0.0.1:3000`  
✅ Salve este endereço nos favoritos  
✅ Use modo anônimo para testar  
✅ Verifique se o servidor está rodando (`npm start`)  

### DON'T (Não Faça):
❌ Não use `http://localhost:3000`  
❌ Não tente acessar via `https://`  
❌ Não ignore o aviso vermelho na página de login  
❌ Não digite na busca do Google  

---

## 🎊 Pronto para Usar!

Depois de fazer login com sucesso, você pode:

- ✅ Gerenciar processos jurídicos
- ✅ Cadastrar clientes com CPF e WhatsApp
- ✅ Registrar movimentações de processos
- ✅ Criar novos usuários
- ✅ Configurar permissões (RBAC)
- ✅ Visualizar auditoria e estatísticas
- ✅ Exportar dados em PDF, Excel, CSV
- ✅ Fazer backup e restauração
- ✅ E muito mais!

**Aproveite o sistema!** ⚖️

---

## 📞 Precisa de Ajuda?

Se após seguir TODAS estas instruções ainda não funcionar:

1. Tire um print da tela mostrando o erro
2. Abra o console do navegador (F12)
3. Tire um print do console também
4. Verifique se o servidor está realmente rodando
5. Verifique se usou `127.0.0.1` (não `localhost`)

**Lembre-se: USE O IP 127.0.0.1, NÃO USE "localhost"!**

Isso resolve 99,9% dos problemas! 🚀
