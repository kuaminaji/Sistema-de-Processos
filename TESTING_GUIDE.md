# Frontend Integration & Testing Guide

## 🚀 Quick Start

### Prerequisites
- Node.js backend running on `http://localhost:3000`
- Database configured and seeded
- Backend API endpoints available

### Starting the Frontend

#### Option 1: Using Node.js http-server (Recommended)
```bash
# Install http-server globally (if not already installed)
npm install -g http-server

# Navigate to project root
cd /home/runner/work/Sistema-de-Processos/Sistema-de-Processos

# Start the frontend server
http-server public -p 8080 --proxy http://localhost:3000

# Access at: http://localhost:8080
```

#### Option 2: Using Python http.server
```bash
cd public
python3 -m http.server 8080

# Access at: http://localhost:8080
```

#### Option 3: Using PHP built-in server
```bash
cd public
php -S localhost:8080

# Access at: http://localhost:8080
```

## 🧪 Testing Checklist

### 1. Public Access Tests
- [ ] Visit http://localhost:8080 → Should show options
- [ ] Click "Consulta Pública" → Should load consulta.html
- [ ] Test CPF consultation:
  - [ ] Enter valid CPF (e.g., 123.456.789-00)
  - [ ] Should show client processes
- [ ] Test Process Number consultation:
  - [ ] Enter process number
  - [ ] Should show process details

### 2. Authentication Tests
- [ ] Visit http://localhost:8080/login.html
- [ ] Try login with invalid credentials → Should show error
- [ ] Try login with valid credentials → Should redirect to admin
- [ ] If 2FA enabled:
  - [ ] Should show 2FA input field
  - [ ] Enter 2FA code → Should complete login

### 3. Admin Dashboard Tests
- [ ] After login, should see dashboard with:
  - [ ] Statistics cards (total, active, archived, suspended)
  - [ ] Chart showing processes by status
  - [ ] Recent activity list
  - [ ] Quick action buttons

### 4. Processos Management Tests
- [ ] Click "Processos" in sidebar
- [ ] Should load processes table
- [ ] Test search functionality
- [ ] Test status filter
- [ ] Click "+ Novo Processo":
  - [ ] Should open modal with form
  - [ ] Fill and submit → Should create process
- [ ] Click edit button (✏️) on a process:
  - [ ] Should open modal with filled form
  - [ ] Edit and submit → Should update process
- [ ] Click view button (👁️):
  - [ ] Should show process details in modal
- [ ] Click delete button (🗑️):
  - [ ] Should ask for confirmation
  - [ ] Confirm → Should delete process

### 5. Clientes Management Tests
- [ ] Click "Clientes" in sidebar
- [ ] Should load clients table
- [ ] Test search functionality (name/CPF)
- [ ] Click "+ Novo Cliente":
  - [ ] Should open modal with form
  - [ ] Test CPF auto-formatting
  - [ ] Test CPF validation
  - [ ] Fill and submit → Should create client
- [ ] Test edit, view, and delete operations

### 6. Usuários Management Tests (Admin only)
- [ ] Click "Usuários" in sidebar
- [ ] Should load users table
- [ ] Click "+ Novo Usuário":
  - [ ] Fill form with name, email, password, role
  - [ ] Submit → Should create user
- [ ] Test edit user
- [ ] Test toggle status (⚡) → Should activate/deactivate
- [ ] Test delete user

### 7. Permissões Tests (Admin only)
- [ ] Click "Permissões" in sidebar
- [ ] Select a user from dropdown
- [ ] Should load user's current permissions
- [ ] Check/uncheck permissions
- [ ] Click "Salvar Permissões" → Should update

### 8. Auditoria Tests (Admin only)
- [ ] Click "Auditoria" in sidebar
- [ ] Should load audit logs table
- [ ] Test date filters
- [ ] Test user filter
- [ ] Click export buttons (CSV/Excel)

### 9. Export & Backup Tests
- [ ] From dashboard, click "Exportar PDF"
- [ ] Click "Exportar Excel"
- [ ] Click "Exportar CSV"
- [ ] Click "Backup do Sistema"
- [ ] Each should download corresponding file

### 10. Password Change Tests
- [ ] Click user menu (top right)
- [ ] Click "Trocar Senha"
- [ ] Enter current password
- [ ] Enter new password:
  - [ ] Should show strength indicator
  - [ ] Test weak password → Red indicator
  - [ ] Test medium password → Yellow indicator
  - [ ] Test strong password → Green indicator
- [ ] Confirm new password:
  - [ ] Should validate match
- [ ] Submit → Should change password

### 11. 2FA Tests
- [ ] Click user menu → "Configurar 2FA"
- [ ] If not enabled:
  - [ ] Should show QR code
  - [ ] Should show manual code
  - [ ] Scan with authenticator app
  - [ ] Enter verification code
  - [ ] Click "Ativar 2FA" → Should enable
- [ ] If enabled:
  - [ ] Should show disable form
  - [ ] Enter current code
  - [ ] Click "Desativar 2FA" → Should disable

### 12. Responsive Tests
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] Sidebar should collapse on mobile
- [ ] Forms should stack on mobile
- [ ] Tables should scroll horizontally on mobile

### 13. Logout Test
- [ ] Click user menu → "Sair"
- [ ] Should logout and redirect to login page
- [ ] Try accessing /admin.html directly
- [ ] Should redirect to login page

## 🐛 Common Issues & Solutions

### Issue: CORS Error
**Symptom:** Console shows CORS error
**Solution:** 
- Ensure backend has CORS enabled
- Check backend allows credentials
- Verify origin is allowed

### Issue: 401 Unauthorized on all requests
**Symptom:** Redirects to login immediately
**Solution:**
- Check cookies are enabled
- Verify backend session configuration
- Check CSRF token is being sent

### Issue: CSRF Token Error
**Symptom:** POST/PUT/DELETE fail with CSRF error
**Solution:**
- Ensure /api/auth/csrf-token endpoint exists
- Check token is being included in headers
- Verify backend CSRF validation

### Issue: Styles not loading
**Symptom:** Unstyled page
**Solution:**
- Check styles.css path is correct
- Verify file was created properly
- Check browser console for 404 errors

### Issue: JavaScript errors
**Symptom:** Functions not working
**Solution:**
- Open browser console (F12)
- Check for JavaScript errors
- Verify all .js files are loaded
- Check for typos in function calls

## 📊 API Endpoints Used

### Authentication
- GET `/api/auth/csrf-token` - Get CSRF token
- GET `/api/auth/me` - Get current user
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout
- POST `/api/auth/trocar-senha` - Change password
- POST `/api/auth/2fa/setup` - Setup 2FA
- POST `/api/auth/2fa/enable` - Enable 2FA
- POST `/api/auth/2fa/disable` - Disable 2FA

### Processos
- GET `/api/processos/list` - List all
- GET `/api/processos/stats` - Get statistics
- GET `/api/processos/:id` - Get one
- POST `/api/processos/create` - Create
- PUT `/api/processos/:id` - Update
- DELETE `/api/processos/:id` - Delete

### Clientes
- GET `/api/clientes/list` - List all
- GET `/api/clientes/:id` - Get one
- POST `/api/clientes/create` - Create
- PUT `/api/clientes/:id` - Update
- DELETE `/api/clientes/:id` - Delete

### Usuários
- GET `/api/usuarios/list` - List all
- GET `/api/usuarios/:id` - Get one
- POST `/api/usuarios/create` - Create
- PUT `/api/usuarios/:id` - Update
- DELETE `/api/usuarios/:id` - Delete

### Permissões
- GET `/api/permissoes/list` - List all permissions
- GET `/api/permissoes/getUserPermissions/:userId` - Get user permissions
- POST `/api/permissoes/updateUserPermissions` - Update permissions

### Auditoria
- GET `/api/auditoria/list` - List audit logs

### Public
- GET `/api/public/consultarPorCPF/:cpf` - Consult by CPF
- GET `/api/public/consultarPorNumero/:numero` - Consult by number

### Export
- GET `/api/export/processos/csv` - Export processes CSV
- GET `/api/export/processos/excel` - Export processes Excel
- GET `/api/export/processos/pdf` - Export processes PDF
- GET `/api/export/auditoria/csv` - Export audit CSV
- GET `/api/export/auditoria/excel` - Export audit Excel

### Backup
- POST `/api/backup/backup` - Create backup
- POST `/api/backup/restore` - Restore from backup

## 🔍 Browser DevTools Tips

### Network Tab
- Monitor all API requests
- Check request/response headers
- Verify CSRF token is sent
- Check status codes

### Console Tab
- Watch for JavaScript errors
- Check API responses
- Test functions manually

### Application Tab
- View cookies
- Check localStorage
- Inspect session data

## ✅ Success Criteria

The frontend is working correctly when:
1. ✅ All pages load without errors
2. ✅ Login flow works (with/without 2FA)
3. ✅ Dashboard shows statistics
4. ✅ CRUD operations work for all entities
5. ✅ Search and filters work
6. ✅ Export functions download files
7. ✅ Public consultation works without login
8. ✅ Responsive design works on all devices
9. ✅ No console errors
10. ✅ All toast notifications appear correctly

## 📝 Notes

- **First Login**: Use credentials from database seed
- **Admin User**: Has all permissions by default
- **Test Data**: Create test data for better testing
- **Browser**: Use Chrome/Firefox for best compatibility
- **Cache**: Hard refresh (Ctrl+Shift+R) if seeing old data

## 🎓 For Developers

### Adding New Features
1. Add HTML structure to appropriate section
2. Create JavaScript function in admin.js
3. Update navigation if needed
4. Test thoroughly
5. Update documentation

### Debugging Tips
1. Use `console.log()` liberally
2. Check Network tab for API issues
3. Verify CSRF token in headers
4. Test with browser console
5. Use breakpoints in DevTools

---

**Happy Testing! 🚀**
