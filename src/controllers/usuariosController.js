const bcrypt = require('bcryptjs');
const { Database } = require('../database/init');
const { sanitizarInput, validarSenhaForte, validarEmail } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

const PERFIS_VALIDOS = ['admin', 'advogado', 'secretaria', 'gestor'];

async function list(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const { page = 1, perPage = 10, sortBy = 'criado_em', sortOrder = 'DESC', perfil, ativo } = req.query;
    const limit = Math.min(parseInt(perPage, 10), 100);
    const offset = (parseInt(page, 10) - 1) * limit;
    const allowedSortFields = ['id', 'nome', 'email', 'perfil', 'ativo', 'ultimo_login_em', 'criado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'criado_em';
    const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ?'ASC' : 'DESC';

    const whereConditions = [];
    const params = [];
    if (perfil) {
      whereConditions.push('perfil = ?');
      params.push(perfil);
    }
    if (ativo !== undefined) {
      whereConditions.push('ativo = ?');
      params.push(parseInt(ativo, 10) ?1 : 0);
    }
    const whereClause = whereConditions.length ?`WHERE ${whereConditions.join(' AND ')}` : '';

    const { total } = await db.get(`SELECT COUNT(*) as total FROM usuarios ${whereClause}`, params);
    const items = await db.all(
      `SELECT id, nome, email, perfil, ativo, twofa_enabled, forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
       FROM usuarios
       ${whereClause}
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT ?OFFSET ?`,
      [...params, limit, offset]
    );

    await db.close();
    return res.json({ success: true, message: 'Usu?rios listados com sucesso', data: { items, total, page: parseInt(page, 10), perPage: limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Erro ao listar usu?rios:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao listar usu?rios' });
  }
}

async function getById(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const usuario = await db.get(
      `SELECT id, nome, email, perfil, ativo, twofa_enabled, forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
       FROM usuarios WHERE id = ?`,
      [parseInt(req.params.id, 10)]
    );

    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usu?rio n?o encontrado' });
    }

    const permissoes = await db.all(
      `SELECT p.id, p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ?AND up.concedido = 1`,
      [parseInt(req.params.id, 10)]
    );

    await db.close();
    return res.json({ success: true, message: 'Usu?rio encontrado com sucesso', data: { usuario, permissoes } });
  } catch (error) {
    console.error('Erro ao buscar usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao buscar usu?rio' });
  }
}

async function create(req, res) {
  const db = new Database();

  try {
    const { nome, email, senha, perfil, ativo = 1 } = req.body;
    if (!nome || !email || !senha || !perfil) {
      return res.status(400).json({ success: false, message: 'Campos obrigat?rios: nome, email, senha, perfil' });
    }
    if (!validarEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email inv?lido' });
    }
    if (!PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ success: false, message: `Perfil inv?lido. Valores permitidos: ${PERFIS_VALIDOS.join(', ')}` });
    }
    const senhaValidacao = validarSenhaForte(senha);
    if (!senhaValidacao.valida) {
      return res.status(400).json({ success: false, message: senhaValidacao.mensagem });
    }

    await db.connect();
    const existente = await db.get('SELECT id FROM usuarios WHERE email = ?', [sanitizarInput(email)]);
    if (existente) {
      await db.close();
      return res.status(409).json({ success: false, message: 'Email j?cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, parseInt(process.env.PASSWORD_ROUNDS || '12', 10));
    const senhaExpiraEm = new Date();
    senhaExpiraEm.setDate(senhaExpiraEm.getDate() + parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10));

    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, forcar_troca_senha, senha_expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sanitizarInput(nome), sanitizarInput(email), senhaHash, perfil, parseInt(ativo, 10) ?1 : 0, 1, senhaExpiraEm.toISOString()]
    );

    await db.run('INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)', [result.lastID, senhaHash]);
    await applyDefaultPermissionsByPerfil(db, result.lastID, perfil);

    const usuarioNovo = await db.get(
      `SELECT id, nome, email, perfil, ativo, twofa_enabled, forcar_troca_senha, senha_expira_em, criado_em, atualizado_em
       FROM usuarios WHERE id = ?`,
      [result.lastID]
    );

    await auditLog(req, 'usuario_criado', { usuario_id: result.lastID, email: sanitizarInput(email), perfil });
    await db.close();
    return res.status(201).json({ success: true, message: 'Usu?rio criado com sucesso', data: usuarioNovo });
  } catch (error) {
    console.error('Erro ao criar usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao criar usu?rio' });
  }
}

async function applyDefaultPermissionsByPerfil(db, usuarioId, perfil) {
  const map = {
    admin: null,
    advogado: ['processos.view', 'processos.create', 'processos.update', 'movimentacoes.view', 'movimentacoes.create', 'movimentacoes.update', 'clientes.view', 'clientes.create', 'clientes.update'],
    secretaria: ['processos.view', 'movimentacoes.view', 'movimentacoes.create', 'clientes.view', 'clientes.create', 'clientes.update', 'public.consulta'],
    gestor: ['processos.view', 'movimentacoes.view', 'clientes.view', 'usuarios.view', 'auditoria.view', 'admin.export', 'dashboard.view_financeiro', 'dashboard.view_sla']
  };

  if (perfil === 'admin') {
    const permissoes = await db.all('SELECT id FROM permissoes');
    for (const permissao of permissoes) {
      await db.run('INSERT OR IGNORE INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)', [usuarioId, permissao.id, 1]);
    }
    return;
  }

  for (const codigo of map[perfil] || []) {
    const permissao = await db.get('SELECT id FROM permissoes WHERE codigo = ?', [codigo]);
    if (permissao) {
      await db.run('INSERT OR IGNORE INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)', [usuarioId, permissao.id, 1]);
    }
  }
}

async function update(req, res) {
  const db = new Database();

  try {
    const { nome, email, perfil, ativo } = req.body;
    await db.connect();
    const usuarioExistente = await db.get('SELECT * FROM usuarios WHERE id = ?', [parseInt(req.params.id, 10)]);
    if (!usuarioExistente) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usu?rio n?o encontrado' });
    }

    if (email !== undefined) {
      if (!validarEmail(email)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Email inv?lido' });
      }
      const emailExiste = await db.get('SELECT id FROM usuarios WHERE email = ?AND id != ?', [sanitizarInput(email), parseInt(req.params.id, 10)]);
      if (emailExiste) {
        await db.close();
        return res.status(409).json({ success: false, message: 'Email j?cadastrado' });
      }
    }
    if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
      await db.close();
      return res.status(400).json({ success: false, message: `Perfil inv?lido. Valores permitidos: ${PERFIS_VALIDOS.join(', ')}` });
    }

    const updates = [];
    const params = [];
    if (nome !== undefined) { updates.push('nome = ?'); params.push(sanitizarInput(nome)); }
    if (email !== undefined) { updates.push('email = ?'); params.push(sanitizarInput(email)); }
    if (perfil !== undefined) { updates.push('perfil = ?'); params.push(perfil); }
    if (ativo !== undefined) { updates.push('ativo = ?'); params.push(parseInt(ativo, 10) ?1 : 0); }

    if (!updates.length) {
      await db.close();
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    updates.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(parseInt(req.params.id, 10));
    await db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);

    if (perfil !== undefined && perfil !== usuarioExistente.perfil) {
      await db.run('DELETE FROM usuario_permissoes WHERE usuario_id = ?', [parseInt(req.params.id, 10)]);
      await applyDefaultPermissionsByPerfil(db, parseInt(req.params.id, 10), perfil);
    }

    const usuarioAtualizado = await db.get(
      `SELECT id, nome, email, perfil, ativo, twofa_enabled, forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
       FROM usuarios WHERE id = ?`,
      [parseInt(req.params.id, 10)]
    );

    await auditLog(req, 'usuario_atualizado', { usuario_id: parseInt(req.params.id, 10) });
    await db.close();
    return res.json({ success: true, message: 'Usu?rio atualizado com sucesso', data: usuarioAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao atualizar usu?rio' });
  }
}

async function deleteUsuario(req, res) {
  const db = new Database();

  try {
    const usuarioLogadoId = req.session.usuario.id;
    if (parseInt(req.params.id, 10) === usuarioLogadoId) {
      return res.status(400).json({ success: false, message: 'Voc?n?o pode excluir seu pr?prio usu?rio' });
    }

    await db.connect();
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [parseInt(req.params.id, 10)]);
    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usu?rio n?o encontrado' });
    }

    await db.run('DELETE FROM usuarios WHERE id = ?', [parseInt(req.params.id, 10)]);
    await auditLog(req, 'usuario_excluido', { usuario_id: parseInt(req.params.id, 10), email: usuario.email });
    await db.close();
    return res.json({ success: true, message: 'Usu?rio exclu?do com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao excluir usu?rio' });
  }
}

async function activate(req, res) {
  return toggleAtivo(req, res, 1);
}

async function deactivate(req, res) {
  return toggleAtivo(req, res, 0);
}

async function toggleAtivo(req, res, ativo) {
  const db = new Database();

  try {
    const usuarioLogadoId = req.session.usuario.id;
    if (parseInt(req.params.id, 10) === usuarioLogadoId && ativo === 0) {
      return res.status(400).json({ success: false, message: 'Voc?n?o pode desativar seu pr?prio usu?rio' });
    }

    await db.connect();
    const usuario = await db.get('SELECT id, email FROM usuarios WHERE id = ?', [parseInt(req.params.id, 10)]);
    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usu?rio n?o encontrado' });
    }

    await db.run('UPDATE usuarios SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?', [ativo, parseInt(req.params.id, 10)]);
    await auditLog(req, ativo ?'usuario_ativado' : 'usuario_desativado', { usuario_id: parseInt(req.params.id, 10), email: usuario.email });
    await db.close();
    return res.json({ success: true, message: `Usu?rio ${ativo ?'ativado' : 'desativado'} com sucesso` });
  } catch (error) {
    console.error('Erro ao alterar status do usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao alterar status do usu?rio' });
  }
}

module.exports = { list, getById, create, update, deleteUsuario, activate, deactivate };
