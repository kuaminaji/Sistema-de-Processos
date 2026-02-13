const { Database } = require('../database/init');
const { validarNumeroProcesso, formatarNumeroProcesso, sanitizarInput } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

// Listar processos com paginação e filtros
async function list(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'criado_em',
      sortOrder = 'DESC',
      numero,
      autor,
      reu,
      status,
      cliente_id
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy para prevenir SQL injection
    const allowedSortFields = ['id', 'numero_processo', 'titulo', 'status', 'autor', 'reu', 'data_distribuicao', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'criado_em';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Construir query com filtros
    let whereConditions = [];
    let params = [];
    
    if (numero) {
      whereConditions.push('p.numero_processo LIKE ?');
      params.push(`%${sanitizarInput(numero)}%`);
    }
    
    if (autor) {
      whereConditions.push('p.autor LIKE ?');
      params.push(`%${sanitizarInput(autor)}%`);
    }
    
    if (reu) {
      whereConditions.push('p.reu LIKE ?');
      params.push(`%${sanitizarInput(reu)}%`);
    }
    
    if (status) {
      whereConditions.push('p.status = ?');
      params.push(sanitizarInput(status));
    }
    
    if (cliente_id) {
      whereConditions.push('p.cliente_id = ?');
      params.push(parseInt(cliente_id));
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM processos p
      ${whereClause}
    `;
    
    const { total } = await db.get(countQuery, params);
    
    // Buscar registros com paginação
    const query = `
      SELECT 
        p.*,
        c.nome as cliente_nome,
        c.cpf as cliente_cpf
      FROM processos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      ${whereClause}
      ORDER BY p.${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = await db.all(query, [...params, limit, offset]);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Processos listados com sucesso',
      data: {
        items,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar processos:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar processos'
    });
  }
}

// Buscar processo por ID com movimentações
async function getById(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Buscar processo com dados do cliente
    const processo = await db.get(
      `SELECT 
        p.*,
        c.nome as cliente_nome,
        c.cpf as cliente_cpf,
        c.email as cliente_email,
        c.whatsapp as cliente_whatsapp
      FROM processos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = ?`,
      [id]
    );
    
    if (!processo) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    // Buscar movimentações do processo
    const movimentacoes = await db.all(
      `SELECT * FROM movimentacoes
       WHERE processo_id = ?
       ORDER BY data_movimentacao DESC`,
      [id]
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Processo encontrado com sucesso',
      data: {
        processo,
        movimentacoes
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar processo:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar processo'
    });
  }
}

// Criar novo processo
async function create(req, res) {
  const db = new Database();
  
  try {
    const {
      numero_processo,
      titulo,
      descricao,
      autor,
      reu,
      status,
      tipo_acao,
      valor_causa,
      data_distribuicao,
      vara,
      comarca,
      advogado_autor,
      advogado_reu,
      observacoes,
      cliente_id
    } = req.body;
    
    // Validar campos obrigatórios
    if (!numero_processo || !titulo || !autor || !reu || !status) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: numero_processo, titulo, autor, reu, status'
      });
    }
    
    // Validar formato do número do processo
    if (!validarNumeroProcesso(numero_processo)) {
      return res.status(400).json({
        success: false,
        message: 'Número do processo inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)'
      });
    }
    
    // Validar status
    const statusValidos = ['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status inválido. Valores permitidos: ${statusValidos.join(', ')}`
      });
    }
    
    await db.connect();
    
    // Verificar se número do processo já existe
    const processoExistente = await db.get(
      'SELECT id FROM processos WHERE numero_processo = ?',
      [sanitizarInput(numero_processo)]
    );
    
    if (processoExistente) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: 'Número do processo já cadastrado'
      });
    }
    
    // Verificar se cliente_id existe (se fornecido)
    if (cliente_id) {
      const cliente = await db.get(
        'SELECT id FROM clientes WHERE id = ?',
        [parseInt(cliente_id)]
      );
      
      if (!cliente) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }
    }
    
    // Formatar número do processo
    const numeroFormatado = formatarNumeroProcesso(numero_processo);
    
    // Inserir processo
    const result = await db.run(
      `INSERT INTO processos (
        numero_processo, titulo, descricao, autor, reu, status,
        tipo_acao, valor_causa, data_distribuicao, data_ultima_movimentacao,
        vara, comarca, advogado_autor, advogado_reu, observacoes, cliente_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numeroFormatado,
        sanitizarInput(titulo),
        sanitizarInput(descricao),
        sanitizarInput(autor),
        sanitizarInput(reu),
        status,
        sanitizarInput(tipo_acao),
        valor_causa ? parseFloat(valor_causa) : null,
        data_distribuicao || null,
        data_distribuicao || null,
        sanitizarInput(vara),
        sanitizarInput(comarca),
        sanitizarInput(advogado_autor),
        sanitizarInput(advogado_reu),
        sanitizarInput(observacoes),
        cliente_id ? parseInt(cliente_id) : null
      ]
    );
    
    // Buscar processo criado
    const processoNovo = await db.get(
      'SELECT * FROM processos WHERE id = ?',
      [result.lastID]
    );
    
    await auditLog(req, 'processo_criado', { processo_id: result.lastID, numero_processo: numeroFormatado });
    await db.close();
    
    return res.status(201).json({
      success: true,
      message: 'Processo criado com sucesso',
      data: processoNovo
    });
    
  } catch (error) {
    console.error('Erro ao criar processo:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar processo'
    });
  }
}

// Atualizar processo
async function update(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const {
      numero_processo,
      titulo,
      descricao,
      autor,
      reu,
      status,
      tipo_acao,
      valor_causa,
      data_distribuicao,
      vara,
      comarca,
      advogado_autor,
      advogado_reu,
      observacoes,
      cliente_id
    } = req.body;
    
    await db.connect();
    
    // Verificar se processo existe
    const processoExistente = await db.get(
      'SELECT * FROM processos WHERE id = ?',
      [id]
    );
    
    if (!processoExistente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    // Validar campos obrigatórios se fornecidos
    if (titulo !== undefined && !titulo) {
      return res.status(400).json({
        success: false,
        message: 'Título não pode ser vazio'
      });
    }
    
    if (autor !== undefined && !autor) {
      return res.status(400).json({
        success: false,
        message: 'Autor não pode ser vazio'
      });
    }
    
    if (reu !== undefined && !reu) {
      return res.status(400).json({
        success: false,
        message: 'Réu não pode ser vazio'
      });
    }
    
    // Validar status se fornecido
    if (status !== undefined) {
      const statusValidos = ['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'];
      if (!statusValidos.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status inválido. Valores permitidos: ${statusValidos.join(', ')}`
        });
      }
    }
    
    // Validar número do processo se fornecido
    if (numero_processo !== undefined && numero_processo !== processoExistente.numero_processo) {
      if (!validarNumeroProcesso(numero_processo)) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: 'Número do processo inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)'
        });
      }
      
      // Verificar unicidade
      const numeroExiste = await db.get(
        'SELECT id FROM processos WHERE numero_processo = ? AND id != ?',
        [sanitizarInput(numero_processo), id]
      );
      
      if (numeroExiste) {
        await db.close();
        return res.status(409).json({
          success: false,
          message: 'Número do processo já cadastrado'
        });
      }
    }
    
    // Verificar se cliente_id existe (se fornecido)
    if (cliente_id) {
      const cliente = await db.get(
        'SELECT id FROM clientes WHERE id = ?',
        [parseInt(cliente_id)]
      );
      
      if (!cliente) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }
    }
    
    // Construir update dinamicamente
    const updates = [];
    const params = [];
    
    if (numero_processo !== undefined) {
      updates.push('numero_processo = ?');
      params.push(formatarNumeroProcesso(numero_processo));
    }
    if (titulo !== undefined) {
      updates.push('titulo = ?');
      params.push(sanitizarInput(titulo));
    }
    if (descricao !== undefined) {
      updates.push('descricao = ?');
      params.push(sanitizarInput(descricao));
    }
    if (autor !== undefined) {
      updates.push('autor = ?');
      params.push(sanitizarInput(autor));
    }
    if (reu !== undefined) {
      updates.push('reu = ?');
      params.push(sanitizarInput(reu));
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (tipo_acao !== undefined) {
      updates.push('tipo_acao = ?');
      params.push(sanitizarInput(tipo_acao));
    }
    if (valor_causa !== undefined) {
      updates.push('valor_causa = ?');
      params.push(valor_causa ? parseFloat(valor_causa) : null);
    }
    if (data_distribuicao !== undefined) {
      updates.push('data_distribuicao = ?');
      params.push(data_distribuicao || null);
    }
    if (vara !== undefined) {
      updates.push('vara = ?');
      params.push(sanitizarInput(vara));
    }
    if (comarca !== undefined) {
      updates.push('comarca = ?');
      params.push(sanitizarInput(comarca));
    }
    if (advogado_autor !== undefined) {
      updates.push('advogado_autor = ?');
      params.push(sanitizarInput(advogado_autor));
    }
    if (advogado_reu !== undefined) {
      updates.push('advogado_reu = ?');
      params.push(sanitizarInput(advogado_reu));
    }
    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      params.push(sanitizarInput(observacoes));
    }
    if (cliente_id !== undefined) {
      updates.push('cliente_id = ?');
      params.push(cliente_id ? parseInt(cliente_id) : null);
    }
    
    if (updates.length === 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }
    
    updates.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(id);
    
    // Atualizar processo
    await db.run(
      `UPDATE processos SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Buscar processo atualizado
    const processoAtualizado = await db.get(
      'SELECT * FROM processos WHERE id = ?',
      [id]
    );
    
    await auditLog(req, 'processo_atualizado', { processo_id: id });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Processo atualizado com sucesso',
      data: processoAtualizado
    });
    
  } catch (error) {
    console.error('Erro ao atualizar processo:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar processo'
    });
  }
}

// Excluir processo
async function deleteProcesso(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Verificar se processo existe
    const processo = await db.get(
      'SELECT * FROM processos WHERE id = ?',
      [id]
    );
    
    if (!processo) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    // Verificar se há movimentações (para decisão de negócio)
    const movimentacoes = await db.get(
      'SELECT COUNT(*) as total FROM movimentacoes WHERE processo_id = ?',
      [id]
    );
    
    // Deletar processo (CASCADE deletará as movimentações automaticamente)
    await db.run('DELETE FROM processos WHERE id = ?', [id]);
    
    await auditLog(req, 'processo_excluido', { 
      processo_id: id,
      numero_processo: processo.numero_processo,
      movimentacoes_excluidas: movimentacoes.total
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Processo excluído com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir processo:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir processo'
    });
  }
}

// Busca avançada com múltiplos filtros
async function search(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'criado_em',
      sortOrder = 'DESC',
      query: searchQuery,
      status,
      tipo_acao,
      data_inicio,
      data_fim,
      cliente_id,
      valor_min,
      valor_max
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy
    const allowedSortFields = ['id', 'numero_processo', 'titulo', 'status', 'autor', 'reu', 'data_distribuicao', 'criado_em', 'atualizado_em', 'valor_causa'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'criado_em';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Construir query com filtros avançados
    const whereConditions = [];
    const params = [];
    
    // Busca textual em múltiplos campos
    if (searchQuery) {
      whereConditions.push(
        '(p.numero_processo LIKE ? OR p.titulo LIKE ? OR p.descricao LIKE ? OR p.autor LIKE ? OR p.reu LIKE ?)'
      );
      const searchTerm = `%${sanitizarInput(searchQuery)}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (status) {
      whereConditions.push('p.status = ?');
      params.push(sanitizarInput(status));
    }
    
    if (tipo_acao) {
      whereConditions.push('p.tipo_acao LIKE ?');
      params.push(`%${sanitizarInput(tipo_acao)}%`);
    }
    
    if (data_inicio) {
      whereConditions.push('p.data_distribuicao >= ?');
      params.push(data_inicio);
    }
    
    if (data_fim) {
      whereConditions.push('p.data_distribuicao <= ?');
      params.push(data_fim);
    }
    
    if (cliente_id) {
      whereConditions.push('p.cliente_id = ?');
      params.push(parseInt(cliente_id));
    }
    
    if (valor_min) {
      whereConditions.push('p.valor_causa >= ?');
      params.push(parseFloat(valor_min));
    }
    
    if (valor_max) {
      whereConditions.push('p.valor_causa <= ?');
      params.push(parseFloat(valor_max));
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM processos p
      ${whereClause}
    `;
    
    const { total } = await db.get(countQuery, params);
    
    // Buscar registros com paginação
    const query = `
      SELECT 
        p.*,
        c.nome as cliente_nome,
        c.cpf as cliente_cpf
      FROM processos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      ${whereClause}
      ORDER BY p.${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = await db.all(query, [...params, limit, offset]);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Busca realizada com sucesso',
      data: {
        items,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro na busca de processos:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro na busca de processos'
    });
  }
}

// Obter estatísticas para dashboard
async function getStats(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Total de processos
    const { total } = await db.get('SELECT COUNT(*) as total FROM processos');
    
    // Processos por status
    const porStatus = await db.all(
      `SELECT status, COUNT(*) as count
       FROM processos
       GROUP BY status
       ORDER BY count DESC`
    );
    
    // Processos recentes (últimos 30 dias)
    const recentCount = await db.get(
      `SELECT COUNT(*) as count
       FROM processos
       WHERE criado_em >= datetime('now', '-30 days')`
    );
    
    // Processos com movimentações recentes (últimos 7 dias)
    const recentActivityCount = await db.get(
      `SELECT COUNT(DISTINCT processo_id) as count
       FROM movimentacoes
       WHERE criado_em >= datetime('now', '-7 days')`
    );
    
    // Processos por cliente (top 10)
    const porCliente = await db.all(
      `SELECT 
        c.id,
        c.nome,
        COUNT(p.id) as count
       FROM clientes c
       LEFT JOIN processos p ON p.cliente_id = c.id
       WHERE p.id IS NOT NULL
       GROUP BY c.id, c.nome
       ORDER BY count DESC
       LIMIT 10`
    );
    
    // Valor total de causas
    const { valorTotal } = await db.get(
      `SELECT COALESCE(SUM(valor_causa), 0) as valorTotal
       FROM processos
       WHERE valor_causa IS NOT NULL`
    );
    
    // Média de valor de causa
    const { valorMedio } = await db.get(
      `SELECT COALESCE(AVG(valor_causa), 0) as valorMedio
       FROM processos
       WHERE valor_causa IS NOT NULL`
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Estatísticas obtidas com sucesso',
      data: {
        total,
        porStatus: porStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        recentCount: recentCount.count,
        recentActivityCount: recentActivityCount.count,
        porCliente,
        valorTotal,
        valorMedio
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas'
    });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deleteProcesso,
  search,
  getStats
};
