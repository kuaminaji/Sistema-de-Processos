const request = require('supertest');
const app = require('../src/server');
const { Database } = require('../src/database/init');

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
      await db.run('DELETE FROM brute_force_locks');
      // Reset password change flag for testing
      await db.run("UPDATE usuarios SET forcar_troca_senha = 0 WHERE email = 'admin@local'");
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
      expect(response.body.message).toContain('obrigatórios');
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
      expect(response.body.message).toContain('Credenciais inválidas');
    });
    
    it('should login successfully with valid credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@local',
          senha: 'admin123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usuario).toBeDefined();
      expect(response.body.data.usuario.email).toBe('admin@local');
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
          email: 'admin@local',
          senha: 'admin123'
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
          email: 'admin@local',
          senha: 'admin123'
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
          senhaAtual: 'admin123',
          senhaNova: 'weak',
          confirmarSenha: 'weak'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('caracteres');
    });
    
    it('should fail when passwords do not match', async () => {
      const response = await agent
        .post('/api/auth/trocar-senha')
        .set('Accept', 'application/json')
        .send({
          senhaAtual: 'admin123',
          senhaNova: 'NewP@ssw0rd123!',
          confirmarSenha: 'DifferentP@ssw0rd!'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('não coincidem');
    });
  });
  
  describe('GET /api/auth/setup-2fa', () => {
    beforeEach(async () => {
      await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: 'admin@local',
          senha: 'admin123'
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
          email: 'admin@local',
          senha: 'admin123'
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
