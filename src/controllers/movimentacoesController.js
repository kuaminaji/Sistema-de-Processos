const { Database } = require('../database/init');
const { sanitizarInput } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

// Listar movimentações por processo_id com paginação
async function list(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'data_movimentacao',
      sortOrder = 'DESC',
      processo_id
    } = req.query;
    
    if (!processo_id) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'processo_id é obrigatório'
      });
    }
    
    // Verificar se processo existe
    const processo = await db.get(
      'SELECT id, numero_processo FROM processos WHERE id = ?',
      [parseInt(processo_id)]
    );
    
    if (!processo) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy
    const allowedSortFields = ['id', 'tipo', 'data_movimentacao', 'criado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'data_movimentacao';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Buscar total de registros
    const { total } = await db.get(
      'SELECT COUNT(*) as total FROM movimentacoes WHERE processo_id = ?',
      [parseInt(processo_id)]
    );
    
    // Buscar movimentações
    const query = `
      SELECT * FROM movimentacoes
      WHERE processo_id = ?
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = await db.all(query, [parseInt(processo_id), limit, offset]);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Movimentações listadas com sucesso',
      data: {
        items,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        processo: {
          id: processo.id,
          numero_processo: processo.numero_processo
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar movimentações'
    });
  }
}

// Criar nova movimentação
async function create(req, res) {
  const db = new Database();
  
  try {
    const {
      processo_id,
      tipo,
      descricao,
      data_movimentacao
    } = req.body;
    
    // Validar campos obrigatórios
    if (!processo_id || !tipo || !descricao || !data_movimentacao) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: processo_id, tipo, descricao, data_movimentacao'
      });
    }
    
    await db.connect();
    
    // Verificar se processo existe
    const processo = await db.get(
      'SELECT id, numero_processo FROM processos WHERE id = ?',
      [parseInt(processo_id)]
    );
    
    if (!processo) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    // Inserir movimentação
    const result = await db.run(
      `INSERT INTO movimentacoes (processo_id, tipo, descricao, data_movimentacao)
       VALUES (?, ?, ?, ?)`,
      [
        parseInt(processo_id),
        sanitizarInput(tipo),
        sanitizarInput(descricao),
        data_movimentacao
      ]
    );
    
    // Atualizar data_ultima_movimentacao do processo
    await db.run(
      `UPDATE processos 
       SET data_ultima_movimentacao = ?, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [data_movimentacao, parseInt(processo_id)]
    );
    
    // Buscar movimentação criada
    const movimentacaoNova = await db.get(
      'SELECT * FROM movimentacoes WHERE id = ?',
      [result.lastID]
    );
    
    await auditLog(req, 'movimentacao_criada', { 
      movimentacao_id: result.lastID, 
      processo_id: parseInt(processo_id),
      numero_processo: processo.numero_processo
    });
    await db.close();
    
    return res.status(201).json({
      success: true,
      message: 'Movimentação criada com sucesso',
      data: movimentacaoNova
    });
    
  } catch (error) {
    console.error('Erro ao criar movimentação:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar movimentação'
    });
  }
}

// Atualizar movimentação
async function update(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const {
      tipo,
      descricao,
      data_movimentacao
    } = req.body;
    
    await db.connect();
    
    // Verificar se movimentação existe
    const movimentacaoExistente = await db.get(
      'SELECT * FROM movimentacoes WHERE id = ?',
      [parseInt(id)]
    );
    
    if (!movimentacaoExistente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Movimentação não encontrada'
      });
    }
    
    // Construir update dinamicamente
    const updates = [];
    const params = [];
    
    if (tipo !== undefined) {
      updates.push('tipo = ?');
      params.push(sanitizarInput(tipo));
    }
    if (descricao !== undefined) {
      updates.push('descricao = ?');
      params.push(sanitizarInput(descricao));
    }
    if (data_movimentacao !== undefined) {
      updates.push('data_movimentacao = ?');
      params.push(data_movimentacao);
    }
    
    if (updates.length === 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }
    
    params.push(parseInt(id));
    
    // Atualizar movimentação
    await db.run(
      `UPDATE movimentacoes SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Buscar movimentação atualizada
    const movimentacaoAtualizada = await db.get(
      'SELECT * FROM movimentacoes WHERE id = ?',
      [parseInt(id)]
    );
    
    // Atualizar data_ultima_movimentacao do processo se a data mudou
    if (data_movimentacao !== undefined) {
      const ultimaMovimentacao = await db.get(
        `SELECT data_movimentacao 
         FROM movimentacoes 
         WHERE processo_id = ? 
         ORDER BY data_movimentacao DESC 
         LIMIT 1`,
        [movimentacaoExistente.processo_id]
      );
      
      if (ultimaMovimentacao) {
        await db.run(
          `UPDATE processos 
           SET data_ultima_movimentacao = ?, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [ultimaMovimentacao.data_movimentacao, movimentacaoExistente.processo_id]
        );
      }
    }
    
    await auditLog(req, 'movimentacao_atualizada', { 
      movimentacao_id: parseInt(id),
      processo_id: movimentacaoExistente.processo_id
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Movimentação atualizada com sucesso',
      data: movimentacaoAtualizada
    });
    
  } catch (error) {
    console.error('Erro ao atualizar movimentação:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar movimentação'
    });
  }
}

// Excluir movimentação
async function deleteMovimentacao(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Verificar se movimentação existe
    const movimentacao = await db.get(
      'SELECT * FROM movimentacoes WHERE id = ?',
      [parseInt(id)]
    );
    
    if (!movimentacao) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Movimentação não encontrada'
      });
    }
    
    const processoId = movimentacao.processo_id;
    
    // Deletar movimentação
    await db.run('DELETE FROM movimentacoes WHERE id = ?', [parseInt(id)]);
    
    // Atualizar data_ultima_movimentacao do processo
    const ultimaMovimentacao = await db.get(
      `SELECT data_movimentacao 
       FROM movimentacoes 
       WHERE processo_id = ? 
       ORDER BY data_movimentacao DESC 
       LIMIT 1`,
      [processoId]
    );
    
    if (ultimaMovimentacao) {
      await db.run(
        `UPDATE processos 
         SET data_ultima_movimentacao = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ultimaMovimentacao.data_movimentacao, processoId]
      );
    } else {
      // Se não há mais movimentações, definir como data de distribuição
      await db.run(
        `UPDATE processos 
         SET data_ultima_movimentacao = data_distribuicao, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [processoId]
      );
    }
    
    await auditLog(req, 'movimentacao_excluida', { 
      movimentacao_id: parseInt(id),
      processo_id: processoId
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Movimentação excluída com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir movimentação:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir movimentação'
    });
  }
}

module.exports = {
  list,
  create,
  update,
  deleteMovimentacao
};
