const { Database } = require('../database/init');
const { auditLog } = require('../middleware/audit');

// Listar todas as permissões (agrupadas por módulo)
async function listPermissoes(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Buscar todas as permissões
    const permissoes = await db.all(
      'SELECT id, codigo, modulo, descricao FROM permissoes ORDER BY modulo, codigo'
    );
    
    // Agrupar por módulo
    const porModulo = permissoes.reduce((acc, perm) => {
      if (!acc[perm.modulo]) {
        acc[perm.modulo] = [];
      }
      acc[perm.modulo].push(perm);
      return acc;
    }, {});
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Permissões listadas com sucesso',
      data: {
        permissoes,
        porModulo
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar permissões:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar permissões'
    });
  }
}

// Obter permissões de um usuário específico
async function getUserPermissions(req, res) {
  const db = new Database();
  
  try {
    const { usuario_id } = req.params;
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuario = await db.get(
      'SELECT id, nome, email, perfil FROM usuarios WHERE id = ?',
      [parseInt(usuario_id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar permissões concedidas
    const permissoes = await db.all(
      `SELECT p.id, p.codigo, p.modulo, p.descricao, up.concedido
       FROM permissoes p
       LEFT JOIN usuario_permissoes up ON up.permissao_id = p.id AND up.usuario_id = ?
       ORDER BY p.modulo, p.codigo`,
      [parseInt(usuario_id)]
    );
    
    // Separar permissões concedidas e negadas
    const concedidas = permissoes.filter(p => p.concedido === 1);
    const disponiveis = permissoes.filter(p => p.concedido !== 1);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Permissões do usuário obtidas com sucesso',
      data: {
        usuario,
        permissoes: {
          concedidas: concedidas.map(p => ({ id: p.id, codigo: p.codigo, modulo: p.modulo, descricao: p.descricao })),
          disponiveis: disponiveis.map(p => ({ id: p.id, codigo: p.codigo, modulo: p.modulo, descricao: p.descricao }))
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter permissões do usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter permissões do usuário'
    });
  }
}

// Atualizar permissões de um usuário
async function updateUserPermissions(req, res) {
  const db = new Database();
  
  try {
    const { usuario_id } = req.params;
    const { permissao_ids } = req.body;
    
    // Validar campos obrigatórios
    if (!Array.isArray(permissao_ids)) {
      return res.status(400).json({
        success: false,
        message: 'permissao_ids deve ser um array de IDs'
      });
    }
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuario = await db.get(
      'SELECT id, nome, email, perfil FROM usuarios WHERE id = ?',
      [parseInt(usuario_id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Remover todas as permissões atuais
    await db.run(
      'DELETE FROM usuario_permissoes WHERE usuario_id = ?',
      [parseInt(usuario_id)]
    );
    
    // Adicionar novas permissões
    for (const permissaoId of permissao_ids) {
      // Verificar se permissão existe
      const permissao = await db.get(
        'SELECT id FROM permissoes WHERE id = ?',
        [parseInt(permissaoId)]
      );
      
      if (permissao) {
        await db.run(
          'INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
          [parseInt(usuario_id), parseInt(permissaoId), 1]
        );
      }
    }
    
    // Buscar permissões atualizadas
    const permissoesAtualizadas = await db.all(
      `SELECT p.id, p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ? AND up.concedido = 1`,
      [parseInt(usuario_id)]
    );
    
    await auditLog(req, 'permissoes_atualizadas', { 
      usuario_id: parseInt(usuario_id),
      email: usuario.email,
      total_permissoes: permissoesAtualizadas.length
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Permissões atualizadas com sucesso',
      data: {
        usuario,
        permissoes: permissoesAtualizadas
      }
    });
    
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar permissões'
    });
  }
}

// Aplicar permissões em lote por perfil
async function applyPermissionsByPerfil(req, res) {
  const db = new Database();
  
  try {
    const { usuario_id } = req.params;
    const { perfil } = req.body;
    
    // Validar perfil
    if (!['admin', 'advogado'].includes(perfil)) {
      return res.status(400).json({
        success: false,
        message: 'Perfil inválido. Valores permitidos: admin, advogado'
      });
    }
    
    await db.connect();
    
    // Verificar se usuário existe
    const usuario = await db.get(
      'SELECT id, nome, email FROM usuarios WHERE id = ?',
      [parseInt(usuario_id)]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Remover todas as permissões atuais
    await db.run(
      'DELETE FROM usuario_permissoes WHERE usuario_id = ?',
      [parseInt(usuario_id)]
    );
    
    if (perfil === 'admin') {
      // Admin tem todas as permissões
      const permissoes = await db.all('SELECT id FROM permissoes');
      for (const perm of permissoes) {
        await db.run(
          'INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
          [parseInt(usuario_id), perm.id, 1]
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
            'INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)',
            [parseInt(usuario_id), permissao.id, 1]
          );
        }
      }
    }
    
    // Atualizar perfil do usuário
    await db.run(
      'UPDATE usuarios SET perfil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [perfil, parseInt(usuario_id)]
    );
    
    // Buscar permissões aplicadas
    const permissoesAplicadas = await db.all(
      `SELECT p.id, p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ? AND up.concedido = 1`,
      [parseInt(usuario_id)]
    );
    
    await auditLog(req, 'permissoes_aplicadas_por_perfil', { 
      usuario_id: parseInt(usuario_id),
      email: usuario.email,
      perfil,
      total_permissoes: permissoesAplicadas.length
    });
    await db.close();
    
    return res.json({
      success: true,
      message: `Permissões do perfil ${perfil} aplicadas com sucesso`,
      data: {
        usuario,
        perfil,
        permissoes: permissoesAplicadas
      }
    });
    
  } catch (error) {
    console.error('Erro ao aplicar permissões por perfil:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao aplicar permissões por perfil'
    });
  }
}

module.exports = {
  listPermissoes,
  getUserPermissions,
  updateUserPermissions,
  applyPermissionsByPerfil
};
