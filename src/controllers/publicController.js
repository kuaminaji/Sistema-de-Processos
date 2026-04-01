const { Database } = require('../database/init');
const {
  validarDocumento,
  formatarDocumento,
  validarNumeroProcesso,
  sanitizarInput,
  normalizarDocumento
} = require('../middleware/validators');

async function consultarPorDocumento(req, res) {
  const db = new Database();

  try {
    const documento = req.params.documento || req.params.cpf || req.query.documento || req.query.cpf;
    if (!documento) {
      return res.status(400).json({ success: false, message: 'CPF ou CNPJ e obrigatorio' });
    }

    const validacaoDocumento = validarDocumento(documento);
    if (!validacaoDocumento.valido) {
      return res.status(400).json({ success: false, message: validacaoDocumento.mensagem });
    }

    await db.connect();
    const cliente = await db.get(
      `SELECT id, nome, cpf, tipo_documento
       FROM clientes
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?`,
      [validacaoDocumento.documento]
    );

    if (!cliente) {
      await auditLogPublic(req, 'consulta_publica_documento', {
        documento: validacaoDocumento.documento,
        encontrado: false
      });
      await db.close();
      return res.status(404).json({ success: false, message: 'Nenhum cliente encontrado com este documento' });
    }

    const processos = await db.all(
      `SELECT DISTINCT p.id, p.numero_processo, p.titulo, p.status, p.data_distribuicao, p.data_ultima_movimentacao, p.vara, p.comarca
       FROM processos p
       INNER JOIN processo_clientes pc ON pc.processo_id = p.id
       WHERE pc.cliente_id = ?
       ORDER BY p.data_distribuicao DESC`,
      [cliente.id]
    );

    await auditLogPublic(req, 'consulta_publica_documento', {
      documento: validacaoDocumento.documento,
      encontrado: true,
      total_processos: processos.length
    });
    await db.close();

    return res.json({
      success: true,
      message: 'Consulta realizada com sucesso',
      data: {
        cliente: {
          nome: cliente.nome,
          documento: formatarDocumento(cliente.cpf, cliente.tipo_documento),
          tipo_documento: cliente.tipo_documento
        },
        processos,
        total: processos.length
      }
    });
  } catch (error) {
    console.error('Erro na consulta publica por documento:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao realizar consulta' });
  }
}

async function consultarPorNumero(req, res) {
  const db = new Database();

  try {
    const numero = req.params.numero || req.query.numero;
    if (!numero) {
      return res.status(400).json({ success: false, message: 'Numero do processo e obrigatorio' });
    }

    if (!validarNumeroProcesso(numero)) {
      return res.status(400).json({
        success: false,
        message: 'Numero do processo invalido. Use o formato CNJ.'
      });
    }

    const numeroLimpo = normalizarDocumento(numero);
    await db.connect();
    const processo = await db.get(
      `SELECT
        p.id, p.numero_processo, p.titulo, p.status, p.data_distribuicao, p.data_ultima_movimentacao,
        p.vara, p.comarca, p.autor, p.reu, p.valor_causa
       FROM processos p
       WHERE REPLACE(REPLACE(REPLACE(p.numero_processo, '-', ''), '.', ''), ' ', '') = ?`,
      [numeroLimpo]
    );

    if (!processo) {
      await auditLogPublic(req, 'consulta_publica_numero', { numero: numeroLimpo, encontrado: false });
      await db.close();
      return res.status(404).json({ success: false, message: 'Processo nao encontrado' });
    }

    const movimentacoes = await db.all(
      `SELECT tipo, descricao, data_movimentacao
       FROM movimentacoes
       WHERE processo_id = ?
       ORDER BY data_movimentacao DESC
       LIMIT 10`,
      [processo.id]
    );

    const clientes = await db.all(
      `SELECT c.nome, c.cpf, c.tipo_documento
       FROM processo_clientes pc
       INNER JOIN clientes c ON c.id = pc.cliente_id
       WHERE pc.processo_id = ?
       ORDER BY c.nome ASC`,
      [processo.id]
    );

    await auditLogPublic(req, 'consulta_publica_numero', {
      numero: numeroLimpo,
      encontrado: true,
      processo_id: processo.id
    });
    await db.close();

    return res.json({
      success: true,
      message: 'Processo encontrado com sucesso',
      data: {
        processo: {
          numero_processo: processo.numero_processo,
          titulo: processo.titulo,
          status: processo.status,
          data_distribuicao: processo.data_distribuicao,
          data_ultima_movimentacao: processo.data_ultima_movimentacao,
          vara: processo.vara,
          comarca: processo.comarca,
          autor: processo.autor,
          reu: processo.reu,
          valor_causa: processo.valor_causa,
          cliente: clientes.length ?{
            nome: clientes[0].nome,
            documento: formatarDocumento(clientes[0].cpf, clientes[0].tipo_documento),
            tipo_documento: clientes[0].tipo_documento
          } : null,
          clientes: clientes.map((clienteItem) => ({
            nome: clienteItem.nome,
            documento: formatarDocumento(clienteItem.cpf, clienteItem.tipo_documento),
            tipo_documento: clienteItem.tipo_documento
          })),
          movimentacoes
        }
      }
    });
  } catch (error) {
    console.error('Erro na consulta publica por numero:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao realizar consulta' });
  }
}

async function auditLogPublic(req, acao, detalhes = {}) {
  const db = new Database();

  try {
    await db.connect();
    await db.run(
      `INSERT INTO auditoria
       (usuario_id, usuario_email, acao, tela, metodo, rota, status_http, ip, user_agent, detalhes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null,
        'public',
        acao,
        'public',
        req.method,
        req.originalUrl,
        detalhes.status || 200,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        JSON.stringify(detalhes)
      ]
    );
    await db.close();
  } catch (error) {
    console.error('Erro ao registrar auditoria publica:', error);
    try { await db.close(); } catch (closeError) {}
  }
}

module.exports = {
  consultarPorDocumento,
  consultarPorCPF: consultarPorDocumento,
  consultarPorNumero
};
