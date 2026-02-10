const { Database } = require('../database/init');
const { validarCPF, formatarCPF, validarNumeroProcesso, sanitizarInput } = require('../middleware/validators');
const { auditLog } = require('../middleware/audit');

// Consultar processos por CPF do cliente
async function consultarPorCPF(req, res) {
  const db = new Database();
  
  try {
    // Support both query parameter (?cpf=xxx) and path parameter (/:cpf)
    const cpf = req.params.cpf || req.query.cpf;
    
    if (!cpf) {
      return res.status(400).json({
        success: false,
        message: 'CPF é obrigatório'
      });
    }
    
    // Validar CPF
    if (!validarCPF(cpf)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido'
      });
    }
    
    const cpfFormatado = formatarCPF(cpf);
    
    await db.connect();
    
    // Buscar cliente por CPF
    const cliente = await db.get(
      'SELECT id, nome, cpf FROM clientes WHERE cpf = ?',
      [cpfFormatado]
    );
    
    if (!cliente) {
      // Registrar auditoria como public
      await auditLogPublic(req, 'consulta_publica_cpf', { 
        cpf: cpfFormatado,
        encontrado: false
      });
      await db.close();
      
      return res.status(404).json({
        success: false,
        message: 'Nenhum cliente encontrado com este CPF'
      });
    }
    
    // Buscar processos do cliente
    const processos = await db.all(
      `SELECT 
        id, numero_processo, titulo, status,
        data_distribuicao, data_ultima_movimentacao,
        vara, comarca
       FROM processos
       WHERE cliente_id = ?
       ORDER BY data_distribuicao DESC`,
      [cliente.id]
    );
    
    // Registrar auditoria como public
    await auditLogPublic(req, 'consulta_publica_cpf', { 
      cpf: cpfFormatado,
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
          cpf: cliente.cpf
        },
        processos: processos.map(p => ({
          numero_processo: p.numero_processo,
          titulo: p.titulo,
          status: p.status,
          data_distribuicao: p.data_distribuicao,
          data_ultima_movimentacao: p.data_ultima_movimentacao,
          vara: p.vara,
          comarca: p.comarca
        })),
        total: processos.length
      }
    });
    
  } catch (error) {
    console.error('Erro na consulta pública por CPF:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao realizar consulta'
    });
  }
}

// Consultar processo por número
async function consultarPorNumero(req, res) {
  const db = new Database();
  
  try {
    // Support both query parameter (?numero=xxx) and path parameter (/:numero)
    const numero = req.params.numero || req.query.numero;
    
    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Número do processo é obrigatório'
      });
    }
    
    // Validar formato
    if (!validarNumeroProcesso(numero)) {
      return res.status(400).json({
        success: false,
        message: 'Número do processo inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)'
      });
    }
    
    const numeroLimpo = numero.replace(/[^\d]/g, '');
    
    await db.connect();
    
    // Buscar processo (usar LIKE para buscar independente da formatação)
    const processo = await db.get(
      `SELECT 
        p.id, p.numero_processo, p.titulo, p.status,
        p.data_distribuicao, p.data_ultima_movimentacao,
        p.vara, p.comarca, p.autor, p.reu,
        c.nome as cliente_nome, c.cpf as cliente_cpf
       FROM processos p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       WHERE REPLACE(REPLACE(REPLACE(p.numero_processo, '-', ''), '.', ''), ' ', '') = ?`,
      [numeroLimpo]
    );
    
    if (!processo) {
      // Registrar auditoria como public
      await auditLogPublic(req, 'consulta_publica_numero', { 
        numero: numeroLimpo,
        encontrado: false
      });
      await db.close();
      
      return res.status(404).json({
        success: false,
        message: 'Processo não encontrado'
      });
    }
    
    // Buscar movimentações (limitadas às últimas 10)
    const movimentacoes = await db.all(
      `SELECT tipo, descricao, data_movimentacao
       FROM movimentacoes
       WHERE processo_id = ?
       ORDER BY data_movimentacao DESC
       LIMIT 10`,
      [processo.id]
    );
    
    // Registrar auditoria como public
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
          cliente: processo.cliente_nome ? {
            nome: processo.cliente_nome,
            cpf: processo.cliente_cpf
          } : null
        },
        movimentacoes: movimentacoes.map(m => ({
          tipo: m.tipo,
          descricao: m.descricao,
          data_movimentacao: m.data_movimentacao
        })),
        total_movimentacoes: movimentacoes.length
      }
    });
    
  } catch (error) {
    console.error('Erro na consulta pública por número:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao realizar consulta'
    });
  }
}

// Função auxiliar para registrar auditoria pública
async function auditLogPublic(req, acao, detalhes = {}) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    await db.run(
      `INSERT INTO auditoria 
       (usuario_id, usuario_email, acao, tela, metodo, rota, status_http, ip, user_agent, detalhes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null, // Sem usuário autenticado
        'public', // Marcado como acesso público
        acao,
        'public',
        req.method,
        req.originalUrl,
        detalhes.status || 200,
        ip,
        userAgent,
        JSON.stringify(detalhes)
      ]
    );
    
    await db.close();
  } catch (error) {
    console.error('Erro ao registrar auditoria pública:', error);
    try {
      await db.close();
    } catch (e) {}
  }
}

module.exports = {
  consultarPorCPF,
  consultarPorNumero
};
