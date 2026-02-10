# API Reference - Sistema de Processos Jurídicos

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication via session cookie. Public endpoints don't require authentication.

### CSRF Token
For authenticated endpoints, include CSRF token in `X-CSRF-Token` header.
Get token: `GET /api/csrf-token`

---

## Authentication Endpoints

### POST /api/auth/login
Login to the system
```json
{
  "email": "admin@local",
  "senha": "admin123",
  "totpToken": "123456" // optional, if 2FA enabled
}
```

### POST /api/auth/logout
Logout from the system

### GET /api/auth/me
Get current user information

### POST /api/auth/trocar-senha
Change password
```json
{
  "senhaAtual": "oldpassword",
  "senhaNova": "newpassword",
  "confirmarSenha": "newpassword"
}
```

### GET /api/auth/setup-2fa
Setup two-factor authentication (returns QR code)

### POST /api/auth/enable-2fa
Enable 2FA with token verification
```json
{
  "token": "123456"
}
```

### POST /api/auth/disable-2fa
Disable 2FA

---

## Process Endpoints

### GET /api/processos
List processes (paginated, with filters)
**Permission**: `processos.view`

Query params:
- `page` (default: 1)
- `perPage` (default: 10, max: 100)
- `sortBy` (default: 'criado_em')
- `sortOrder` (default: 'DESC')
- `numero` (filter by process number)
- `autor` (filter by author)
- `reu` (filter by defendant)
- `status` (filter by status)
- `cliente_id` (filter by client)

### GET /api/processos/stats
Get process statistics
**Permission**: `processos.view`

### GET /api/processos/search
Advanced search with multiple filters
**Permission**: `processos.view`

### GET /api/processos/:id
Get process by ID with movements
**Permission**: `processos.view`

### POST /api/processos
Create new process
**Permission**: `processos.create`
```json
{
  "numero_processo": "1234567-89.2024.1.23.0001",
  "titulo": "Process title",
  "descricao": "Process description",
  "autor": "Author name",
  "reu": "Defendant name",
  "status": "distribuido",
  "tipo_acao": "Action type",
  "valor_causa": 10000.00,
  "data_distribuicao": "2024-01-01",
  "vara": "1ª Vara",
  "comarca": "São Paulo",
  "cliente_id": 1
}
```

### PUT /api/processos/:id
Update process
**Permission**: `processos.update`

### DELETE /api/processos/:id
Delete process
**Permission**: `processos.delete`

---

## Movement Endpoints

### GET /api/movimentacoes
List movements by process (paginated)
**Permission**: `movimentacoes.view`

Query params:
- `processo_id` (required)
- `page`, `perPage`, `sortBy`, `sortOrder`

### POST /api/movimentacoes
Create new movement
**Permission**: `movimentacoes.create`
```json
{
  "processo_id": 1,
  "tipo": "Movement type",
  "descricao": "Movement description",
  "data_movimentacao": "2024-01-01"
}
```

### PUT /api/movimentacoes/:id
Update movement
**Permission**: `movimentacoes.update`

### DELETE /api/movimentacoes/:id
Delete movement
**Permission**: `movimentacoes.delete`

---

## Client Endpoints

### GET /api/clientes
List clients (paginated)
**Permission**: `clientes.view`

### GET /api/clientes/stats
Get client statistics
**Permission**: `clientes.view`

### GET /api/clientes/:id
Get client by ID
**Permission**: `clientes.view`

### POST /api/clientes
Create new client
**Permission**: `clientes.create`
```json
{
  "nome": "Client name",
  "cpf": "123.456.789-00",
  "email": "client@example.com",
  "whatsapp": "+5511999999999",
  "telefone_secundario": "+5511888888888",
  "endereco": "Client address",
  "observacoes": "Notes"
}
```

### PUT /api/clientes/:id
Update client
**Permission**: `clientes.update`

### DELETE /api/clientes/:id
Delete client
**Permission**: `clientes.delete`

---

## User Management Endpoints (Admin Only)

### GET /api/usuarios
List users (paginated)
**Permission**: Admin only

### GET /api/usuarios/:id
Get user by ID with permissions
**Permission**: Admin only

### POST /api/usuarios
Create new user
**Permission**: Admin only
```json
{
  "nome": "User name",
  "email": "user@example.com",
  "senha": "StrongPass123!",
  "perfil": "advogado",
  "ativo": true
}
```

### PUT /api/usuarios/:id
Update user (no password change)
**Permission**: Admin only

### DELETE /api/usuarios/:id
Delete user
**Permission**: Admin only

### PUT /api/usuarios/:id/activate
Activate user
**Permission**: Admin only

### PUT /api/usuarios/:id/deactivate
Deactivate user
**Permission**: Admin only

---

## Permission Management Endpoints (Admin Only)

### GET /api/permissoes
List all permissions (grouped by module)
**Permission**: Admin only

### GET /api/permissoes/usuario/:usuario_id
Get user permissions
**Permission**: Admin only

### PUT /api/permissoes/usuario/:usuario_id
Update user permissions
**Permission**: Admin only
```json
{
  "permissao_ids": [1, 2, 3, 4]
}
```

### POST /api/permissoes/usuario/:usuario_id/aplicar-perfil
Apply profile permissions
**Permission**: Admin only
```json
{
  "perfil": "advogado"
}
```

---

## Public Endpoints (No Authentication)

### GET /api/public/consultar-cpf
Search processes by client CPF
**Rate limit**: 10 requests / 15 minutes

Query params:
- `cpf` (required) - CPF with or without formatting

### GET /api/public/consultar-numero
Search process by number
**Rate limit**: 10 requests / 15 minutes

Query params:
- `numero` (required) - Process number (CNJ format)

---

## Audit Endpoints

### GET /api/auditoria
List audit records (paginated, with filters)
**Permission**: `auditoria.view`

Query params:
- `page`, `perPage`, `sortBy`, `sortOrder`
- `acao` (filter by action)
- `tela` (filter by screen)
- `usuario_email` (filter by user)
- `ip` (filter by IP)
- `status_http` (filter by HTTP status)
- `data_inicio`, `data_fim` (date range)

### GET /api/auditoria/stats
Get statistics for dashboards
**Permission**: `auditoria.view`

Query params:
- `dias` (default: 30, max: 365)

Returns:
- Records by day
- Records by action
- Records by status
- Records by user
- Records by screen

### GET /api/auditoria/sla
Get SLA metrics (last 30 days)
**Permission**: `auditoria.view`

Returns:
- Total requests
- Success/error counts
- Availability percentage
- Error rate
- Average requests per day
- Most common actions

### GET /api/auditoria/anomalias
Detect anomalies (last 7 days)
**Permission**: `auditoria.view`

Returns:
- Error spikes (>2x average)
- Failed login spikes (>3x average)
- IPs with many errors (>50)

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Permissions List

### Processos
- `processos.view` - View processes
- `processos.create` - Create processes
- `processos.update` - Update processes
- `processos.delete` - Delete processes

### Movimentações
- `movimentacoes.view` - View movements
- `movimentacoes.create` - Create movements
- `movimentacoes.update` - Update movements
- `movimentacoes.delete` - Delete movements

### Clientes
- `clientes.view` - View clients
- `clientes.create` - Create clients
- `clientes.update` - Update clients
- `clientes.delete` - Delete clients

### Usuários
- `usuarios.view` - View users
- `usuarios.manage` - Manage users (full CRUD)

### Admin
- `admin.backup` - Create backups
- `admin.restore` - Restore backups
- `admin.export` - Export data

### Auditoria
- `auditoria.view` - View audit trail

### Security
- `security.manage` - Manage security settings

### Public
- `public.consulta` - Public consultation

---

## Profile Default Permissions

### Admin Profile
- All permissions

### Advogado Profile
- `processos.view`
- `processos.create`
- `processos.update`
- `movimentacoes.view`
- `movimentacoes.create`
- `movimentacoes.update`
- `clientes.view`
- `clientes.create`
- `clientes.update`
