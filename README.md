# Sistema de Gerenciamento de Processos Jurídicos

Sistema web completo para gerenciamento de processos jurídicos, desenvolvido com Node.js e SQLite, seguindo práticas modernas de desenvolvimento seguro e organizado.

## 📋 Características

- **Gerenciamento Completo de Processos**: Criação, edição, visualização e exclusão de processos jurídicos
- **Dashboard com Estatísticas**: Visão geral dos processos por status
- **Busca e Filtros Avançados**: Filtragem por número, autor, réu e status
- **Movimentações**: Registro de movimentações processuais
- **Interface Responsiva**: Design moderno e adaptável para dispositivos móveis
- **API RESTful**: Endpoints bem estruturados e documentados
- **Segurança**: Proteção contra SQL Injection, XSS, CSRF e rate limiting
- **Validação de Dados**: Validação completa de entrada de dados

## 🚀 Tecnologias Utilizadas

- **Backend**:
  - Node.js v20
  - Express.js 4.18
  - SQLite3 5.1
  - Express Validator 7.0
  - Helmet 7.1 (Security headers)
  - CORS 2.8
  - Rate Limiting 7.1

- **Frontend**:
  - HTML5
  - CSS3 (Grid, Flexbox, Animations)
  - Vanilla JavaScript (ES6+)

## 📦 Instalação

### Pré-requisitos

- Node.js 20+ e npm

### Passos de Instalação

1. Clone o repositório:
```bash
git clone https://github.com/kuaminaji/Sistema-de-Processos.git
cd Sistema-de-Processos
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` conforme necessário.

4. Inicie o servidor:
```bash
npm start
```

O banco de dados será inicializado automaticamente na primeira execução.

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

Opcionalmente, você pode inicializar o banco de dados manualmente:
```bash
npm run init-db
```

5. Acesse a aplicação:
```
http://localhost:3000
```

## 📁 Estrutura do Projeto

```
Sistema-de-Processos/
├── src/
│   ├── controllers/
│   │   └── processoController.js    # Controladores da aplicação
│   ├── database/
│   │   ├── db.js                    # Conexão com o banco de dados
│   │   └── init.js                  # Inicialização do banco
│   ├── middleware/
│   │   ├── errorHandler.js          # Tratamento de erros
│   │   └── validation.js            # Validação de dados
│   ├── routes/
│   │   └── processoRoutes.js        # Rotas da API
│   └── server.js                    # Servidor principal
├── public/
│   ├── css/
│   │   └── styles.css               # Estilos da aplicação
│   ├── js/
│   │   └── app.js                   # JavaScript do frontend
│   └── index.html                   # Interface principal
├── data/
│   └── processos.db                 # Banco de dados SQLite
├── .env.example                     # Exemplo de configuração
├── .gitignore                       # Arquivos ignorados pelo Git
├── package.json                     # Dependências e scripts
└── README.md                        # Documentação
```

## 🔌 API Endpoints

### Processos

- `GET /api/processos` - Lista todos os processos (com filtros opcionais)
  - Query params: `status`, `numero`, `autor`, `reu`
  
- `GET /api/processos/:id` - Obtém detalhes de um processo específico

- `POST /api/processos` - Cria um novo processo
  - Body: `numero_processo`, `titulo`, `autor`, `reu`, `data_distribuicao`, etc.

- `PUT /api/processos/:id` - Atualiza um processo existente

- `DELETE /api/processos/:id` - Remove um processo

- `POST /api/processos/:id/movimentacoes` - Adiciona uma movimentação ao processo

- `GET /api/processos/estatisticas` - Obtém estatísticas gerais

### Exemplo de Requisição

```bash
# Criar novo processo
curl -X POST http://localhost:3000/api/processos \
  -H "Content-Type: application/json" \
  -d '{
    "numero_processo": "0001234-56.2026.8.00.0001",
    "titulo": "Ação de Cobrança",
    "autor": "João Silva",
    "reu": "Maria Santos",
    "data_distribuicao": "2026-01-30"
  }'
```

## 🗄️ Modelo de Dados

### Tabela: processos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | ID único (chave primária) |
| numero_processo | VARCHAR(50) | Número do processo (único) |
| titulo | VARCHAR(200) | Título do processo |
| descricao | TEXT | Descrição detalhada |
| autor | VARCHAR(150) | Nome do autor |
| reu | VARCHAR(150) | Nome do réu |
| status | VARCHAR(50) | Status do processo |
| tipo_acao | VARCHAR(100) | Tipo de ação |
| valor_causa | DECIMAL(15,2) | Valor da causa |
| data_distribuicao | DATE | Data de distribuição |
| data_ultima_movimentacao | DATETIME | Última movimentação |
| vara | VARCHAR(100) | Vara responsável |
| comarca | VARCHAR(100) | Comarca |
| advogado_autor | VARCHAR(150) | Advogado do autor |
| advogado_reu | VARCHAR(150) | Advogado do réu |
| observacoes | TEXT | Observações |
| criado_em | DATETIME | Data de criação |
| atualizado_em | DATETIME | Data de atualização |

### Tabela: movimentacoes

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | ID único (chave primária) |
| processo_id | INTEGER | ID do processo (chave estrangeira) |
| tipo | VARCHAR(100) | Tipo de movimentação |
| descricao | TEXT | Descrição da movimentação |
| data_movimentacao | DATETIME | Data da movimentação |
| criado_em | DATETIME | Data de criação |

## 🔒 Segurança

O sistema implementa várias camadas de segurança:

- **Helmet**: Configura headers de segurança HTTP
- **CORS**: Controle de acesso entre origens
- **Rate Limiting**: Limite de requisições por IP
- **Validação de Entrada**: Validação e sanitização de todos os dados
- **SQL Injection Prevention**: Uso de prepared statements
- **XSS Protection**: Escape de HTML no frontend
- **Content Security Policy**: Restrições de conteúdo

## 🎨 Interface do Usuário

A interface oferece:

- Dashboard com estatísticas em tempo real
- Listagem de processos com cards informativos
- Formulário completo para cadastro e edição
- Modal de detalhes com informações completas
- Filtros e busca avançada
- Notificações toast para feedback
- Design responsivo para mobile

## 🧪 Scripts Disponíveis

```bash
# Iniciar servidor em produção
npm start

# Iniciar servidor em desenvolvimento (com auto-reload)
npm run dev

# Inicializar banco de dados
npm run init-db
```

## 📝 Variáveis de Ambiente

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DB_PATH=./data/processos.db

# Segurança
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

## 👥 Autor

Sistema desenvolvido como parte do projeto de gerenciamento de processos jurídicos.

## 📞 Suporte

Para dúvidas ou sugestões, abra uma issue no repositório do GitHub.

---

Desenvolvido com ❤️ usando Node.js + SQLite
