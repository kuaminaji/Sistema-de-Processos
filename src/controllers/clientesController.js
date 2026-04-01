const { Database } = require('../database/init');
const {
  validarDocumento,
  formatarDocumento,
  validarEmail,
  formatarTelefoneWhatsApp,
  sanitizarInput,
  normalizarDocumento
} = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

function mapCliente(cliente) {
  if (!cliente) return cliente;

  return {
    ...cliente,
    documento: cliente.cpf,
    tipo_documento: cliente.tipo_documento || 'CPF'
  };
}

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
      documento,
      cpf,
      tipo_documento
    } = req.query;

    const limit = Math.min(parseInt(perPage, 10), 100);
    const offset = (parseInt(page, 10) - 1) * limit;
    const allowedSortFields = ['id', 'nome', 'cpf', 'tipo_documento', 'email', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'criado_em';
    const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ?'ASC' : 'DESC';

    const whereConditions = [];
    const params = [];

    if (nome) {
      whereConditions.push('nome LIKE ?');
      params.push(`%${sanitizarInput(nome)}%`);
    }

    const documentoBusca = documento || cpf;
    if (documentoBusca) {
      whereConditions.push("REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?");
      params.push(`%${normalizarDocumento(documentoBusca)}%`);
    }

    if (tipo_documento) {
      whereConditions.push('tipo_documento = ?');
      params.push(String(tipo_documento).toUpperCase());
    }

    const whereClause = whereConditions.length ?`WHERE ${whereConditions.join(' AND ')}` : '';
    const countRow = await db.get(`SELECT COUNT(*) as total FROM clientes ${whereClause}`, params);
    const items = await db.all(
      `SELECT *
       FROM clientes
       ${whereClause}
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT ?OFFSET ?`,
      [...params, limit, offset]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Clientes listados com sucesso',
      data: {
        items: items.map(mapCliente),
        total: countRow.total,
        page: parseInt(page, 10),
        perPage: limit,
        totalPages: Math.ceil(countRow.total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao listar clientes' });
  }
}

async function getById(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);

    if (!cliente) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Cliente n?o encontrado' });
    }

    const processos = await db.all(
      `SELECT DISTINCT p.id, p.numero_processo, p.titulo, p.status, p.data_distribuicao, p.criado_em
       FROM processos p
       INNER JOIN processo_clientes pc ON pc.processo_id = p.id
       WHERE pc.cliente_id = ?
       ORDER BY p.criado_em DESC`,
      [req.params.id]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Cliente encontrado com sucesso',
      data: {
        cliente: mapCliente(cliente),
        processos
      }
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao buscar cliente' });
  }
}

async function create(req, res) {
  const db = new Database();

  try {
    const {
      nome,
      documento,
      cpf,
      tipo_documento,
      email,
      whatsapp,
      telefone_secundario,
      endereco,
      observacoes
    } = req.body;

    const documentoInformado = documento || cpf;
    if (!nome || !documentoInformado) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigat?rios: nome e documento'
      });
    }

    const validacaoDocumento = validarDocumento(documentoInformado, tipo_documento);
    if (!validacaoDocumento.valido) {
      return res.status(400).json({ success: false, message: validacaoDocumento.mensagem });
    }

    if (email && !validarEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email inv?lido' });
    }

    await db.connect();

    const documentoFormatado = formatarDocumento(validacaoDocumento.documento, validacaoDocumento.tipo);
    const clienteExistente = await db.get(
      `SELECT id
       FROM clientes
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?`,
      [validacaoDocumento.documento]
    );

    if (clienteExistente) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: `${validacaoDocumento.tipo} j?cadastrado`
      });
    }

    const result = await db.run(
      `INSERT INTO clientes (
        nome, cpf, tipo_documento, email, whatsapp, telefone_secundario, endereco, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizarInput(nome),
        documentoFormatado,
        validacaoDocumento.tipo,
        email ?sanitizarInput(email) : null,
        whatsapp ?formatarTelefoneWhatsApp(whatsapp) : null,
        telefone_secundario ?formatarTelefoneWhatsApp(telefone_secundario) : null,
        endereco ?sanitizarInput(endereco) : null,
        observacoes ?sanitizarInput(observacoes) : null
      ]
    );

    const clienteNovo = await db.get('SELECT * FROM clientes WHERE id = ?', [result.lastID]);
    await auditLog(req, 'cliente_criado', { cliente_id: result.lastID, documento: documentoFormatado });
    await db.close();

    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      data: mapCliente(clienteNovo)
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao criar cliente' });
  }
}

async function update(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const clienteExistente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!clienteExistente) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Cliente n?o encontrado' });
    }

    const {
      nome,
      documento,
      cpf,
      tipo_documento,
      email,
      whatsapp,
      telefone_secundario,
      endereco,
      observacoes
    } = req.body;

    const updates = [];
    const params = [];

    if (nome !== undefined) {
      if (!nome) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Nome n?o pode ser vazio' });
      }
      updates.push('nome = ?');
      params.push(sanitizarInput(nome));
    }

    const documentoInformado = documento || cpf;
    if (documentoInformado !== undefined) {
      const validacaoDocumento = validarDocumento(documentoInformado, tipo_documento || clienteExistente.tipo_documento);
      if (!validacaoDocumento.valido) {
        await db.close();
        return res.status(400).json({ success: false, message: validacaoDocumento.mensagem });
      }

      const duplicado = await db.get(
        `SELECT id FROM clientes
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?
         AND id != ?`,
        [validacaoDocumento.documento, req.params.id]
      );

      if (duplicado) {
        await db.close();
        return res.status(409).json({ success: false, message: `${validacaoDocumento.tipo} j?cadastrado` });
      }

      updates.push('cpf = ?');
      params.push(formatarDocumento(validacaoDocumento.documento, validacaoDocumento.tipo));
      updates.push('tipo_documento = ?');
      params.push(validacaoDocumento.tipo);
    } else if (tipo_documento !== undefined) {
      const validacaoDocumento = validarDocumento(clienteExistente.cpf, tipo_documento);
      if (!validacaoDocumento.valido) {
        await db.close();
        return res.status(400).json({ success: false, message: validacaoDocumento.mensagem });
      }
      updates.push('tipo_documento = ?');
      params.push(validacaoDocumento.tipo);
      updates.push('cpf = ?');
      params.push(formatarDocumento(clienteExistente.cpf, validacaoDocumento.tipo));
    }

    if (email !== undefined) {
      if (email && !validarEmail(email)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Email inv?lido' });
      }
      updates.push('email = ?');
      params.push(email ?sanitizarInput(email) : null);
    }

    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      params.push(whatsapp ?formatarTelefoneWhatsApp(whatsapp) : null);
    }

    if (telefone_secundario !== undefined) {
      updates.push('telefone_secundario = ?');
      params.push(telefone_secundario ?formatarTelefoneWhatsApp(telefone_secundario) : null);
    }

    if (endereco !== undefined) {
      updates.push('endereco = ?');
      params.push(endereco ?sanitizarInput(endereco) : null);
    }

    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      params.push(observacoes ?sanitizarInput(observacoes) : null);
    }

    if (!updates.length) {
      await db.close();
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    updates.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await db.run(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, params);
    const clienteAtualizado = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    await auditLog(req, 'cliente_atualizado', { cliente_id: req.params.id });
    await db.close();

    return res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: mapCliente(clienteAtualizado)
    });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao atualizar cliente' });
  }
}

async function deleteCliente(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Cliente n?o encontrado' });
    }

    const processos = await db.get(
      'SELECT COUNT(*) as total FROM processo_clientes WHERE cliente_id = ?',
      [req.params.id]
    );
    if (processos.total > 0) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: `N?o ?poss?vel excluir cliente com ${processos.total} processo(s) associado(s).`
      });
    }

    await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    await auditLog(req, 'cliente_excluido', { cliente_id: req.params.id, documento: cliente.cpf });
    await db.close();
    return res.json({ success: true, message: 'Cliente exclu?do com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao excluir cliente' });
  }
}

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

    const limit = Math.min(parseInt(perPage, 10), 100);
    const offset = (parseInt(page, 10) - 1) * limit;
    const allowedSortFields = ['id', 'nome', 'cpf', 'tipo_documento', 'email', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'nome';
    const validSortOrder = String(sortOrder).toUpperCase() === 'DESC' ?'DESC' : 'ASC';

    const params = [];
    let whereClause = '';

    if (searchQuery) {
      const documentoBusca = normalizarDocumento(searchQuery);
      const termo = `%${sanitizarInput(searchQuery)}%`;
      whereClause = `
        WHERE (
          nome LIKE ?
          OR email LIKE ?
          OR whatsapp LIKE ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?
        )
      `;
      params.push(termo, termo, `%${documentoBusca}%`, `%${documentoBusca}%`);
    }

    const countRow = await db.get(`SELECT COUNT(*) as total FROM clientes ${whereClause}`, params);
    const items = await db.all(
      `SELECT * FROM clientes
       ${whereClause}
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT ?OFFSET ?`,
      [...params, limit, offset]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Busca realizada com sucesso',
      data: {
        items: items.map(mapCliente),
        total: countRow.total,
        page: parseInt(page, 10),
        perPage: limit,
        totalPages: Math.ceil(countRow.total / limit)
      }
    });
  } catch (error) {
    console.error('Erro na busca de clientes:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro na busca de clientes' });
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
