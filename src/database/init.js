const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('./db');
const { getUploadBaseDir, getBrandingBaseDir } = require('../utils/storagePaths');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'advogado', 'secretaria', 'gestor')),
  ativo INTEGER DEFAULT 1,
  twofa_secret TEXT,
  twofa_enabled INTEGER DEFAULT 0,
  forcar_troca_senha INTEGER DEFAULT 0,
  senha_expira_em TEXT,
  ultimo_login_em TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil);

CREATE TABLE IF NOT EXISTS historico_senhas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  senha_hash TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historico_senhas_usuario ON historico_senhas(usuario_id);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'CPF' CHECK(tipo_documento IN ('CPF', 'CNPJ')),
  email TEXT,
  whatsapp TEXT,
  telefone_secundario TEXT,
  endereco TEXT,
  observacoes TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_documento ON clientes(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

CREATE TABLE IF NOT EXISTS processos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_processo TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  autor TEXT NOT NULL,
  reu TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado')),
  tipo_acao TEXT,
  valor_causa REAL,
  data_distribuicao TEXT,
  data_ultima_movimentacao TEXT,
  prazo_final TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK(prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  vara TEXT,
  comarca TEXT,
  advogado_autor TEXT,
  advogado_reu TEXT,
  observacoes TEXT,
  cliente_id INTEGER,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos(numero_processo);
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_autor ON processos(autor);
CREATE INDEX IF NOT EXISTS idx_processos_reu ON processos(reu);
CREATE INDEX IF NOT EXISTS idx_processos_cliente ON processos(cliente_id);

CREATE TABLE IF NOT EXISTS processo_clientes (
  processo_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (processo_id, cliente_id),
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processo_clientes_processo ON processo_clientes(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_clientes_cliente ON processo_clientes(cliente_id);

CREATE TABLE IF NOT EXISTS anexos_processo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL,
  nome_original TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL UNIQUE,
  caminho_relativo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  criado_por_usuario_id INTEGER,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_anexos_processo ON anexos_processo(processo_id);

CREATE TABLE IF NOT EXISTS anexos_temporarios_processo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL UNIQUE,
  caminho_relativo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  criado_por_usuario_id INTEGER,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_anexos_temp_sessao ON anexos_temporarios_processo(sessao_id);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_movimentacao TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo ON movimentacoes(processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(processo_id, data_movimentacao);

CREATE TABLE IF NOT EXISTS permissoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  modulo TEXT NOT NULL,
  descricao TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permissoes_codigo ON permissoes(codigo);
CREATE INDEX IF NOT EXISTS idx_permissoes_modulo ON permissoes(modulo);

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  usuario_id INTEGER NOT NULL,
  permissao_id INTEGER NOT NULL,
  concedido INTEGER DEFAULT 1,
  PRIMARY KEY (usuario_id, permissao_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (permissao_id) REFERENCES permissoes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  usuario_email TEXT,
  acao TEXT NOT NULL,
  tela TEXT,
  metodo TEXT,
  rota TEXT,
  status_http INTEGER,
  ip TEXT,
  user_agent TEXT,
  detalhes_json TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_email ON auditoria(usuario_email);
CREATE INDEX IF NOT EXISTS idx_auditoria_status_http ON auditoria(status_http);
CREATE INDEX IF NOT EXISTS idx_auditoria_ip ON auditoria(ip);

CREATE TABLE IF NOT EXISTS brute_force_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave_tipo TEXT NOT NULL,
  chave_valor TEXT NOT NULL,
  tentativas INTEGER DEFAULT 0,
  bloqueado_ate TEXT,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chave_tipo, chave_valor)
);

CREATE INDEX IF NOT EXISTS idx_brute_force_chave ON brute_force_locks(chave_tipo, chave_valor);

CREATE TABLE IF NOT EXISTS reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  usado_em TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_usuario ON reset_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON reset_tokens(token_hash);
`;

const DEFAULT_PERMISSIONS = [
  { codigo: 'processos.view', modulo: 'processos', descricao: 'Visualizar processos' },
  { codigo: 'processos.create', modulo: 'processos', descricao: 'Criar processos' },
  { codigo: 'processos.update', modulo: 'processos', descricao: 'Editar processos' },
  { codigo: 'processos.delete', modulo: 'processos', descricao: 'Excluir processos' },
  { codigo: 'movimentacoes.view', modulo: 'movimentacoes', descricao: 'Visualizar movimentacoes' },
  { codigo: 'movimentacoes.create', modulo: 'movimentacoes', descricao: 'Criar movimentacoes' },
  { codigo: 'movimentacoes.update', modulo: 'movimentacoes', descricao: 'Editar movimentacoes' },
  { codigo: 'movimentacoes.delete', modulo: 'movimentacoes', descricao: 'Excluir movimentacoes' },
  { codigo: 'clientes.view', modulo: 'clientes', descricao: 'Visualizar clientes' },
  { codigo: 'clientes.create', modulo: 'clientes', descricao: 'Criar clientes' },
  { codigo: 'clientes.update', modulo: 'clientes', descricao: 'Editar clientes' },
  { codigo: 'clientes.delete', modulo: 'clientes', descricao: 'Excluir clientes' },
  { codigo: 'usuarios.view', modulo: 'usuarios', descricao: 'Visualizar usuarios' },
  { codigo: 'usuarios.manage', modulo: 'usuarios', descricao: 'Gerenciar usuarios' },
  { codigo: 'dashboard.view_financeiro', modulo: 'dashboard', descricao: 'Visualizar cards financeiros do painel' },
  { codigo: 'dashboard.view_sla', modulo: 'dashboard', descricao: 'Visualizar indicadores de SLA e anomalias' },
  { codigo: 'admin.backup', modulo: 'admin', descricao: 'Realizar backup do sistema' },
  { codigo: 'admin.restore', modulo: 'admin', descricao: 'Restaurar backup do sistema' },
  { codigo: 'admin.export', modulo: 'admin', descricao: 'Exportar dados' },
  { codigo: 'auditoria.view', modulo: 'auditoria', descricao: 'Visualizar trilha de auditoria' },
  { codigo: 'security.manage', modulo: 'security', descricao: 'Gerenciar configuracoes de seguranca' },
  { codigo: 'public.consulta', modulo: 'public', descricao: 'Consultar processos na area publica' }
];

async function ensureColumns(db) {
  async function addColumnIfMissing(sql) {
    try {
      await db.run(sql);
    } catch (error) {
      if (!(error?.code === 'SQLITE_ERROR' && String(error.message).includes('duplicate column name'))) {
        throw error;
      }
    }
  }

  const clienteColumns = await db.all(`PRAGMA table_info(clientes)`);
  const clienteColumnNames = clienteColumns.map((column) => column.name);
  const processoColumns = await db.all(`PRAGMA table_info(processos)`);
  const processoColumnNames = processoColumns.map((column) => column.name);

  if (!clienteColumnNames.includes('tipo_documento')) {
    await addColumnIfMissing(`ALTER TABLE clientes ADD COLUMN tipo_documento TEXT NOT NULL DEFAULT 'CPF'`);
  }

  if (!processoColumnNames.includes('prazo_final')) {
    await addColumnIfMissing(`ALTER TABLE processos ADD COLUMN prazo_final TEXT`);
  }

  if (!processoColumnNames.includes('prioridade')) {
    await addColumnIfMissing(`ALTER TABLE processos ADD COLUMN prioridade TEXT NOT NULL DEFAULT 'media'`);
  }

  await db.run(
    `UPDATE processos
     SET prioridade = 'media'
     WHERE prioridade IS NULL OR prioridade = ''`
  );

  await db.run(
    `UPDATE clientes
     SET tipo_documento = CASE
       WHEN LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '')) = 14 THEN 'CNPJ'
       ELSE 'CPF'
     END
     WHERE tipo_documento IS NULL OR tipo_documento = ''`
  );

  await db.run(
    `INSERT OR IGNORE INTO processo_clientes (processo_id, cliente_id)
     SELECT id, cliente_id
     FROM processos
     WHERE cliente_id IS NOT NULL`
  );

  const usuariosTable = await db.get(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'`);
  if (usuariosTable?.sql && !usuariosTable.sql.includes("'secretaria'")) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios_migracao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'advogado', 'secretaria', 'gestor')),
        ativo INTEGER DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER DEFAULT 0,
        forcar_troca_senha INTEGER DEFAULT 0,
        senha_expira_em TEXT,
        ultimo_login_em TEXT,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO usuarios_migracao (
        id, nome, email, senha_hash, perfil, ativo, twofa_secret, twofa_enabled,
        forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
      )
      SELECT
        id, nome, email, senha_hash, perfil, ativo, twofa_secret, twofa_enabled,
        forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
      FROM usuarios;

      DROP TABLE usuarios;
      ALTER TABLE usuarios_migracao RENAME TO usuarios;
      CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
      CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil);
    `);
  }
}

async function ensurePermissions(db) {
  for (const permissao of DEFAULT_PERMISSIONS) {
    await db.run(
      'INSERT OR IGNORE INTO permissoes (codigo, modulo, descricao) VALUES (?, ?, ?)',
      [permissao.codigo, permissao.modulo, permissao.descricao]
    );
  }
}

function gerarSenhaTemporaria() {
  return `Adm!${crypto.randomBytes(6).toString('base64url')}9`;
}

function getBundledBrandingAsset(filename) {
  return path.resolve(__dirname, '../../public/assets/branding', filename);
}

function seedFileIfMissing(targetPath, sourcePath) {
  if (fs.existsSync(targetPath) || !fs.existsSync(sourcePath)) {
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function seedBrandingInstructions(brandingDir) {
  const instructionsPath = path.join(brandingDir, 'COMO_TROCAR_LOGOS.txt');
  if (fs.existsSync(instructionsPath)) {
    return;
  }

  fs.writeFileSync(
    instructionsPath,
    [
      'Personalizacao de marca do Sistema de Processos',
      '',
      '1. Substitua company-logo.png pela logo oficial da empresa, se desejar.',
      '2. Substitua lawyer-logo.png pela logo final da advogada.',
      '3. Mantenha os mesmos nomes de arquivo para o sistema atualizar automaticamente.',
      '',
      'Arquivos esperados nesta pasta:',
      '- company-logo.png',
      '- company-mark.png',
      '- lawyer-logo.png'
    ].join('\r\n'),
    'utf8'
  );
}

async function bootstrapAdmin(db) {
  const bcrypt = require('bcryptjs');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const passwordRounds = parseInt(process.env.PASSWORD_ROUNDS || '12', 10);
  const isDesktopApp = process.env.DESKTOP_APP === 'true';

  const existingAdmin = await db.get(
    'SELECT id, senha_hash, ultimo_login_em, ativo FROM usuarios WHERE email = ?',
    [adminEmail]
  );
  const shouldUsePredictablePassword =
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV !== 'production' ||
    isDesktopApp;
  const senhaInicial = process.env.ADMIN_PASSWORD || (shouldUsePredictablePassword ?adminPassword : gerarSenhaTemporaria());
  const passwordExpiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10);

  if (existingAdmin) {
    const shouldRepairDesktopBootstrap = isDesktopApp && !existingAdmin.ultimo_login_em;

    if (process.env.NODE_ENV === 'test' || shouldRepairDesktopBootstrap) {
      const senhaHash = await bcrypt.hash(senhaInicial, passwordRounds);
      const senhaExpiraEm = new Date();
      senhaExpiraEm.setDate(senhaExpiraEm.getDate() + passwordExpiryDays);

      await db.run(
        `UPDATE usuarios
         SET senha_hash = ?,
             forcar_troca_senha = 0,
             senha_expira_em = ?,
             ativo = 1,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE email = ?`,
        [senhaHash, senhaExpiraEm.toISOString(), adminEmail]
      );
    }

    if (process.env.NODE_ENV === 'test') {
      return;
    }
    return;
  }

  const senhaHash = await bcrypt.hash(senhaInicial || adminPassword, passwordRounds);
  const senhaExpiraEm = new Date();
  senhaExpiraEm.setDate(senhaExpiraEm.getDate() + passwordExpiryDays);
  const forcePasswordChange = isDesktopApp ?0 : 1;

  const result = await db.run(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, forcar_troca_senha, senha_expira_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Administrador', adminEmail, senhaHash, 'admin', 1, forcePasswordChange, senhaExpiraEm.toISOString()]
  );

  const adminId = result.lastID;
  const permissoes = await db.all('SELECT id FROM permissoes');
  for (const permissao of permissoes) {
    await db.run(
      'INSERT OR IGNORE INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
      [adminId, permissao.id, 1]
    );
  }

  await db.run(
    'INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)',
    [adminId, senhaHash]
  );

  console.log(`Admin bootstrap criado: ${adminEmail}`);
  console.log(`Senha inicial: ${senhaInicial || adminPassword}`);
}

async function ensureStorageFolders() {
  const uploadDir = getUploadBaseDir();
  const brandingDir = getBrandingBaseDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true });
  }

  seedFileIfMissing(path.join(brandingDir, 'company-logo.png'), getBundledBrandingAsset('company-logo.png'));
  seedFileIfMissing(path.join(brandingDir, 'company-mark.png'), getBundledBrandingAsset('company-mark.png'));
  seedFileIfMissing(path.join(brandingDir, 'lawyer-logo.png'), getBundledBrandingAsset('lawyer-logo.png'));
  seedBrandingInstructions(brandingDir);
}

async function cleanupTempAttachments(db) {
  const staleAttachments = await db.all(
    `SELECT id, caminho_relativo
     FROM anexos_temporarios_processo
     WHERE criado_em < datetime('now', '-2 days')`
  );

  for (const anexo of staleAttachments) {
    const absolutePath = path.resolve(anexo.caminho_relativo);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  await db.run(
    `DELETE FROM anexos_temporarios_processo
     WHERE criado_em < datetime('now', '-2 days')`
  );
}

async function migrateSchema(db) {
  await db.exec(SCHEMA);
  await ensureColumns(db);
  await ensurePermissions(db);
  await ensureStorageFolders();
  await cleanupTempAttachments(db);
}

async function initializeDatabase() {
  const db = new Database();

  try {
    await db.connect();
    await migrateSchema(db);
    await bootstrapAdmin(db);
    await db.close();
    console.log('Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    await db.close();
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config();
  initializeDatabase();
}

module.exports = {
  initializeDatabase,
  migrateSchema,
  bootstrapAdmin,
  Database
};
