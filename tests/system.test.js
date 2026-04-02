const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app } = require('../src/server');
const { Database } = require('../src/database/init');

const TEST_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local';
const TEST_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const PASSWORD_ROUNDS = parseInt(process.env.PASSWORD_ROUNDS || '12', 10);

async function getCsrfToken(agent) {
  const response = await agent.get('/api/csrf-token');
  return response.body.csrfToken;
}

async function loginAgent() {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .set('Accept', 'application/json')
    .send({ email: TEST_ADMIN_EMAIL, senha: TEST_ADMIN_PASSWORD });
  return agent;
}

describe('Core system flows', () => {
  beforeEach(async () => {
    const db = new Database();
    await db.connect();
    const senhaHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, PASSWORD_ROUNDS);
    const senhaExpiraEm = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      `UPDATE usuarios
       SET senha_hash = ?, ativo = 1, forcar_troca_senha = 0, twofa_enabled = 0, twofa_secret = NULL, senha_expira_em = ?
       WHERE email = ?`,
      [senhaHash, senhaExpiraEm, TEST_ADMIN_EMAIL]
    );
    const admin = await db.get('SELECT id FROM usuarios WHERE email = ?', [TEST_ADMIN_EMAIL]);
    if (admin) {
      await db.run('DELETE FROM historico_senhas WHERE usuario_id = ?', [admin.id]);
      await db.run('INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)', [admin.id, senhaHash]);
    }
    await db.run('DELETE FROM anexos_temporarios_processo');
    await db.run('DELETE FROM anexos_processo');
    await db.run('DELETE FROM movimentacoes');
    await db.run('DELETE FROM processo_clientes');
    await db.run('DELETE FROM processos WHERE numero_processo LIKE ?', ['1234567-89.2024.8.26.%']);
    await db.run('DELETE FROM clientes WHERE nome LIKE ?', ['Cliente Teste%']);
    await db.run('DELETE FROM usuarios WHERE email LIKE ?', ['usuario.teste.%@example.com']);
    await db.run('DELETE FROM reset_tokens');
    await db.close();
  });

  it('creates cliente with CPF and CNPJ', async () => {
    const agent = await loginAgent();
    const csrfToken = await getCsrfToken(agent);
    const cpfResponse = await agent.post('/api/clientes').send({
      nome: 'Cliente Teste PF',
      tipo_documento: 'CPF',
      documento: '529.982.247-25'
    }).set('x-csrf-token', csrfToken).set('Accept', 'application/json');
    const csrfTokenCnpj = await getCsrfToken(agent);
    const cnpjResponse = await agent.post('/api/clientes').send({
      nome: 'Cliente Teste PJ',
      tipo_documento: 'CNPJ',
      documento: '04.252.011/0001-10'
    }).set('x-csrf-token', csrfTokenCnpj).set('Accept', 'application/json');

    expect(cpfResponse.status).toBe(201);
    expect(cpfResponse.body.data.tipo_documento).toBe('CPF');
    expect(cnpjResponse.status).toBe(201);
    expect(cnpjResponse.body.data.tipo_documento).toBe('CNPJ');
  });

  it('creates processo with multiple clientes and finalizes temporary attachment upload', async () => {
    const agent = await loginAgent();
    const csrfClientePf = await getCsrfToken(agent);
    const clientePf = await agent.post('/api/clientes').send({
      nome: 'Cliente Teste Processo',
      tipo_documento: 'CPF',
      documento: '52998224725'
    }).set('x-csrf-token', csrfClientePf).set('Accept', 'application/json');

    const csrfClientePj = await getCsrfToken(agent);
    const clientePj = await agent.post('/api/clientes').send({
      nome: 'Cliente Teste Processo PJ',
      tipo_documento: 'CNPJ',
      documento: '04252011000110'
    }).set('x-csrf-token', csrfClientePj).set('Accept', 'application/json');

    expect(clientePf.status).toBe(201);
    expect(clientePj.status).toBe(201);

    const csrfTempAnexo = await getCsrfToken(agent);
    const tempUpload = await agent
      .post('/api/processos/anexos-temporarios')
      .set('Accept', 'application/json')
      .set('x-csrf-token', csrfTempAnexo)
      .attach('arquivo', Buffer.from('%PDF-1.4 arquivo temporario'), {
        filename: 'contrato.pdf',
        contentType: 'application/pdf'
      });

    expect(tempUpload.status).toBe(201);
    expect(tempUpload.body.data.status).toBe('temporario');

    const csrfProcesso = await getCsrfToken(agent);
    const processo = await agent.post('/api/processos').send({
      numero_processo: '12345678920248260001',
      titulo: 'Processo Teste',
      autor: 'Autor Teste',
      reu: 'Reu Teste',
      status: 'em_andamento',
      cliente_documentos: [
        clientePf.body.data.documento,
        clientePj.body.data.documento
      ]
    }).set('x-csrf-token', csrfProcesso).set('Accept', 'application/json');

    expect(processo.status).toBe(201);
    expect(processo.body.data.clientes).toHaveLength(2);
    expect(processo.body.data.anexos_importados).toBe(1);

    const csrfAnexo = await getCsrfToken(agent);
    const upload = await agent
      .post(`/api/processos/${processo.body.data.id}/anexos`)
      .set('Accept', 'application/json')
      .set('x-csrf-token', csrfAnexo)
      .attach('arquivo', Buffer.from('%PDF-1.4 arquivo de teste'), {
        filename: 'comprovante.pdf',
        contentType: 'application/pdf'
      });

    expect(upload.status).toBe(201);
    expect(upload.body.data.nome_original).toBe('comprovante.pdf');

    const csrfAnexoWord = await getCsrfToken(agent);
    const uploadWord = await agent
      .post(`/api/processos/${processo.body.data.id}/anexos`)
      .set('Accept', 'application/json')
      .set('x-csrf-token', csrfAnexoWord)
      .attach('arquivo', Buffer.from('arquivo word de teste'), {
        filename: 'peticao.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

    expect(uploadWord.status).toBe(201);
    expect(uploadWord.body.data.nome_original).toBe('peticao.docx');

    const detalhes = await agent.get(`/api/processos/${processo.body.data.id}`);
    expect(detalhes.status).toBe(200);
    expect(detalhes.body.data.anexos.length).toBe(3);
    expect(detalhes.body.data.anexos[0].url).toMatch(/^\/uploads\//);
    expect(detalhes.body.data.processo.clientes).toHaveLength(2);
  });

  it('requests and uses password reset token', async () => {
    const response = await request(app).post('/api/auth/request-password-reset').send({
      email: TEST_ADMIN_EMAIL
    });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeDefined();

    const resetResponse = await request(app).post('/api/auth/reset-password').send({
      token: response.body.data.token,
      senhaNova: 'NovaSenha@1234',
      confirmarSenha: 'NovaSenha@1234'
    });

    expect(resetResponse.status).toBe(200);

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: TEST_ADMIN_EMAIL,
      senha: 'NovaSenha@1234'
    });

    expect(loginResponse.status).toBe(200);

    const db = new Database();
    await db.connect();
    const senhaHash = await db.get('SELECT senha_hash FROM usuarios WHERE email = ?', [TEST_ADMIN_EMAIL]);
    await db.close();
    expect(senhaHash).toBeDefined();
  });

  it('creates usuario with numeric password of 6 digits', async () => {
    const agent = await loginAgent();
    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post('/api/usuarios')
      .set('Accept', 'application/json')
      .set('x-csrf-token', csrfToken)
      .send({
        nome: 'Usuario Teste Numerico',
        email: 'usuario.teste.01@example.com',
        senha: '123456',
        perfil: 'advogado',
        ativo: true
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('usuario.teste.01@example.com');
  });

  it('updates admin name while keeping local login identifier', async () => {
    const agent = await loginAgent();
    const db = new Database();
    await db.connect();
    const admin = await db.get('SELECT id, nome, email FROM usuarios WHERE email = ?', [TEST_ADMIN_EMAIL]);
    await db.close();

    const csrfToken = await getCsrfToken(agent);
    const updatedName = 'Administrador Principal';
    const response = await agent
      .put(`/api/usuarios/${admin.id}`)
      .set('Accept', 'application/json')
      .set('x-csrf-token', csrfToken)
      .send({
        nome: updatedName,
        email: admin.email,
        perfil: 'admin',
        ativo: true
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.nome).toBe(updatedName);
    expect(response.body.data.email).toBe(TEST_ADMIN_EMAIL);
  });
});
