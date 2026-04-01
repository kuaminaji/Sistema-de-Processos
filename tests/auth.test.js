const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app } = require('../src/server');
const { Database } = require('../src/database/init');

// Test constants
const TEST_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local';
const TEST_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const PASSWORD_ROUNDS = parseInt(process.env.PASSWORD_ROUNDS || '12', 10);

describe('Auth API', () => {
  let agent;
  
  beforeAll(() => {
    agent = request.agent(app);
  });
  
  beforeEach(async () => {
    // Clear brute force locks before each test
    const db = new Database();
    try {
      await db.connect();
      const senhaHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, PASSWORD_ROUNDS);
      const senhaExpiraEm = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        `UPDATE usuarios
         SET senha_hash = ?, forcar_troca_senha = 0, ativo = 1, twofa_enabled = 0, twofa_secret = NULL, senha_expira_em = ?
         WHERE email = ?`,
        [senhaHash, senhaExpiraEm, TEST_ADMIN_EMAIL]
      );
      const admin = await db.get('SELECT id FROM usuarios WHERE email = ?', [TEST_ADMIN_EMAIL]);
      if (admin) {
        await db.run('DELETE FROM historico_senhas WHERE usuario_id = ?', [admin.id]);
        await db.run('INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)', [admin.id, senhaHash]);
      }
      await db.run('DELETE FROM brute_force_locks');
      // Reset password change flag for testing
      await db.run('UPDATE usuarios SET forcar_troca_senha = 0 WHERE email = ?', [TEST_ADMIN_EMAIL]);
      await db.close();
    } catch (error) {
      console.error('Error clearing brute force locks:', error);
    }
  });
  
  describe('POST /api/auth/login', () => {
    it('should fail with missing credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/obrigat/i);
    });
    
    it('should fail with invalid credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'invalid@test.com',
          senha: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/credenciais/i);
    });
    
    it('should login successfully with valid credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_ADMIN_EMAIL,
          senha: TEST_ADMIN_PASSWORD
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usuario).toBeDefined();
      expect(response.body.data.usuario.email).toBe(TEST_ADMIN_EMAIL);
      expect(response.body.data.permissoes).toBeDefined();
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should return user info when authenticated', async () => {
      // Login first
      await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: TEST_ADMIN_EMAIL,
          senha: TEST_ADMIN_PASSWORD
        });
      
      const response = await agent
        .get('/api/auth/me')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usuario).toBeDefined();
      expect(response.body.data.permissoes).toBeDefined();
    });
  });
  
  describe('POST /api/auth/trocar-senha', () => {
    beforeEach(async () => {
      // Login before each password change test
      await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: TEST_ADMIN_EMAIL,
          senha: TEST_ADMIN_PASSWORD
        });
    });
    
    it('should fail with missing fields', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should fail with incorrect current password', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({
          senhaAtual: 'wrongpassword',
          senhaNova: 'NewP@ssw0rd123!',
          confirmarSenha: 'NewP@ssw0rd123!'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should fail with weak new password', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({
          senhaAtual: TEST_ADMIN_PASSWORD,
          senhaNova: 'weak',
          confirmarSenha: 'weak'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('caracteres');
    });

    it('should allow numeric password with 6 digits', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({
          senhaAtual: TEST_ADMIN_PASSWORD,
          senhaNova: '123456',
          confirmarSenha: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should fail when passwords do not match', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({
          senhaAtual: TEST_ADMIN_PASSWORD,
          senhaNova: 'NewP@ssw0rd123!',
          confirmarSenha: 'DifferentP@ssw0rd!'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/coincidem/i);
    });
  });
  
  describe('GET /api/auth/setup-2fa', () => {
    beforeEach(async () => {
      await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: TEST_ADMIN_EMAIL,
          senha: TEST_ADMIN_PASSWORD
        });
    });
    
    it('should generate 2FA setup with QR code', async () => {
      const response = await agent
        .get('/api/auth/setup-2fa')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });
  
  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Login first
      await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: TEST_ADMIN_EMAIL,
          senha: TEST_ADMIN_PASSWORD
        });
      
      const response = await agent
        .post('/api/auth/logout')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout');
    });
  });
});


