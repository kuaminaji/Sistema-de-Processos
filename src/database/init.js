const Database = require('./db');

const SCHEMA = `
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'advogado')),
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

-- Histórico de senhas para evitar reutilização
CREATE TABLE IF NOT EXISTS historico_senhas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  senha_hash TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historico_senhas_usuario ON historico_senhas(usuario_id);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT,
  whatsapp TEXT,
  telefone_secundario TEXT,
  endereco TEXT,
  observacoes TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

-- Tabela de processos
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

-- Tabela de movimentações
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

-- Tabela de permissões
CREATE TABLE IF NOT EXISTS permissoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  modulo TEXT NOT NULL,
  descricao TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permissoes_codigo ON permissoes(codigo);
CREATE INDEX IF NOT EXISTS idx_permissoes_modulo ON permissoes(modulo);

-- Tabela de relacionamento usuário-permissões
CREATE TABLE IF NOT EXISTS usuario_permissoes (
  usuario_id INTEGER NOT NULL,
  permissao_id INTEGER NOT NULL,
  concedido INTEGER DEFAULT 1,
  PRIMARY KEY (usuario_id, permissao_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (permissao_id) REFERENCES permissoes(id) ON DELETE CASCADE
);

-- Trilha de auditoria
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

-- Proteção contra brute force
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

-- Tokens de reset de senha
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

// Permissões padrão do sistema
const DEFAULT_PERMISSIONS = [
  // Processos
  { codigo: 'processos.view', modulo: 'processos', descricao: 'Visualizar processos' },
  { codigo: 'processos.create', modulo: 'processos', descricao: 'Criar processos' },
  { codigo: 'processos.update', modulo: 'processos', descricao: 'Editar processos' },
  { codigo: 'processos.delete', modulo: 'processos', descricao: 'Excluir processos' },
  
  // Movimentações
  { codigo: 'movimentacoes.view', modulo: 'movimentacoes', descricao: 'Visualizar movimentações' },
  { codigo: 'movimentacoes.create', modulo: 'movimentacoes', descricao: 'Criar movimentações' },
  { codigo: 'movimentacoes.update', modulo: 'movimentacoes', descricao: 'Editar movimentações' },
  { codigo: 'movimentacoes.delete', modulo: 'movimentacoes', descricao: 'Excluir movimentações' },
  
  // Clientes
  { codigo: 'clientes.view', modulo: 'clientes', descricao: 'Visualizar clientes' },
  { codigo: 'clientes.create', modulo: 'clientes', descricao: 'Criar clientes' },
  { codigo: 'clientes.update', modulo: 'clientes', descricao: 'Editar clientes' },
  { codigo: 'clientes.delete', modulo: 'clientes', descricao: 'Excluir clientes' },
  
  // Usuários
  { codigo: 'usuarios.view', modulo: 'usuarios', descricao: 'Visualizar usuários' },
  { codigo: 'usuarios.manage', modulo: 'usuarios', descricao: 'Gerenciar usuários (CRUD completo)' },
  
  // Admin
  { codigo: 'admin.backup', modulo: 'admin', descricao: 'Realizar backup do sistema' },
  { codigo: 'admin.restore', modulo: 'admin', descricao: 'Restaurar backup do sistema' },
  { codigo: 'admin.export', modulo: 'admin', descricao: 'Exportar dados (PDF, Excel, CSV)' },
  
  // Auditoria
  { codigo: 'auditoria.view', modulo: 'auditoria', descricao: 'Visualizar trilha de auditoria' },
  
  // Segurança
  { codigo: 'security.manage', modulo: 'security', descricao: 'Gerenciar configurações de segurança' },
  
  // Público
  { codigo: 'public.consulta', modulo: 'public', descricao: 'Consultar processos na área pública' }
];

async function initializeDatabase() {
  const db = new Database();
  
  try {
    await db.connect();
    console.log('📦 Conectado ao banco de dados');
    
    // Criar schema
    await db.exec(SCHEMA);
    console.log('✅ Schema criado com sucesso');
    
    // Inserir permissões padrão
    for (const perm of DEFAULT_PERMISSIONS) {
      try {
        await db.run(
          'INSERT OR IGNORE INTO permissoes (codigo, modulo, descricao) VALUES (?, ?, ?)',
          [perm.codigo, perm.modulo, perm.descricao]
        );
      } catch (err) {
        // Ignora se já existe
      }
    }
    console.log('✅ Permissões padrão inseridas');
    
    // Bootstrap do admin
    await bootstrapAdmin(db);
    
    await db.close();
    console.log('✅ Banco de dados inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    await db.close();
    process.exit(1);
  }
}

async function bootstrapAdmin(db) {
  const bcrypt = require('bcryptjs');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  // Verificar se admin já existe
  const existingAdmin = await db.get('SELECT id FROM usuarios WHERE email = ?', [adminEmail]);
  
  if (existingAdmin) {
    console.log(`ℹ️  Admin bootstrap já existente (email: ${adminEmail})`);
    return;
  }
  
  // Criar senha hash
  const senhaHash = await bcrypt.hash(adminPassword, 10);
  
  // Calcular data de expiração da senha (90 dias padrão)
  const passwordExpiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90');
  const senhaExpiraEm = new Date();
  senhaExpiraEm.setDate(senhaExpiraEm.getDate() + passwordExpiryDays);
  
  // Inserir admin (SEM forçar troca de senha no primeiro login)
  const result = await db.run(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, forcar_troca_senha, senha_expira_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Administrador', adminEmail, senhaHash, 'admin', 1, 0, senhaExpiraEm.toISOString()]
  );
  
  const adminId = result.lastID;
  
  // Conceder todas as permissões ao admin
  const permissoes = await db.all('SELECT id FROM permissoes');
  for (const perm of permissoes) {
    await db.run(
      'INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
      [adminId, perm.id, 1]
    );
  }
  
  // Adicionar ao histórico de senhas
  await db.run(
    'INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)',
    [adminId, senhaHash]
  );
  
  console.log(`✅ Admin bootstrap criado com sucesso (email: ${adminEmail})`);
  console.log(`ℹ️  Credenciais: ${adminEmail} / ${adminPassword}`);
  console.log(`ℹ️  Você pode trocar a senha quando quiser através do menu Perfil`);
}

// Executar se chamado diretamente
if (require.main === module) {
  require('dotenv').config();
  initializeDatabase();
}

module.exports = { initializeDatabase, Database };
