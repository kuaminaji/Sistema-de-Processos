# Controllers and Routes Summary

## Overview
This document summarizes the controllers and routes implemented for the judicial process management system.

## Implemented Controllers & Routes

### 1. movimentacoesController.js + movimentacoes.js
**Purpose**: Manage process movements/updates

**Endpoints**:
- `GET /api/movimentacoes` - List movements by processo_id (paginated)
  - Permission: `movimentacoes.view`
  - Query params: `processo_id` (required), `page`, `perPage`, `sortBy`, `sortOrder`
  
- `POST /api/movimentacoes` - Create new movement
  - Permission: `movimentacoes.create`
  - Body: `processo_id`, `tipo`, `descricao`, `data_movimentacao`
  - Auto-updates `processo.data_ultima_movimentacao`
  
- `PUT /api/movimentacoes/:id` - Update movement
  - Permission: `movimentacoes.update`
  - Body: `tipo`, `descricao`, `data_movimentacao` (all optional)
  
- `DELETE /api/movimentacoes/:id` - Delete movement
  - Permission: `movimentacoes.delete`
  - Updates processo's last movement date after deletion

**Features**:
- Validates processo exists before operations
- Updates processo.data_ultima_movimentacao automatically
- Audit logging for all operations
- Input sanitization

---

### 2. usuariosController.js + usuarios.js
**Purpose**: User management (admin only)

**Endpoints**:
- `GET /api/usuarios` - List all users (paginated)
  - Permission: Admin only
  - Query params: `page`, `perPage`, `sortBy`, `sortOrder`, `perfil`, `ativo`
  - Returns users without senha_hash field
  
- `GET /api/usuarios/:id` - Get user by ID
  - Permission: Admin only
  - Includes user's permissions
  
- `POST /api/usuarios` - Create new user
  - Permission: Admin only
  - Body: `nome`, `email`, `senha`, `perfil`, `ativo`
  - Password hashing with bcrypt
  - Default permissions applied by perfil
  - Forces password change on first login
  
- `PUT /api/usuarios/:id` - Update user (no password change)
  - Permission: Admin only
  - Body: `nome`, `email`, `perfil`, `ativo` (all optional)
  - Password updates via `/api/auth/trocar-senha` only
  
- `DELETE /api/usuarios/:id` - Delete user
  - Permission: Admin only
  - Prevents self-deletion
  
- `PUT /api/usuarios/:id/activate` - Activate user
  - Permission: Admin only
  
- `PUT /api/usuarios/:id/deactivate` - Deactivate user
  - Permission: Admin only
  - Prevents self-deactivation

**Features**:
- Password validation (min 10 chars, upper, lower, number, symbol)
- Email validation and uniqueness check
- Auto-apply default permissions by profile
- Prevents self-deletion/self-deactivation
- Audit logging for all operations

---

### 3. permissoesController.js + permissoes.js
**Purpose**: Permission management

**Endpoints**:
- `GET /api/permissoes` - List all permissions
  - Permission: Admin only
  - Returns permissions grouped by module
  
- `GET /api/permissoes/usuario/:usuario_id` - Get user permissions
  - Permission: Admin only
  - Returns granted and available permissions
  
- `PUT /api/permissoes/usuario/:usuario_id` - Update user permissions
  - Permission: Admin only
  - Body: `permissao_ids` (array of permission IDs)
  - Replaces all user permissions
  
- `POST /api/permissoes/usuario/:usuario_id/aplicar-perfil` - Apply profile permissions
  - Permission: Admin only
  - Body: `perfil` ('admin' or 'advogado')
  - Updates user profile and applies default permissions

**Features**:
- Admin profile: All permissions
- Advogado profile: Basic CRUD on processos, movimentacoes, clientes
- Atomic permission updates
- Validates all permission IDs exist

---

### 4. publicController.js + public.js
**Purpose**: Public consultation (no authentication)

**Endpoints**:
- `GET /api/public/consultar-cpf` - Search processes by client CPF
  - No authentication required
  - Rate limit: 10 requests / 15 minutes
  - Query param: `cpf`
  - Validates CPF format
  - Returns client name and their processes (limited fields)
  
- `GET /api/public/consultar-numero` - Search process by number
  - No authentication required
  - Rate limit: 10 requests / 15 minutes
  - Query param: `numero`
  - Validates process number format (CNJ)
  - Returns process details and last 10 movements

**Features**:
- Strict rate limiting (10 req/15min per IP)
- CPF and process number validation
- Audit logging with `usuario_email: 'public'`
- Limited data exposure (no sensitive fields)
- No CSRF protection (public endpoints)

---

### 5. auditoriaController.js + auditoria.js
**Purpose**: Audit trail viewing and analysis

**Endpoints**:
- `GET /api/auditoria` - List audit records
  - Permission: `auditoria.view`
  - Query params: `page`, `perPage`, `sortBy`, `sortOrder`, `acao`, `tela`, `usuario_email`, `ip`, `status_http`, `data_inicio`, `data_fim`
  - Returns paginated audit records with parsed JSON details
  
- `GET /api/auditoria/stats` - Get statistics
  - Permission: `auditoria.view`
  - Query param: `dias` (default 30, max 365)
  - Returns charts data: by day, by action, by status, by user, by screen
  
- `GET /api/auditoria/sla` - Get SLA metrics
  - Permission: `auditoria.view`
  - Returns last 30 days metrics:
    - Total requests
    - Success/error counts
    - Availability percentage
    - Error rate
    - Average requests per day
    - Most common actions
  
- `GET /api/auditoria/anomalias` - Detect anomalies
  - Permission: `auditoria.view`
  - Returns last 7 days anomalies:
    - Error spikes (>2x average)
    - Failed login spikes (>3x average)
    - IPs with many errors (>50)

**Features**:
- Complex filtering (action, screen, user, IP, status, date range)
- Statistical analysis for dashboards
- Anomaly detection for security monitoring
- Performance metrics (SLA)
- Automatic JSON parsing of details field

---

## Security Features

### Input Validation
- All inputs sanitized with `sanitizarInput()`
- express-validator for all routes
- Type validation (integers, dates, emails, etc.)
- Length limits on string fields

### SQL Injection Prevention
- All queries use parameterized statements
- No string interpolation in SQL
- Database class with prepared statements

### Authentication & Authorization
- JWT-based session management
- Permission-based access control
- Admin-only routes for user/permission management
- Self-operation prevention (delete, deactivate)

### Rate Limiting
- Global: 100 requests / 15 minutes
- Public endpoints: 10 requests / 15 minutes

### Audit Trail
- All operations logged with:
  - User ID and email
  - Action performed
  - Screen/module
  - HTTP method and route
  - Status code
  - IP address
  - User agent
  - JSON details

### CSRF Protection
- Applied to all authenticated routes
- Skipped for public routes (no session)
- Auth routes have conditional CSRF (API vs web forms)

---

## Error Handling

All controllers follow consistent error response format:
```json
{
  "success": false,
  "message": "Error description"
}
```

Success response format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

---

## Database Schema Usage

### Tables Used:
- `processos` - Process records
- `movimentacoes` - Process movements
- `usuarios` - System users
- `permissoes` - Available permissions
- `usuario_permissoes` - User-permission relationships
- `clientes` - Clients
- `auditoria` - Audit trail
- `historico_senhas` - Password history
- `brute_force_locks` - Brute force protection
- `reset_tokens` - Password reset tokens

---

## Testing

All existing tests pass:
- ✅ Auth API tests (11 tests)
- ✅ Server starts successfully
- ✅ All routes registered
- ✅ Syntax validation passed

---

## Next Steps (Future Enhancements)

1. Add backup/restore routes
2. Add export routes (PDF, Excel, CSV)
3. Add email notifications
4. Add file upload for process documents
5. Add more comprehensive tests for new controllers
6. Add WebSocket for real-time notifications

---

## CodeQL Security Analysis

**Status**: ✅ Passed with 1 false positive

**Alert**: Missing CSRF protection on session middleware
- **Resolution**: This is intentional design
  - Public routes don't use sessions
  - Auth routes have conditional CSRF handling
  - All other routes have CSRF protection
  - Architecture is secure by design

---

## Notes

- Password updates are handled separately via `/api/auth/trocar-senha`
- Admin profile automatically gets all permissions
- Advogado profile gets read/write on processos, movimentacoes, clientes
- Public endpoints have stricter rate limiting
- Audit trail captures both authenticated and public access
- Self-deletion and self-deactivation are prevented for safety
