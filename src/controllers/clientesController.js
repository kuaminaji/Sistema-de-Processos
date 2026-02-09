const { Database } = require('../database/init');
const { validarCPF, formatarCPF, validarEmail, formatarTelefoneWhatsApp, sanitizarInput } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

// Listar clientes com paginação e filtros
async function list(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'criado_em',
      sortOrder = 'DESC',
      nome,
      cpf
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy para prevenir SQL injection
    const allowedSortFields = ['id', 'nome', 'cpf', 'email', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'criado_em';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Construir query com filtros
    let whereConditions = [];
    let params = [];
    
    if (nome) {
      whereConditions.push('nome LIKE ?');
      params.push(`%${sanitizarInput(nome)}%`);
    }
    
    if (cpf) {
      const cpfLimpo = cpf.replace(/[^\d]/g, '');
      whereConditions.push('cpf LIKE ?');
      params.push(`%${cpfLimpo}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clientes
      ${whereClause}
    `;
    
    const { total } = await db.get(countQuery, params);
    
    // Buscar registros com paginação
    const query = `
      SELECT *
      FROM clientes
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const items = await db.all(query, [...params, limit, offset]);
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Clientes listados com sucesso',
      data: {
        items,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar clientes'
    });
  }
}

// Buscar cliente por ID com processos associados
async function getById(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Buscar cliente
    const cliente = await db.get(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    );
    
    if (!cliente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
    
    // Buscar processos associados ao cliente
    const processos = await db.all(
      `SELECT id, numero_processo, titulo, status, data_distribuicao, criado_em
       FROM processos
       WHERE cliente_id = ?
       ORDER BY criado_em DESC`,
      [id]
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Cliente encontrado com sucesso',
      data: {
        cliente,
        processos
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar cliente'
    });
  }
}

// Criar novo cliente
async function create(req, res) {
  const db = new Database();
  
  try {
    const {
      nome,
      cpf,
      email,
      whatsapp,
      telefone_secundario,
      endereco,
      observacoes
    } = req.body;
    
    // Validar campos obrigatórios
    if (!nome || !cpf) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: nome, cpf'
      });
    }
    
    // Validar CPF
    if (!validarCPF(cpf)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido'
      });
    }
    
    // Validar email se fornecido
    if (email && !validarEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
    
    await db.connect();
    
    // Verificar se CPF já existe
    const cpfFormatado = formatarCPF(cpf);
    const cpfLimpo = cpf.replace(/[^\d]/g, '');
    
    const clienteExistente = await db.get(
      'SELECT id FROM clientes WHERE cpf = ? OR cpf = ?',
      [cpfFormatado, cpfLimpo]
    );
    
    if (clienteExistente) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: 'CPF já cadastrado'
      });
    }
    
    // Formatar telefones
    const whatsappFormatado = whatsapp ? formatarTelefoneWhatsApp(whatsapp) : null;
    const telefoneSecundarioFormatado = telefone_secundario ? formatarTelefoneWhatsApp(telefone_secundario) : null;
    
    // Inserir cliente
    const result = await db.run(
      `INSERT INTO clientes (
        nome, cpf, email, whatsapp, telefone_secundario, endereco, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarInput(nome),
        cpfFormatado,
        email ? sanitizarInput(email) : null,
        whatsappFormatado,
        telefoneSecundarioFormatado,
        sanitizarInput(endereco),
        sanitizarInput(observacoes)
      ]
    );
    
    // Buscar cliente criado
    const clienteNovo = await db.get(
      'SELECT * FROM clientes WHERE id = ?',
      [result.lastID]
    );
    
    await auditLog(req, 'cliente_criado', { cliente_id: result.lastID, cpf: cpfFormatado });
    await db.close();
    
    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      data: clienteNovo
    });
    
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente'
    });
  }
}

// Atualizar cliente
async function update(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    const {
      nome,
      cpf,
      email,
      whatsapp,
      telefone_secundario,
      endereco,
      observacoes
    } = req.body;
    
    await db.connect();
    
    // Verificar se cliente existe
    const clienteExistente = await db.get(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    );
    
    if (!clienteExistente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
    
    // Validar nome se fornecido
    if (nome !== undefined && !nome) {
      return res.status(400).json({
        success: false,
        message: 'Nome não pode ser vazio'
      });
    }
    
    // Validar CPF se fornecido e diferente do atual
    if (cpf !== undefined && cpf !== clienteExistente.cpf) {
      if (!validarCPF(cpf)) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: 'CPF inválido'
        });
      }
      
      const cpfFormatado = formatarCPF(cpf);
      const cpfLimpo = cpf.replace(/[^\d]/g, '');
      
      // Verificar unicidade
      const cpfExiste = await db.get(
        'SELECT id FROM clientes WHERE (cpf = ? OR cpf = ?) AND id != ?',
        [cpfFormatado, cpfLimpo, id]
      );
      
      if (cpfExiste) {
        await db.close();
        return res.status(409).json({
          success: false,
          message: 'CPF já cadastrado'
        });
      }
    }
    
    // Validar email se fornecido
    if (email !== undefined && email && !validarEmail(email)) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
    
    // Construir update dinamicamente
    const updates = [];
    const params = [];
    
    if (nome !== undefined) {
      updates.push('nome = ?');
      params.push(sanitizarInput(nome));
    }
    if (cpf !== undefined) {
      updates.push('cpf = ?');
      params.push(formatarCPF(cpf));
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email ? sanitizarInput(email) : null);
    }
    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      params.push(whatsapp ? formatarTelefoneWhatsApp(whatsapp) : null);
    }
    if (telefone_secundario !== undefined) {
      updates.push('telefone_secundario = ?');
      params.push(telefone_secundario ? formatarTelefoneWhatsApp(telefone_secundario) : null);
    }
    if (endereco !== undefined) {
      updates.push('endereco = ?');
      params.push(sanitizarInput(endereco));
    }
    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      params.push(sanitizarInput(observacoes));
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
    
    // Atualizar cliente
    await db.run(
      `UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Buscar cliente atualizado
    const clienteAtualizado = await db.get(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    );
    
    await auditLog(req, 'cliente_atualizado', { cliente_id: id });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: clienteAtualizado
    });
    
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar cliente'
    });
  }
}

// Excluir cliente
async function deleteCliente(req, res) {
  const db = new Database();
  
  try {
    const { id } = req.params;
    
    await db.connect();
    
    // Verificar se cliente existe
    const cliente = await db.get(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    );
    
    if (!cliente) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
    
    // Verificar se há processos associados
    const processos = await db.get(
      'SELECT COUNT(*) as total FROM processos WHERE cliente_id = ?',
      [id]
    );
    
    if (processos.total > 0) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: `Não é possível excluir cliente com ${processos.total} processo(s) associado(s). Remova ou reatribua os processos primeiro.`
      });
    }
    
    // Deletar cliente
    await db.run('DELETE FROM clientes WHERE id = ?', [id]);
    
    await auditLog(req, 'cliente_excluido', { 
      cliente_id: id,
      cpf: cliente.cpf,
      nome: cliente.nome
    });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Cliente excluído com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir cliente'
    });
  }
}

// Busca avançada de clientes
async function search(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 10,
      sortBy = 'nome',
      sortOrder = 'ASC',
      query: searchQuery
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy
    const allowedSortFields = ['id', 'nome', 'cpf', 'email', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'nome';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Construir query de busca
    const whereConditions = [];
    const params = [];
    
    if (searchQuery) {
      const cpfLimpo = searchQuery.replace(/[^\d]/g, '');
      whereConditions.push(
        '(nome LIKE ? OR cpf LIKE ? OR email LIKE ? OR whatsapp LIKE ?)'
      );
      const searchTerm = `%${sanitizarInput(searchQuery)}%`;
      params.push(searchTerm, `%${cpfLimpo}%`, searchTerm, `%${cpfLimpo}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clientes
      ${whereClause}
    `;
    
    const { total } = await db.get(countQuery, params);
    
    // Buscar registros com paginação
    const query = `
      SELECT *
      FROM clientes
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
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
    console.error('Erro na busca de clientes:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro na busca de clientes'
    });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deleteCliente,
  search
};
