const fs = require('fs');
const path = require('path');
const { Database } = require('../database/init');
const {
  validarNumeroProcesso,
  formatarNumeroProcesso,
  sanitizarInput,
  normalizarDocumento
} = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');
const { toStoredUploadPath, resolveStoredUploadPath } = require('../utils/storagePaths');

const STATUS_VALIDOS = ['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'];
const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta', 'urgente'];
const DOCUMENT_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '')";

function normalizeClientRecord(cliente) {
  if (!cliente) return null;

  return {
    ...cliente,
    documento: cliente.documento || cliente.cpf,
    tipo_documento: cliente.tipo_documento || 'CPF'
  };
}

function buildClienteResumo(clientes = [], processo = {}) {
  const lista = clientes.map(normalizeClientRecord).filter(Boolean);

  if (lista.length) {
    return {
      cliente_id: lista[0].id || null,
      cliente_nome: lista[0].nome || null,
      cliente_nomes: lista.map((cliente) => cliente.nome).join(' | '),
      cliente_documento: lista[0].documento || null,
      cliente_documentos: lista.map((cliente) => cliente.documento).join(' | '),
      cliente_tipo_documento: lista[0].tipo_documento || null,
      total_clientes: lista.length
    };
  }

  const fallbackDocumento = processo.cliente_documento || processo.cliente_cpf || null;
  return {
    cliente_id: processo.cliente_id || null,
    cliente_nome: processo.cliente_nome || null,
    cliente_nomes: processo.cliente_nomes || processo.cliente_nome || null,
    cliente_documento: fallbackDocumento,
    cliente_documentos: processo.cliente_documentos || fallbackDocumento,
    cliente_tipo_documento: processo.cliente_tipo_documento || null,
    total_clientes: Number(processo.total_clientes || (processo.cliente_nome ?1 : 0))
  };
}

function mapProcesso(processo, clientes = null) {
  if (!processo) return processo;

  const listaClientes = Array.isArray(clientes)
    ?clientes.map(normalizeClientRecord).filter(Boolean)
    : Array.isArray(processo.clientes)
      ?processo.clientes.map(normalizeClientRecord).filter(Boolean)
      : [];

  return {
    ...processo,
    ...buildClienteResumo(listaClientes, processo),
    clientes: listaClientes
  };
}

function mapAnexo(anexo) {
  if (!anexo) return anexo;

  return {
    ...anexo,
    url: `/uploads/${encodeURIComponent(anexo.nome_arquivo)}`
  };
}

function mapTempAnexo(anexo) {
  if (!anexo) return anexo;

  return {
    ...anexo,
    status: 'temporario'
  };
}

function parseClienteDocumentos(value) {
  if (value === undefined) return [];
  if (value === null || value === '') return [];

  let documentos = value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      documentos = Array.isArray(parsed) ?parsed : [value];
    } catch (error) {
      documentos = [value];
    }
  }

  if (!Array.isArray(documentos)) {
    documentos = [documentos];
  }

  return [...new Set(
    documentos
      .map((documento) => normalizarDocumento(documento))
      .filter(Boolean)
  )];
}

async function getClientesMapByProcessos(db, processoIds) {
  const ids = [...new Set((processoIds || []).map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT
       pc.processo_id,
       c.id,
       c.nome,
       c.cpf,
       c.tipo_documento,
       c.email,
       c.whatsapp
     FROM processo_clientes pc
     INNER JOIN clientes c ON c.id = pc.cliente_id
     WHERE pc.processo_id IN (${placeholders})
     ORDER BY pc.processo_id ASC, c.nome ASC`,
    ids
  );

  const mapa = new Map();
  rows.forEach((row) => {
    if (!mapa.has(row.processo_id)) {
      mapa.set(row.processo_id, []);
    }
    mapa.get(row.processo_id).push(normalizeClientRecord(row));
  });

  return mapa;
}

async function attachClientesToProcessos(db, processos) {
  if (!processos.length) return [];

  const mapa = await getClientesMapByProcessos(db, processos.map((processo) => processo.id));
  return processos.map((processo) => mapProcesso(processo, mapa.get(processo.id) || []));
}

async function getClientesByProcesso(db, processoId) {
  const mapa = await getClientesMapByProcessos(db, [processoId]);
  return mapa.get(Number(processoId)) || [];
}

async function resolveClientesVinculados(db, body) {
  const hasClienteDocumentos = Object.prototype.hasOwnProperty.call(body, 'cliente_documentos');
  const hasClienteId = Object.prototype.hasOwnProperty.call(body, 'cliente_id');

  if (!hasClienteDocumentos && !hasClienteId) {
    return { shouldSync: false, clienteIds: [] };
  }

  const clienteDocumentos = parseClienteDocumentos(body.cliente_documentos);

  if (clienteDocumentos.length) {
    const placeholders = clienteDocumentos.map(() => '?').join(', ');
    const clientes = await db.all(
      `SELECT id, nome, cpf, tipo_documento
       FROM clientes
       WHERE ${DOCUMENT_SQL} IN (${placeholders})`,
      clienteDocumentos
    );

    const clientesPorDocumento = new Map(
      clientes.map((cliente) => [normalizarDocumento(cliente.cpf), normalizeClientRecord(cliente)])
    );
    const faltantes = clienteDocumentos.filter((documento) => !clientesPorDocumento.has(documento));

    if (faltantes.length) {
      throw new Error(`Cliente n?o encontrado para o(s) documento(s): ${faltantes.join(', ')}`);
    }

    return {
      shouldSync: true,
      clienteIds: clienteDocumentos.map((documento) => clientesPorDocumento.get(documento).id),
      clientes: clienteDocumentos.map((documento) => clientesPorDocumento.get(documento))
    };
  }

  if (body.cliente_id) {
    const cliente = await db.get('SELECT id, nome, cpf, tipo_documento FROM clientes WHERE id = ?', [parseInt(body.cliente_id, 10)]);
    if (!cliente) {
      throw new Error('Cliente n?o encontrado');
    }

    return {
      shouldSync: true,
      clienteIds: [cliente.id],
      clientes: [normalizeClientRecord(cliente)]
    };
  }

  return {
    shouldSync: true,
    clienteIds: [],
    clientes: []
  };
}

async function syncProcessoClientes(db, processoId, clienteIds) {
  const ids = [...new Set((clienteIds || []).map((id) => Number(id)).filter(Boolean))];

  await db.run('DELETE FROM processo_clientes WHERE processo_id = ?', [processoId]);
  for (const clienteId of ids) {
    await db.run(
      'INSERT OR IGNORE INTO processo_clientes (processo_id, cliente_id) VALUES (?, ?)',
      [processoId, clienteId]
    );
  }

  await db.run(
    'UPDATE processos SET cliente_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
    [ids[0] || null, processoId]
  );
}

async function finalizeTempAnexos(db, sessaoId, processoId, usuarioId) {
  if (!sessaoId) return { total: 0 };

  const anexosTemporarios = await db.all(
    `SELECT *
     FROM anexos_temporarios_processo
     WHERE sessao_id = ?
     ORDER BY criado_em ASC`,
    [sessaoId]
  );

  for (const anexo of anexosTemporarios) {
    await db.run(
      `INSERT INTO anexos_processo (
        processo_id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_por_usuario_id, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        processoId,
        anexo.nome_original,
        anexo.nome_arquivo,
        anexo.caminho_relativo,
        anexo.mime_type,
        anexo.tamanho_bytes,
        usuarioId || anexo.criado_por_usuario_id || null,
        anexo.criado_em
      ]
    );
  }

  await db.run('DELETE FROM anexos_temporarios_processo WHERE sessao_id = ?', [sessaoId]);
  return { total: anexosTemporarios.length };
}

async function removeTempAttachmentFiles(db, sessaoId, anexoId = null) {
  const params = [sessaoId];
  let where = 'WHERE sessao_id = ?';

  if (anexoId !== null) {
    where += ' AND id = ?';
    params.push(anexoId);
  }

  const anexos = await db.all(
    `SELECT id, caminho_relativo
     FROM anexos_temporarios_processo
     ${where}`,
    params
  );

  for (const anexo of anexos) {
    const absolutePath = resolveStoredUploadPath(anexo.caminho_relativo);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  if (anexoId !== null) {
    await db.run(
      'DELETE FROM anexos_temporarios_processo WHERE sessao_id = ?AND id = ?',
      [sessaoId, anexoId]
    );
  } else {
    await db.run('DELETE FROM anexos_temporarios_processo WHERE sessao_id = ?', [sessaoId]);
  }

  return anexos.length;
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
      numero,
      autor,
      reu,
      status,
      prioridade,
      cliente_id
    } = req.query;

    const limit = Math.min(parseInt(perPage, 10), 100);
    const offset = (parseInt(page, 10) - 1) * limit;
    const allowedSortFields = ['id', 'numero_processo', 'titulo', 'status', 'prioridade', 'autor', 'reu', 'data_distribuicao', 'prazo_final', 'criado_em', 'atualizado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'criado_em';
    const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ?'ASC' : 'DESC';

    const whereConditions = [];
    const params = [];

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
    if (prioridade) {
      whereConditions.push('p.prioridade = ?');
      params.push(sanitizarInput(prioridade));
    }
    if (cliente_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM processo_clientes pc WHERE pc.processo_id = p.id AND pc.cliente_id = ?)');
      params.push(parseInt(cliente_id, 10));
    }

    const whereClause = whereConditions.length ?`WHERE ${whereConditions.join(' AND ')}` : '';
    const countRow = await db.get(`SELECT COUNT(*) as total FROM processos p ${whereClause}`, params);
    const rows = await db.all(
      `SELECT p.*
       FROM processos p
       ${whereClause}
       ORDER BY p.${validSortBy} ${validSortOrder}
       LIMIT ?OFFSET ?`,
      [...params, limit, offset]
    );

    const items = await attachClientesToProcessos(db, rows);
    await db.close();
    return res.json({
      success: true,
      message: 'Processos listados com sucesso',
      data: {
        items,
        total: countRow.total,
        page: parseInt(page, 10),
        perPage: limit,
        totalPages: Math.ceil(countRow.total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar processos:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao listar processos' });
  }
}

async function getById(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const processo = await db.get('SELECT * FROM processos WHERE id = ?', [req.params.id]);

    if (!processo) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Processo n?o encontrado' });
    }

    const clientes = await getClientesByProcesso(db, req.params.id);
    const movimentacoes = await db.all(
      'SELECT * FROM movimentacoes WHERE processo_id = ?ORDER BY data_movimentacao DESC',
      [req.params.id]
    );

    const anexos = await db.all(
      `SELECT id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_em
       FROM anexos_processo
       WHERE processo_id = ?
       ORDER BY criado_em DESC`,
      [req.params.id]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Processo encontrado com sucesso',
      data: {
        processo: mapProcesso(processo, clientes),
        movimentacoes,
        anexos: anexos.map(mapAnexo)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar processo:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao buscar processo' });
  }
}

async function create(req, res) {
  const db = new Database();
  let inTransaction = false;

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
      prazo_final,
      prioridade,
      vara,
      comarca,
      advogado_autor,
      advogado_reu,
      observacoes
    } = req.body;

    if (!numero_processo || !titulo || !autor || !reu || !status) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigat?rios: numero_processo, titulo, autor, reu, status'
      });
    }

    if (!validarNumeroProcesso(numero_processo)) {
      return res.status(400).json({
        success: false,
        message: 'N?mero do processo inv?lido. Use o formato CNJ.'
      });
    }

    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inv?lido' });
    }
    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) {
      return res.status(400).json({ success: false, message: 'Prioridade inv?lida' });
    }

    await db.connect();

    const numeroFormatado = formatarNumeroProcesso(numero_processo);
    const processoExistente = await db.get(
      'SELECT id FROM processos WHERE numero_processo = ?',
      [numeroFormatado]
    );
    if (processoExistente) {
      await db.close();
      return res.status(409).json({ success: false, message: 'N?mero do processo j?cadastrado' });
    }

    let vinculos;
    try {
      vinculos = await resolveClientesVinculados(db, req.body);
    } catch (error) {
      await db.close();
      return res.status(400).json({ success: false, message: error.message });
    }

    await db.exec('BEGIN TRANSACTION');
    inTransaction = true;

    const result = await db.run(
      `INSERT INTO processos (
        numero_processo, titulo, descricao, autor, reu, status,
        tipo_acao, valor_causa, data_distribuicao, data_ultima_movimentacao, prazo_final, prioridade,
        vara, comarca, advogado_autor, advogado_reu, observacoes, cliente_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        numeroFormatado,
        sanitizarInput(titulo),
        descricao ?sanitizarInput(descricao) : null,
        sanitizarInput(autor),
        sanitizarInput(reu),
        status,
        tipo_acao ?sanitizarInput(tipo_acao) : null,
        valor_causa ?parseFloat(valor_causa) : null,
        data_distribuicao || null,
        data_distribuicao || null,
        prazo_final || null,
        prioridade || 'media',
        vara ?sanitizarInput(vara) : null,
        comarca ?sanitizarInput(comarca) : null,
        advogado_autor ?sanitizarInput(advogado_autor) : null,
        advogado_reu ?sanitizarInput(advogado_reu) : null,
        observacoes ?sanitizarInput(observacoes) : null,
        vinculos.clienteIds?.[0] || null
      ]
    );

    await syncProcessoClientes(db, result.lastID, vinculos.clienteIds || []);
    const anexosFinalizados = await finalizeTempAnexos(
      db,
      req.sessionID,
      result.lastID,
      req.session?.usuario?.id || null
    );

    await db.exec('COMMIT');
    inTransaction = false;

    const processoNovo = await db.get('SELECT * FROM processos WHERE id = ?', [result.lastID]);
    const clientes = await getClientesByProcesso(db, result.lastID);
    await auditLog(req, 'processo_criado', {
      processo_id: result.lastID,
      numero_processo: numeroFormatado,
      total_clientes: clientes.length,
      total_anexos_temporarios: anexosFinalizados.total
    });
    await db.close();

    return res.status(201).json({
      success: true,
      message: 'Processo criado com sucesso',
      data: {
        ...mapProcesso(processoNovo, clientes),
        anexos_importados: anexosFinalizados.total
      }
    });
  } catch (error) {
    console.error('Erro ao criar processo:', error);
    if (inTransaction) {
      try { await db.exec('ROLLBACK'); } catch (rollbackError) {}
    }
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao criar processo' });
  }
}

async function update(req, res) {
  const db = new Database();
  let inTransaction = false;

  try {
    await db.connect();
    const processoExistente = await db.get('SELECT * FROM processos WHERE id = ?', [req.params.id]);
    if (!processoExistente) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Processo n?o encontrado' });
    }

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
      prazo_final,
      prioridade,
      vara,
      comarca,
      advogado_autor,
      advogado_reu,
      observacoes
    } = req.body;

    const updates = [];
    const params = [];

    if (numero_processo !== undefined) {
      if (!validarNumeroProcesso(numero_processo)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'N?mero do processo inv?lido. Use o formato CNJ.' });
      }

      const numeroFormatado = formatarNumeroProcesso(numero_processo);
      const duplicado = await db.get(
        'SELECT id FROM processos WHERE numero_processo = ?AND id != ?',
        [numeroFormatado, req.params.id]
      );

      if (duplicado) {
        await db.close();
        return res.status(409).json({ success: false, message: 'N?mero do processo j?cadastrado' });
      }

      updates.push('numero_processo = ?');
      params.push(numeroFormatado);
    }

    if (titulo !== undefined) {
      if (!titulo) {
        await db.close();
        return res.status(400).json({ success: false, message: 'T?tulo n?o pode ser vazio' });
      }
      updates.push('titulo = ?');
      params.push(sanitizarInput(titulo));
    }

    if (descricao !== undefined) {
      updates.push('descricao = ?');
      params.push(descricao ?sanitizarInput(descricao) : null);
    }
    if (autor !== undefined) {
      updates.push('autor = ?');
      params.push(autor ?sanitizarInput(autor) : null);
    }
    if (reu !== undefined) {
      updates.push('reu = ?');
      params.push(reu ?sanitizarInput(reu) : null);
    }
    if (status !== undefined) {
      if (!STATUS_VALIDOS.includes(status)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Status inv?lido' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (prioridade !== undefined) {
      if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Prioridade inv?lida' });
      }
      updates.push('prioridade = ?');
      params.push(prioridade);
    }
    if (tipo_acao !== undefined) {
      updates.push('tipo_acao = ?');
      params.push(tipo_acao ?sanitizarInput(tipo_acao) : null);
    }
    if (valor_causa !== undefined) {
      updates.push('valor_causa = ?');
      params.push(valor_causa ?parseFloat(valor_causa) : null);
    }
    if (data_distribuicao !== undefined) {
      updates.push('data_distribuicao = ?');
      params.push(data_distribuicao || null);
    }
    if (prazo_final !== undefined) {
      updates.push('prazo_final = ?');
      params.push(prazo_final || null);
    }
    if (vara !== undefined) {
      updates.push('vara = ?');
      params.push(vara ?sanitizarInput(vara) : null);
    }
    if (comarca !== undefined) {
      updates.push('comarca = ?');
      params.push(comarca ?sanitizarInput(comarca) : null);
    }
    if (advogado_autor !== undefined) {
      updates.push('advogado_autor = ?');
      params.push(advogado_autor ?sanitizarInput(advogado_autor) : null);
    }
    if (advogado_reu !== undefined) {
      updates.push('advogado_reu = ?');
      params.push(advogado_reu ?sanitizarInput(advogado_reu) : null);
    }
    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      params.push(observacoes ?sanitizarInput(observacoes) : null);
    }

    let vinculos;
    try {
      vinculos = await resolveClientesVinculados(db, req.body);
    } catch (error) {
      await db.close();
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!updates.length && !vinculos.shouldSync) {
      await db.close();
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    await db.exec('BEGIN TRANSACTION');
    inTransaction = true;

    if (updates.length) {
      updates.push('atualizado_em = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await db.run(`UPDATE processos SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (vinculos.shouldSync) {
      await syncProcessoClientes(db, req.params.id, vinculos.clienteIds);
    }

    await db.exec('COMMIT');
    inTransaction = false;

    const processoAtualizado = await db.get('SELECT * FROM processos WHERE id = ?', [req.params.id]);
    const clientes = await getClientesByProcesso(db, req.params.id);
    await auditLog(req, 'processo_atualizado', {
      processo_id: req.params.id,
      total_clientes: clientes.length
    });
    await db.close();

    return res.json({
      success: true,
      message: 'Processo atualizado com sucesso',
      data: mapProcesso(processoAtualizado, clientes)
    });
  } catch (error) {
    console.error('Erro ao atualizar processo:', error);
    if (inTransaction) {
      try { await db.exec('ROLLBACK'); } catch (rollbackError) {}
    }
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao atualizar processo' });
  }
}

async function deleteProcesso(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const processo = await db.get('SELECT * FROM processos WHERE id = ?', [req.params.id]);
    if (!processo) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Processo n?o encontrado' });
    }

    const anexos = await db.all('SELECT caminho_relativo FROM anexos_processo WHERE processo_id = ?', [req.params.id]);
    for (const anexo of anexos) {
      const absolutePath = resolveStoredUploadPath(anexo.caminho_relativo);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    await db.run('DELETE FROM processos WHERE id = ?', [req.params.id]);
    await auditLog(req, 'processo_excluido', { processo_id: req.params.id, numero_processo: processo.numero_processo });
    await db.close();
    return res.json({ success: true, message: 'Processo exclu?do com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir processo:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao excluir processo' });
  }
}

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
      prioridade,
      tipo_acao,
      data_inicio,
      data_fim,
      cliente_id,
      valor_min,
      valor_max
    } = req.query;

    const limit = Math.min(parseInt(perPage, 10), 100);
    const offset = (parseInt(page, 10) - 1) * limit;
    const allowedSortFields = ['id', 'numero_processo', 'titulo', 'status', 'prioridade', 'autor', 'reu', 'data_distribuicao', 'prazo_final', 'criado_em', 'atualizado_em', 'valor_causa'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'criado_em';
    const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ?'ASC' : 'DESC';

    const whereConditions = [];
    const params = [];

    if (searchQuery) {
      const searchTerm = `%${sanitizarInput(searchQuery)}%`;
      whereConditions.push('(p.numero_processo LIKE ?OR p.titulo LIKE ?OR p.descricao LIKE ?OR p.autor LIKE ?OR p.reu LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (status) {
      whereConditions.push('p.status = ?');
      params.push(sanitizarInput(status));
    }
    if (prioridade) {
      whereConditions.push('p.prioridade = ?');
      params.push(sanitizarInput(prioridade));
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
      whereConditions.push('EXISTS (SELECT 1 FROM processo_clientes pc WHERE pc.processo_id = p.id AND pc.cliente_id = ?)');
      params.push(parseInt(cliente_id, 10));
    }
    if (valor_min) {
      whereConditions.push('p.valor_causa >= ?');
      params.push(parseFloat(valor_min));
    }
    if (valor_max) {
      whereConditions.push('p.valor_causa <= ?');
      params.push(parseFloat(valor_max));
    }

    const whereClause = whereConditions.length ?`WHERE ${whereConditions.join(' AND ')}` : '';
    const countRow = await db.get(`SELECT COUNT(*) as total FROM processos p ${whereClause}`, params);
    const rows = await db.all(
      `SELECT p.*
       FROM processos p
       ${whereClause}
       ORDER BY p.${validSortBy} ${validSortOrder}
       LIMIT ?OFFSET ?`,
      [...params, limit, offset]
    );

    const items = await attachClientesToProcessos(db, rows);
    await db.close();
    return res.json({
      success: true,
      message: 'Busca realizada com sucesso',
      data: {
        items,
        total: countRow.total,
        page: parseInt(page, 10),
        perPage: limit,
        totalPages: Math.ceil(countRow.total / limit)
      }
    });
  } catch (error) {
    console.error('Erro na busca de processos:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro na busca de processos' });
  }
}

async function getStats(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const totalRow = await db.get('SELECT COUNT(*) as total FROM processos');
    const porStatus = await db.all('SELECT status, COUNT(*) as total FROM processos GROUP BY status');
    const porPrioridade = await db.all('SELECT prioridade, COUNT(*) as total FROM processos GROUP BY prioridade');
    const recentCount = await db.get(`SELECT COUNT(*) as count FROM processos WHERE criado_em >= datetime('now', '-30 days')`);
    const recentActivityCount = await db.get(`SELECT COUNT(DISTINCT processo_id) as count FROM movimentacoes WHERE criado_em >= datetime('now', '-7 days')`);
    const porCliente = await db.all(
      `SELECT c.id, c.nome, COUNT(pc.processo_id) as count
       FROM clientes c
       LEFT JOIN processo_clientes pc ON pc.cliente_id = c.id
       WHERE pc.processo_id IS NOT NULL
       GROUP BY c.id, c.nome
       ORDER BY count DESC
       LIMIT 10`
    );
    const valorTotal = await db.get(`SELECT COALESCE(SUM(valor_causa), 0) as valorTotal FROM processos WHERE valor_causa IS NOT NULL`);
    const valorMedio = await db.get(`SELECT COALESCE(AVG(valor_causa), 0) as valorMedio FROM processos WHERE valor_causa IS NOT NULL`);
    const prazosAtrasados = await db.get(
      `SELECT COUNT(*) as total
       FROM processos
       WHERE prazo_final IS NOT NULL
         AND DATE(prazo_final) < DATE('now')
         AND status NOT IN ('arquivado', 'transitado_em_julgado')`
    );
    const prazosHoje = await db.get(
      `SELECT COUNT(*) as total
       FROM processos
       WHERE prazo_final IS NOT NULL
         AND DATE(prazo_final) = DATE('now')
         AND status NOT IN ('arquivado', 'transitado_em_julgado')`
    );
    const prazosProximos = await db.get(
      `SELECT COUNT(*) as total
       FROM processos
       WHERE prazo_final IS NOT NULL
         AND DATE(prazo_final) > DATE('now')
         AND DATE(prazo_final) <= DATE('now', '+7 days')
         AND status NOT IN ('arquivado', 'transitado_em_julgado')`
    );
    const proximosPrazosRows = await db.all(
      `SELECT p.id, p.numero_processo, p.titulo, p.prazo_final, p.prioridade, p.status
       FROM processos p
       WHERE p.prazo_final IS NOT NULL
         AND p.status NOT IN ('arquivado', 'transitado_em_julgado')
       ORDER BY
         CASE WHEN DATE(p.prazo_final) < DATE('now') THEN 0 ELSE 1 END,
         DATE(p.prazo_final) ASC
       LIMIT 8`
    );
    const proximosPrazos = await attachClientesToProcessos(db, proximosPrazosRows);
    await db.close();

    return res.json({
      success: true,
      message: 'Estat?sticas obtidas com sucesso',
      data: {
        total: totalRow.total,
        porStatus: porStatus.reduce((acc, item) => {
          acc[item.status] = item.total;
          return acc;
        }, {}),
        porPrioridade: porPrioridade.reduce((acc, item) => {
          acc[item.prioridade || 'media'] = item.total;
          return acc;
        }, {}),
        recentCount: recentCount.count,
        recentActivityCount: recentActivityCount.count,
        porCliente,
        valorTotal: valorTotal.valorTotal,
        valorMedio: valorMedio.valorMedio,
        prazosAtrasados: prazosAtrasados.total,
        prazosHoje: prazosHoje.total,
        prazosProximos: prazosProximos.total,
        proximosPrazos
      }
    });
  } catch (error) {
    console.error('Erro ao obter estat?sticas:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao obter estat?sticas' });
  }
}

async function getNotifications(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const limit = Math.min(parseInt(req.query.limit || '12', 10), 30);
    const rows = await db.all(
      `SELECT * FROM (
         SELECT
           p.id,
           p.numero_processo,
           p.titulo,
           p.status,
           p.prioridade,
           p.prazo_final,
           'prazo_atrasado' as tipo_notificacao,
           1 as ordem_tipo
         FROM processos p
         WHERE p.prazo_final IS NOT NULL
           AND DATE(p.prazo_final) < DATE('now')
           AND p.status NOT IN ('arquivado', 'transitado_em_julgado')

         UNION ALL

         SELECT
           p.id,
           p.numero_processo,
           p.titulo,
           p.status,
           p.prioridade,
           p.prazo_final,
           'prazo_proximo' as tipo_notificacao,
           2 as ordem_tipo
         FROM processos p
         WHERE p.prazo_final IS NOT NULL
           AND DATE(p.prazo_final) >= DATE('now')
           AND DATE(p.prazo_final) <= DATE('now', '+7 days')
           AND p.status NOT IN ('arquivado', 'transitado_em_julgado')

         UNION ALL

         SELECT
           p.id,
           p.numero_processo,
           p.titulo,
           p.status,
           p.prioridade,
           p.prazo_final,
           'sem_movimentacao_recente' as tipo_notificacao,
           3 as ordem_tipo
         FROM processos p
         LEFT JOIN (
           SELECT processo_id, MAX(data_movimentacao) as ultima_movimentacao
           FROM movimentacoes
           GROUP BY processo_id
         ) m ON m.processo_id = p.id
         WHERE p.status IN ('distribuido', 'em_andamento', 'suspenso')
           AND COALESCE(m.ultima_movimentacao, p.data_distribuicao, p.criado_em) < DATE('now', '-15 days')
       )
       ORDER BY ordem_tipo ASC, DATE(COALESCE(prazo_final, '2999-12-31')) ASC, prioridade DESC, numero_processo ASC
       LIMIT ?`,
      [limit]
    );

    const itens = await attachClientesToProcessos(db, rows);
    await db.close();
    return res.json({
      success: true,
      message: 'Notifica?es obtidas com sucesso',
      data: itens
    });
  } catch (error) {
    console.error('Erro ao obter notifica?es:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao obter notifica?es' });
  }
}

async function listAnexos(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const processo = await db.get('SELECT id FROM processos WHERE id = ?', [req.params.id]);
    if (!processo) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Processo n?o encontrado' });
    }

    const anexos = await db.all(
      `SELECT id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_em
       FROM anexos_processo
       WHERE processo_id = ?
       ORDER BY criado_em DESC`,
      [req.params.id]
    );
    await db.close();

    return res.json({
      success: true,
      data: anexos.map(mapAnexo)
    });
  } catch (error) {
    console.error('Erro ao listar anexos:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao listar anexos' });
  }
}

async function uploadAnexo(req, res) {
  const db = new Database();

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Arquivo obrigat?rio' });
    }

    await db.connect();
    const processo = await db.get('SELECT id, numero_processo FROM processos WHERE id = ?', [req.params.id]);
    if (!processo) {
      await db.close();
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Processo n?o encontrado' });
    }

    const caminhoRelativo = toStoredUploadPath(req.file.path);
    const result = await db.run(
      `INSERT INTO anexos_processo (
        processo_id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_por_usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        req.params.id,
        req.file.originalname,
        req.file.filename,
        caminhoRelativo,
        req.file.mimetype,
        req.file.size,
        req.session?.usuario?.id || null
      ]
    );

    const anexo = await db.get('SELECT * FROM anexos_processo WHERE id = ?', [result.lastID]);
    await auditLog(req, 'anexo_processo_criado', { processo_id: req.params.id, anexo_id: result.lastID });
    await db.close();

    return res.status(201).json({
      success: true,
      message: 'Arquivo anexado com sucesso',
      data: mapAnexo(anexo)
    });
  } catch (error) {
    console.error('Erro ao anexar arquivo:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao anexar arquivo' });
  }
}

async function deleteAnexo(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const anexo = await db.get(
      `SELECT a.*, p.id as processo_id
       FROM anexos_processo a
       INNER JOIN processos p ON p.id = a.processo_id
       WHERE a.id = ?AND p.id = ?`,
      [req.params.anexoId, req.params.id]
    );

    if (!anexo) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Anexo n?o encontrado' });
    }

    const absolutePath = resolveStoredUploadPath(anexo.caminho_relativo);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await db.run('DELETE FROM anexos_processo WHERE id = ?', [req.params.anexoId]);
    await auditLog(req, 'anexo_processo_excluido', { processo_id: req.params.id, anexo_id: req.params.anexoId });
    await db.close();

    return res.json({ success: true, message: 'Anexo exclu?do com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao excluir anexo' });
  }
}

async function uploadTempAnexo(req, res) {
  const db = new Database();

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Arquivo obrigat?rio' });
    }

    await db.connect();
    const caminhoRelativo = toStoredUploadPath(req.file.path);
    const result = await db.run(
      `INSERT INTO anexos_temporarios_processo (
        sessao_id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_por_usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        req.sessionID,
        req.file.originalname,
        req.file.filename,
        caminhoRelativo,
        req.file.mimetype,
        req.file.size,
        req.session?.usuario?.id || null
      ]
    );

    const anexo = await db.get('SELECT * FROM anexos_temporarios_processo WHERE id = ?', [result.lastID]);
    await auditLog(req, 'anexo_temporario_processo_criado', { anexo_temporario_id: result.lastID });
    await db.close();

    return res.status(201).json({
      success: true,
      message: 'Arquivo enviado e aguardando cria?o do processo',
      data: mapTempAnexo(anexo)
    });
  } catch (error) {
    console.error('Erro ao enviar anexo tempor?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao enviar anexo tempor?rio' });
  }
}

async function clearTempAnexos(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const totalRemovido = await removeTempAttachmentFiles(db, req.sessionID);
    await auditLog(req, 'anexos_temporarios_limpos', { total_removido: totalRemovido });
    await db.close();
    return res.json({ success: true, message: 'Anexos tempor?rios removidos', data: { totalRemovido } });
  } catch (error) {
    console.error('Erro ao limpar anexos tempor?rios:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao limpar anexos tempor?rios' });
  }
}

async function deleteTempAnexo(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const anexo = await db.get(
      'SELECT id FROM anexos_temporarios_processo WHERE id = ?AND sessao_id = ?',
      [req.params.anexoId, req.sessionID]
    );

    if (!anexo) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Anexo temporario nao encontrado' });
    }

    await removeTempAttachmentFiles(db, req.sessionID, req.params.anexoId);
    await auditLog(req, 'anexo_temporario_processo_excluido', { anexo_temporario_id: req.params.anexoId });
    await db.close();
    return res.json({ success: true, message: 'Anexo temporario excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir anexo temporario:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao excluir anexo temporario' });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deleteProcesso,
  search,
  getStats,
  getNotifications,
  listAnexos,
  uploadAnexo,
  deleteAnexo,
  uploadTempAnexo,
  clearTempAnexos,
  deleteTempAnexo
};
