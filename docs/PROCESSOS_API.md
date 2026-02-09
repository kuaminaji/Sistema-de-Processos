# API de Processos

Esta documentação descreve os endpoints da API de gerenciamento de processos jurídicos.

## Autenticação

Todos os endpoints requerem autenticação via sessão. O usuário deve estar logado e ter as permissões apropriadas.

## Permissões Necessárias

- `processos.view` - Visualizar processos
- `processos.create` - Criar processos
- `processos.update` - Editar processos
- `processos.delete` - Excluir processos

## Endpoints

### 1. Listar Processos

Lista todos os processos com paginação e filtros.

**Endpoint:** `GET /api/processos`

**Permissões:** `processos.view`

**Query Parameters:**
- `page` (opcional): Número da página (padrão: 1)
- `perPage` (opcional): Itens por página (padrão: 10, máx: 100)
- `sortBy` (opcional): Campo para ordenação (padrão: 'criado_em')
- `sortOrder` (opcional): Ordem (ASC/DESC, padrão: DESC)
- `numero` (opcional): Filtrar por número do processo (busca parcial)
- `autor` (opcional): Filtrar por autor (busca parcial)
- `reu` (opcional): Filtrar por réu (busca parcial)
- `status` (opcional): Filtrar por status
- `cliente_id` (opcional): Filtrar por ID do cliente

**Status válidos:**
- `distribuido`
- `em_andamento`
- `suspenso`
- `arquivado`
- `sentenciado`
- `transitado_em_julgado`

**Resposta de Sucesso:** `200 OK`
```json
{
  "success": true,
  "message": "Processos listados com sucesso",
  "data": {
    "items": [
      {
        "id": 1,
        "numero_processo": "0000001-00.0000.0.00.0000",
        "titulo": "Ação Trabalhista",
        "descricao": "Descrição do processo",
        "autor": "João Silva",
        "reu": "Empresa XPTO",
        "status": "em_andamento",
        "tipo_acao": "Trabalhista",
        "valor_causa": 50000.00,
        "data_distribuicao": "2024-01-15",
        "data_ultima_movimentacao": "2024-01-20",
        "vara": "1ª Vara do Trabalho",
        "comarca": "São Paulo",
        "advogado_autor": "Dr. José Santos",
        "advogado_reu": "Dra. Maria Oliveira",
        "observacoes": "Observações gerais",
        "cliente_id": 1,
        "cliente_nome": "João Silva",
        "cliente_cpf": "123.456.789-00",
        "criado_em": "2024-01-15T10:00:00.000Z",
        "atualizado_em": "2024-01-20T15:30:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "perPage": 10,
    "totalPages": 5
  }
}
```

### 2. Buscar Processo por ID

Obtém um processo específico com suas movimentações.

**Endpoint:** `GET /api/processos/:id`

**Permissões:** `processos.view`

**Resposta de Sucesso:** `200 OK`
```json
{
  "success": true,
  "message": "Processo encontrado com sucesso",
  "data": {
    "processo": {
      "id": 1,
      "numero_processo": "0000001-00.0000.0.00.0000",
      "titulo": "Ação Trabalhista",
      "autor": "João Silva",
      "reu": "Empresa XPTO",
      "status": "em_andamento",
      "cliente_nome": "João Silva",
      "cliente_cpf": "123.456.789-00",
      "cliente_email": "joao@email.com",
      "cliente_whatsapp": "5511999999999"
    },
    "movimentacoes": [
      {
        "id": 1,
        "processo_id": 1,
        "tipo": "Audiência",
        "descricao": "Audiência de conciliação",
        "data_movimentacao": "2024-01-20",
        "criado_em": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

**Resposta de Erro:** `404 Not Found`
```json
{
  "success": false,
  "message": "Processo não encontrado"
}
```

### 3. Criar Processo

Cria um novo processo.

**Endpoint:** `POST /api/processos`

**Permissões:** `processos.create`

**Body:**
```json
{
  "numero_processo": "0000001-00.0000.0.00.0000",
  "titulo": "Ação Trabalhista",
  "descricao": "Descrição detalhada",
  "autor": "João Silva",
  "reu": "Empresa XPTO",
  "status": "distribuido",
  "tipo_acao": "Trabalhista",
  "valor_causa": 50000.00,
  "data_distribuicao": "2024-01-15",
  "vara": "1ª Vara do Trabalho",
  "comarca": "São Paulo",
  "advogado_autor": "Dr. José Santos",
  "advogado_reu": "Dra. Maria Oliveira",
  "observacoes": "Observações gerais",
  "cliente_id": 1
}
```

**Campos Obrigatórios:**
- `numero_processo` - Formato CNJ: 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO)
- `titulo`
- `autor`
- `reu`
- `status`

**Campos Opcionais:**
- `descricao`
- `tipo_acao`
- `valor_causa`
- `data_distribuicao`
- `vara`
- `comarca`
- `advogado_autor`
- `advogado_reu`
- `observacoes`
- `cliente_id` (deve ser um ID válido de cliente)

**Resposta de Sucesso:** `201 Created`
```json
{
  "success": true,
  "message": "Processo criado com sucesso",
  "data": {
    "id": 1,
    "numero_processo": "0000001-00.0000.0.00.0000",
    "titulo": "Ação Trabalhista",
    "autor": "João Silva",
    "reu": "Empresa XPTO",
    "status": "distribuido"
  }
}
```

**Resposta de Erro:** `409 Conflict`
```json
{
  "success": false,
  "message": "Número do processo já cadastrado"
}
```

### 4. Atualizar Processo

Atualiza um processo existente.

**Endpoint:** `PUT /api/processos/:id`

**Permissões:** `processos.update`

**Body:** (todos os campos são opcionais)
```json
{
  "titulo": "Novo Título",
  "status": "em_andamento",
  "observacoes": "Nova observação"
}
```

**Resposta de Sucesso:** `200 OK`
```json
{
  "success": true,
  "message": "Processo atualizado com sucesso",
  "data": {
    "id": 1,
    "numero_processo": "0000001-00.0000.0.00.0000",
    "titulo": "Novo Título",
    "status": "em_andamento"
  }
}
```

### 5. Excluir Processo

Exclui um processo e suas movimentações (CASCADE).

**Endpoint:** `DELETE /api/processos/:id`

**Permissões:** `processos.delete`

**Resposta de Sucesso:** `200 OK`
```json
{
  "success": true,
  "message": "Processo excluído com sucesso"
}
```

### 6. Busca Avançada

Busca processos com múltiplos filtros.

**Endpoint:** `GET /api/processos/search`

**Permissões:** `processos.view`

**Query Parameters:**
- `page`, `perPage`, `sortBy`, `sortOrder` - Mesmos da listagem
- `query` (opcional): Busca textual em número, título, descrição, autor e réu
- `status` (opcional): Filtrar por status
- `tipo_acao` (opcional): Filtrar por tipo de ação (busca parcial)
- `data_inicio` (opcional): Data de distribuição inicial (ISO8601)
- `data_fim` (opcional): Data de distribuição final (ISO8601)
- `cliente_id` (opcional): Filtrar por ID do cliente
- `valor_min` (opcional): Valor mínimo da causa
- `valor_max` (opcional): Valor máximo da causa

**Resposta:** Igual à listagem simples

### 7. Estatísticas

Obtém estatísticas para dashboard.

**Endpoint:** `GET /api/processos/stats`

**Permissões:** `processos.view`

**Resposta de Sucesso:** `200 OK`
```json
{
  "success": true,
  "message": "Estatísticas obtidas com sucesso",
  "data": {
    "total": 150,
    "porStatus": {
      "distribuido": 20,
      "em_andamento": 80,
      "suspenso": 10,
      "arquivado": 30,
      "sentenciado": 8,
      "transitado_em_julgado": 2
    },
    "recentCount": 15,
    "recentActivityCount": 25,
    "porCliente": [
      {
        "id": 1,
        "nome": "João Silva",
        "count": 10
      }
    ],
    "valorTotal": 5000000.00,
    "valorMedio": 33333.33
  }
}
```

## Códigos de Status HTTP

- `200 OK` - Sucesso
- `201 Created` - Recurso criado com sucesso
- `400 Bad Request` - Erro de validação
- `401 Unauthorized` - Não autenticado
- `403 Forbidden` - Sem permissão
- `404 Not Found` - Recurso não encontrado
- `409 Conflict` - Conflito (número processo duplicado)
- `500 Internal Server Error` - Erro no servidor

## Validações

### Número do Processo
- Deve seguir o formato CNJ com 20 dígitos
- Exemplo: `0000001-00.2024.8.26.0001`
- Deve ser único no sistema

### Status
Apenas os seguintes valores são aceitos:
- `distribuido`
- `em_andamento`
- `suspenso`
- `arquivado`
- `sentenciado`
- `transitado_em_julgado`

### Cliente ID
Se fornecido, deve ser um ID válido de um cliente existente.

## Segurança

- Todos os endpoints possuem proteção CSRF
- Todas as entradas são sanitizadas
- Queries SQL são parametrizadas (prevenção de SQL Injection)
- Campos de ordenação são validados em whitelist
- Auditoria completa de todas as operações

## Auditoria

Todas as operações são registradas na trilha de auditoria com:
- ID do usuário
- Email do usuário
- Ação realizada
- IP de origem
- User-Agent
- Timestamp
- Detalhes da operação
