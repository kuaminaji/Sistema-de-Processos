const bcrypt = require('bcryptjs');
const { Database } = require('../database/init');
const { sanitizarInput, validarSenhaForte, validarEmail } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

// Listar usuários (admin only)
async function list(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'criado_em',
      sortOrder = 'DESC',
      perfil,
      ativo
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy
    const allowedSortFields = ['id', 'nome', 'email', 'perfil', 'ativo', 'ultimo_login_em', 'criado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'criado_em';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Construir query com filtros
    const whereConditions = [];
    const params = [];
    
    if (perfil) {
      whereConditions.push('perfil = ?');
      params.push(perfil);
    }
    
    if (ativo !== undefined) {
      whereConditions.push('ativo = ?');
      params.push(parseInt(ativo) ? 1 : 0);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const { total } = await db.get(
      `SELECT COUNT(*) as total FROM usuarios ${whereClause}`,
      params
    );
    
    // Buscar usuários (sem senha_hash)
    const query = `
      SELECT 
        id, nome, email, perfil, ativo,
        twofa_enabled, forcar_troca_senha,
        senha_expira_em, ultimo_login_em,
        criado_em, atualizado_em
      FROM usuarios
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = await db.all(query, [...params, limit, offset]);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Usuários listados com sucesso',
      data: {
        items,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários'
    });
  }
}

// Buscar usuário por ID
async function getById(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Buscar usuário (sem senha_hash)
    const usuario = await db.get(
      `SELECT 
        id, nome, email, perfil, ativo,
        twofa_enabled, forcar_troca_senha,
        senha_expira_em, ultimo_login_em,
        criado_em, atualizado_em
       FROM usuarios 
       WHERE id = ?`,
      [parseInt(id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar permissões do usuário
    const permissoes = await db.all(
      `SELECT p.id, p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ? AND up.concedido = 1`,
      [parseInt(id)]
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Usuário encontrado com sucesso',
      data: {
        usuario,
        permissoes
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário'
    });
  }
}

// Criar usuário
async function create(req, res) {
  const db = new Database();
  
  try {
    const {
      nome,
      email,
      senha,
      perfil,
      ativo = 1
    } = req.body;
    
    // Validar campos obrigatórios
    if (!nome || !email || !senha || !perfil) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: nome, email, senha, perfil'
      });
    }
    
    // Validar email
    if (!validarEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
    
    // Validar perfil
    if (!['admin', 'advogado'].includes(perfil)) {
      return res.status(400).json({
        success: false,
        message: 'Perfil inválido. Valores permitidos: admin, advogado'
      });
    }
    
    // Validar senha
    const senhaValidacao = validarSenhaForte(senha);
    if (!senhaValidacao.valida) {
      return res.status(400).json({
        success: false,
        message: senhaValidacao.mensagem
      });
    }
    
    await db.connect();
    
    // Verificar se email já existe
    const usuarioExistente = await db.get(
      'SELECT id FROM usuarios WHERE email = ?',
      [sanitizarInput(email)]
    );
    
    if (usuarioExistente) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }
    
    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Calcular data de expiração da senha (90 dias)
    const passwordExpiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90');
    const senhaExpiraEm = new Date();
    senhaExpiraEm.setDate(senhaExpiraEm.getDate() + passwordExpiryDays);
    
    // Inserir usuário
    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, forcar_troca_senha, senha_expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarInput(nome),
        sanitizarInput(email),
        senhaHash,
        perfil,
        parseInt(ativo) ? 1 : 0,
        1, // Forçar troca de senha no primeiro login
        senhaExpiraEm.toISOString()
      ]
    );
    
    const usuarioId = result.lastID;
    
    // Adicionar ao histórico de senhas
    await db.run(
      'INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)',
      [usuarioId, senhaHash]
    );
    
    // Aplicar permissões padrão por perfil
    await applyDefaultPermissionsByPerfil(db, usuarioId, perfil);
    
    // Buscar usuário criado (sem senha_hash)
    const usuarioNovo = await db.get(
      `SELECT 
        id, nome, email, perfil, ativo,
        twofa_enabled, forcar_troca_senha,
        senha_expira_em, criado_em, atualizado_em
       FROM usuarios 
       WHERE id = ?`,
      [usuarioId]
    );
    
    await auditLog(req, 'usuario_criado', { usuario_id: usuarioId, email: sanitizarInput(email) });
    await db.close();
    
    return res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: usuarioNovo
    });
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário'
    });
  }
}

// Aplicar permissões padrão por perfil
async function applyDefaultPermissionsByPerfil(db, usuarioId, perfil) {
  if (perfil === 'admin') {
    // Admin tem todas as permissões
    const permissoes = await db.all('SELECT id FROM permissoes');
    for (const perm of permissoes) {
      await db.run(
        'INSERT OR IGNORE INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
        [usuarioId, perm.id, 1]
      );
    }
  } else if (perfil === 'advogado') {
    // Advogado tem permissões básicas
    const codigosPermissoes = [
      'processos.view',
      'processos.create',
      'processos.update',
      'movimentacoes.view',
      'movimentacoes.create',
      'movimentacoes.update',
      'clientes.view',
      'clientes.create',
      'clientes.update'
    ];
    
    for (const codigo of codigosPermissoes) {
      const permissao = await db.get('SELECT id FROM permissoes WHERE codigo = ?', [codigo]);
      if (permissao) {
        await db.run(
          'INSERT OR IGNORE INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
          [usuarioId, permissao.id, 1]
        );
      }
    }
  }
}

// Atualizar usuário (sem senha)
async function update(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const {
      nome,
      email,
      perfil,
      ativo
    } = req.body;
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuarioExistente = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [parseInt(id)]
    );
    
    if (!usuarioExistente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Validar email se fornecido
    if (email !== undefined) {
      if (!validarEmail(email)) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
      }
      
      // Verificar unicidade do email
      const emailExiste = await db.get(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [sanitizarInput(email), parseInt(id)]
      );
      
      if (emailExiste) {
        await db.close();
        return res.status(409).json({
          success: false,
          message: 'Email já cadastrado'
        });
      }
    }
    
    // Validar perfil se fornecido
    if (perfil !== undefined && !['admin', 'advogado'].includes(perfil)) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Perfil inválido. Valores permitidos: admin, advogado'
      });
    }
    
    // Construir update dinamicamente
    const updates = [];
    const params = [];
    
    if (nome !== undefined) {
      updates.push('nome = ?');
      params.push(sanitizarInput(nome));
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(sanitizarInput(email));
    }
    if (perfil !== undefined) {
      updates.push('perfil = ?');
      params.push(perfil);
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?');
      params.push(parseInt(ativo) ? 1 : 0);
    }
    
    if (updates.length === 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }
    
    updates.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(parseInt(id));
    
    // Atualizar usuário
    await db.run(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Buscar usuário atualizado
    const usuarioAtualizado = await db.get(
      `SELECT 
        id, nome, email, perfil, ativo,
        twofa_enabled, forcar_troca_senha,
        senha_expira_em, ultimo_login_em,
        criado_em, atualizado_em
       FROM usuarios 
       WHERE id = ?`,
      [parseInt(id)]
    );
    
    await auditLog(req, 'usuario_atualizado', { usuario_id: parseInt(id) });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: usuarioAtualizado
    });
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário'
    });
  }
}

// Excluir usuário (previne deletar a si mesmo)
async function deleteUsuario(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const usuarioLogadoId = req.session.usuario.id;
    
    // Prevenir auto-exclusão
    if (parseInt(id) === usuarioLogadoId) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode excluir seu próprio usuário'
      });
    }
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [parseInt(id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Deletar usuário (CASCADE deletará permissões e histórico)
    await db.run('DELETE FROM usuarios WHERE id = ?', [parseInt(id)]);
    
    await auditLog(req, 'usuario_excluido', { 
      usuario_id: parseInt(id),
      email: usuario.email
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir usuário'
    });
  }
}

// Ativar usuário
async function activate(req, res) {
  return toggleAtivo(req, res, 1);
}

// Desativar usuário
async function deactivate(req, res) {
  return toggleAtivo(req, res, 0);
}

// Toggle ativo/inativo
async function toggleAtivo(req, res, ativo) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const usuarioLogadoId = req.session.usuario.id;
    
    // Prevenir auto-desativação
    if (parseInt(id) === usuarioLogadoId && ativo === 0) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode desativar seu próprio usuário'
      });
    }
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuario = await db.get(
      'SELECT id, email FROM usuarios WHERE id = ?',
      [parseInt(id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar status
    await db.run(
      'UPDATE usuarios SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [ativo, parseInt(id)]
    );
    
    await auditLog(req, ativo ? 'usuario_ativado' : 'usuario_desativado', { 
      usuario_id: parseInt(id),
      email: usuario.email
    });
    await db.close();
    
    return res.json({
      success: true,
      message: `Usuário ${ativo ? 'ativado' : 'desativado'} com sucesso`
    });
    
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao alterar status do usuário'
    });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deleteUsuario,
  activate,
  deactivate
};
