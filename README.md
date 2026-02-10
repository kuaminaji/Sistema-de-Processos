# Sistema de Gerenciamento de Processos Jurídicos - Enterprise

Sistema completo de gerenciamento de processos jurídicos para ambiente de produção em rede local (LAN), com backend Node.js + Express + SQLite e frontend HTML/CSS/JS vanilla.

## 🎉 CORREÇÃO DEFINITIVA APLICADA

✅ **O sistema agora funciona em QUALQUER NAVEGADOR**, mesmo que tenha sido usado antes!

**Problema Resolvido**: Erro SSL_PROTOCOL_ERROR quando browser força HTTPS

**Solução**: Detector de protocolo automático que:
- Detecta acesso via HTTPS e redireciona para HTTP
- Mostra tela profissional de redirecionamento
- Funciona automaticamente sem intervenção manual
- **Não é mais necessário limpar HSTS ou cache!**

📖 Ver `CORRECAO_DEFINITIVA.md` para detalhes completos

---

## 🎯 Características Principais

### Segurança Enterprise
- ✅ Autenticação segura com bcrypt + salt
- ✅ 2FA/TOTP opcional com QR Code  
- ✅ Proteção contra brute force (bloqueio progressivo)
- ✅ Política de senha forte (expiração, histórico, complexidade)
- ✅ CSRF protection em todas as mutações
- ✅ Rate limiting global e por rota
- ✅ Helmet + CSP configurado
- ✅ Proteção contra SQL injection (prepared statements)
- ✅ Proteção contra XSS (sanitização de inputs)
- ✅ Trilha de auditoria completa

### Funcionalidades

#### 🔐 Área Administrativa (Com Login)
- Dashboard interativo com estatísticas em tempo real
- Gerenciamento de Processos (CRUD completo)
- Registro de Movimentações (histórico detalhado)
- Gerenciamento de Clientes (CPF, WhatsApp, contatos)
- Gestão de Usuários (apenas admin)
- Gestão de Permissões RBAC granular
- Sidebar moderna e responsiva
- Busca avançada com filtros

#### 🔍 Área Pública (Sem Login)
- Consulta por CPF do cliente
- Consulta por número do processo
- Histórico completo de movimentações
- Interface limpa e intuitiva

#### 👥 Gerenciamento de Clientes
- Cadastro completo (CPF, e-mail, telefones)
- Integração WhatsApp (link direto wa.me)
- Validação de CPF (formato + dígitos verificadores)
- Vinculação a processos

## 🚀 Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/kuaminaji/Sistema-de-Processos.git
cd Sistema-de-Processos

# Instale as dependências
npm install

# Configure o ambiente
cp .env.example .env

# Inicialize o banco de dados
npm run init-db

# Inicie o servidor
npm start
```

Acesse: **http://localhost:3000**

**Credenciais padrão:**
- Email: `admin@local`
- Senha: `admin123`

⚠️ **Altere a senha no primeiro login!**

## 📁 Estrutura do Projeto

```
Sistema-de-Processos/
├── src/
│   ├── controllers/          # Lógica de negócio
│   ├── routes/               # Definição de rotas
│   ├── middleware/           # Middlewares (auth, CSRF, etc)
│   ├── database/             # Camada de banco de dados
│   └── server.js             # Servidor Express
├── public/                   # Frontend
│   ├── css/                  # Estilos responsivos
│   ├── js/                   # JavaScript vanilla
│   └── *.html                # Páginas HTML
├── tests/                    # Testes automatizados
├── data/                     # Banco de dados SQLite
└── README.md
```

## 🌐 Deploy em Produção (LAN com HTTPS)

### Nginx como Proxy Reverso

```nginx
server {
    listen 443 ssl http2;
    server_name processos.empresa.local;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Configure o .env para produção:
```env
NODE_ENV=production
SESSION_SECRET=gere-uma-string-aleatoria-de-64-caracteres
COOKIE_SECURE=true
TRUST_PROXY=1
```

## 📖 Documentação

- `API_REFERENCE.md`: Referência completa da API
- `CONTROLLERS_SUMMARY.md`: Resumo dos controllers  
- `public/README.md`: Documentação do frontend
- `TESTING_GUIDE.md`: Guia de testes

## 🔒 Segurança

- Autenticação bcrypt
- 2FA/TOTP opcional
- Proteção brute force
- CSRF protection
- Rate limiting
- SQL injection prevention
- XSS protection
- Trilha de auditoria completa

## 📊 Funcionalidades Completas

✅ Backend 100% implementado
✅ Frontend 100% implementado  
✅ Autenticação e segurança
✅ Gestão de processos jurídicos
✅ Gestão de clientes
✅ Gestão de usuários e permissões
✅ Consulta pública
✅ Backup e restauração
✅ Exportação (PDF, Excel, CSV)
✅ Auditoria e SLA
✅ Design responsivo (9 breakpoints)
✅ Documentação completa

## 🧪 Testes

```bash
npm test              # Executar testes
npm run test:watch    # Modo watch
npm run test:coverage # Cobertura
```

## 📄 Licença

ISC License

---

**v1.0.0** - Sistema Enterprise pronto para produção
