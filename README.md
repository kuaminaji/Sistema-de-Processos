# Sistema de Gerenciamento de Processos Jurídicos 

⚖️ **Sistema web completo para gerenciamento de processos jurídicos** com autenticação, consulta pública e área administrativa moderna.

Desenvolvido com Node.js + SQLite, seguindo práticas modernas de desenvolvimento seguro e organizado.

## ✨ Principais Funcionalidades

### 🔐 Área Administrativa (Com Login)
- **Dashboard Interativo**: Estatísticas em tempo real de todos os processos
- **Gerenciamento de Processos**: CRUD completo com validações
- **Gerenciamento de Clientes**: Cadastro com CPF, WhatsApp e contatos
- **Registro de Movimentações**: Histórico detalhado de andamentos
- **Gestão de Usuários**: Controle de acesso (apenas administradores)
- **Sidebar Moderna**: Navegação intuitiva e responsiva
- **Busca Avançada**: Filtros por número, autor, réu, status

### 🔍 Área Pública (Sem Login)
- **Consulta por CPF**: Clientes podem consultar seus processos
- **Consulta por Número**: Busca direta pelo número do processo
- **Histórico Completo**: Visualização de todas as movimentações
- **Interface Intuitiva**: Design limpo e fácil de usar
- **Acesso Rápido**: Sem necessidade de cadastro ou login

### 👥 Gerenciamento de Clientes
- **Cadastro Completo**: Nome, CPF, e-mail, telefones
- **Integração WhatsApp**: Link direto para enviar mensagens
- **Validação de CPF**: Verificação automática de CPF válido
- **Vinculação a Processos**: Associação automática

### 🔒 Segurança e Autenticação
- **Login Seguro**: Autenticação com sessão
- **Senha Criptografada**: Hash bcrypt com salt
- **Controle de Acesso**: Rotas protegidas por autenticação
- **Roles de Usuário**: Admin e Advogado (lawyer)
- **Rate Limiting**: Proteção contra ataques
- **CSP e CORS**: Headers de segurança configurados

## 🎨 Screenshots

### Login
![Login Page](https://github.com/user-attachments/assets/19236b57-6209-4693-a763-33b203e668a4)

### Consulta Pública
![Public Consultation](https://github.com/user-attachments/assets/4f3b626b-51ea-4351-9933-6cbc08fcfbe1)

### Resultado da Consulta
![Consultation Results](https://github.com/user-attachments/assets/b90e77c8-cb29-4021-a5e3-43f5910ea079)

## 📦 Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/kuaminaji/Sistema-de-Processos.git
cd Sistema-de-Processos

# IMPORTANTE: Instale as dependências primeiro!
npm install

# Inicie o servidor
npm start

# Acesse: http://localhost:3000
```

**Credenciais padrão**: `admin@sistema.com` / `admin123`

### ⚠️ Resolução de Problemas

**Erro: "Cannot find module 'express-session'" ou similar**
```bash
# Solução: Instale as dependências
npm install
```

**Erro ao iniciar o servidor**
```bash
# Limpe e reinstale as dependências
rm -rf node_modules package-lock.json
npm install
```

**Porta 3000 já em uso**
```bash
# Configure outra porta no arquivo .env
echo "PORT=3001" > .env
npm start
```

## 📖 Documentação Completa

Veja o arquivo [README-FULL.md](README-FULL.md) para documentação detalhada incluindo:
- API Endpoints completos
- Estrutura do banco de dados
- Guia de desenvolvimento
- Configurações avançadas

## 🚀 Tecnologias

- Node.js 20 + Express.js
- SQLite3 com auto-inicialização
- Bcrypt para senhas
- Express Session
- CPF Validator
- Modern HTML/CSS/JS

## ⚖️ Licença

ISC License - Livre para uso e modificação
