const { Database } = require('../database/init');
const { sanitizarInput } = require('../middleware/validators');

// Listar registros de auditoria com filtros
async function list(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const {
      page = 1,
      perPage = 50,
      sortBy = 'criado_em',
      sortOrder = 'DESC',
      acao,
      tela,
      usuario_email,
      ip,
      status_http,
      data_inicio,
      data_fim
    } = req.query;
    
    const limit = Math.min(parseInt(perPage), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    // Validar sortBy
    const allowedSortFields = ['id', 'usuario_email', 'acao', 'tela', 'status_http', 'ip', 'criado_em'];
    const validSortBy = allowedSortFields.includes(sortBy) ?sortBy : 'criado_em';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ?'ASC' : 'DESC';
    
    // Construir query com filtros
    const whereConditions = [];
    const params = [];
    
    if (acao) {
      whereConditions.push('acao LIKE ?');
      params.push(`%${sanitizarInput(acao)}%`);
    }
    
    if (tela) {
      whereConditions.push('tela = ?');
      params.push(sanitizarInput(tela));
    }
    
    if (usuario_email) {
      whereConditions.push('usuario_email LIKE ?');
      params.push(`%${sanitizarInput(usuario_email)}%`);
    }
    
    if (ip) {
      whereConditions.push('ip = ?');
      params.push(sanitizarInput(ip));
    }
    
    if (status_http) {
      whereConditions.push('status_http = ?');
      params.push(parseInt(status_http));
    }
    
    if (data_inicio) {
      whereConditions.push('criado_em >= ?');
      params.push(data_inicio);
    }
    
    if (data_fim) {
      whereConditions.push('criado_em <= ?');
      params.push(data_fim);
    }
    
    const whereClause = whereConditions.length > 0 
      ?'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Buscar total de registros
    const { total } = await db.get(
      `SELECT COUNT(*) as total FROM auditoria ${whereClause}`,
      params
    );
    
    // Buscar registros com paginação
    const query = `
      SELECT 
        id, usuario_id, usuario_email, acao, tela,
        metodo, rota, status_http, ip, user_agent,
        detalhes_json, criado_em
      FROM auditoria
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ?OFFSET ?
    `;
    
    const items = await db.all(query, [...params, limit, offset]);
    
    // Parse detalhes_json
    const itemsComDetalhes = items.map(item => ({
      ...item,
      detalhes: item.detalhes_json ?JSON.parse(item.detalhes_json) : null
    }));
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Registros de auditoria listados com sucesso',
      data: {
        items: itemsComDetalhes,
        total,
        page: parseInt(page),
        perPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar auditoria:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar registros de auditoria'
    });
  }
}

// Obter estatísticas para charts
async function getStats(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const { dias = 30 } = req.query;
    const diasInt = Math.min(parseInt(dias), 365);
    
    // Registros por dia (últimos N dias)
    const porDia = await db.all(
      `SELECT 
        DATE(criado_em) as dia,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-${diasInt} days')
       GROUP BY DATE(criado_em)
       ORDER BY dia DESC`,
      []
    );
    
    // Registros por ação (top 10)
    const porAcao = await db.all(
      `SELECT 
        acao,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-${diasInt} days')
       GROUP BY acao
       ORDER BY total DESC
       LIMIT 10`,
      []
    );
    
    // Registros por status HTTP
    const porStatus = await db.all(
      `SELECT 
        status_http,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-${diasInt} days')
       GROUP BY status_http
       ORDER BY status_http`,
      []
    );
    
    // Registros por usuário (top 10)
    const porUsuario = await db.all(
      `SELECT 
        usuario_email,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-${diasInt} days')
         AND usuario_email != 'public'
       GROUP BY usuario_email
       ORDER BY total DESC
       LIMIT 10`,
      []
    );
    
    // Registros por tela
    const porTela = await db.all(
      `SELECT 
        tela,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-${diasInt} days')
         AND tela IS NOT NULL
       GROUP BY tela
       ORDER BY total DESC`,
      []
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Estatísticas obtidas com sucesso',
      data: {
        periodo_dias: diasInt,
        porDia,
        porAcao,
        porStatus: porStatus.reduce((acc, item) => {
          acc[item.status_http] = item.total;
          return acc;
        }, {}),
        porUsuario,
        porTela
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

// Obter métricas de SLA (últimos 30 dias)
async function getSLA(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Total de requisições
    const { totalRequisicoes } = await db.get(
      `SELECT COUNT(*) as totalRequisicoes
       FROM auditoria
       WHERE criado_em >= datetime('now', '-30 days')`,
      []
    );
    
    // Requisições com sucesso (2xx)
    const { requisicoesOk } = await db.get(
      `SELECT COUNT(*) as requisicoesOk
       FROM auditoria
       WHERE criado_em >= datetime('now', '-30 days')
         AND status_http >= 200 AND status_http < 300`,
      []
    );
    
    // Requisições com erro (4xx, 5xx)
    const { requisicoesErro } = await db.get(
      `SELECT COUNT(*) as requisicoesErro
       FROM auditoria
       WHERE criado_em >= datetime('now', '-30 days')
         AND status_http >= 400`,
      []
    );
    
    // Calcular disponibilidade
    const disponibilidade = totalRequisicoes > 0 
      ?((requisicoesOk / totalRequisicoes) * 100).toFixed(2)
      : 100;
    
    // Taxa de erro
    const taxaErro = totalRequisicoes > 0
      ?((requisicoesErro / totalRequisicoes) * 100).toFixed(2)
      : 0;
    
    // Requisições por dia (média)
    const { diasComDados } = await db.get(
      `SELECT COUNT(DISTINCT DATE(criado_em)) as diasComDados
       FROM auditoria
       WHERE criado_em >= datetime('now', '-30 days')`,
      []
    );
    
    const mediaRequisicoesPorDia = diasComDados > 0
      ?Math.round(totalRequisicoes / diasComDados)
      : 0;
    
    // Ações mais comuns
    const acoesComuns = await db.all(
      `SELECT acao, COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-30 days')
       GROUP BY acao
       ORDER BY total DESC
       LIMIT 5`,
      []
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Métricas de SLA obtidas com sucesso',
      data: {
        periodo: 'Últimos 30 dias',
        metricas: {
          totalRequisicoes,
          requisicoesOk,
          requisicoesErro,
          disponibilidade: parseFloat(disponibilidade),
          taxaErro: parseFloat(taxaErro),
          mediaRequisicoesPorDia
        },
        acoesComuns
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter SLA:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter métricas de SLA'
    });
  }
}

// Detectar anomalias (últimos 7 dias)
async function getAnomalias(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Média de erros por dia nos últimos 30 dias
    const { mediaErrosPorDia } = await db.get(
      `SELECT AVG(erros) as mediaErrosPorDia
       FROM (
         SELECT DATE(criado_em) as dia, COUNT(*) as erros
         FROM auditoria
         WHERE criado_em >= datetime('now', '-30 days')
           AND status_http >= 400
         GROUP BY DATE(criado_em)
       )`,
      []
    );
    
    // Erros por dia nos últimos 7 dias
    const errosUltimos7Dias = await db.all(
      `SELECT 
        DATE(criado_em) as dia,
        COUNT(*) as total_erros
       FROM auditoria
       WHERE criado_em >= datetime('now', '-7 days')
         AND status_http >= 400
       GROUP BY DATE(criado_em)
       ORDER BY dia DESC`,
      []
    );
    
    // Detectar spikes de erro (>2x a média)
    const threshold = (mediaErrosPorDia || 0) * 2;
    const spikesDeErro = errosUltimos7Dias.filter(dia => dia.total_erros > threshold);
    
    // Logins falhados por dia nos últimos 7 dias
    const loginsFalhadosPorDia = await db.all(
      `SELECT 
        DATE(criado_em) as dia,
        COUNT(*) as total
       FROM auditoria
       WHERE criado_em >= datetime('now', '-7 days')
         AND acao = 'login_falha'
       GROUP BY DATE(criado_em)
       ORDER BY dia DESC`,
      []
    );
    
    // Média de logins falhados
    const { mediaLoginsFalhadosPorDia } = await db.get(
      `SELECT AVG(falhas) as mediaLoginsFalhadosPorDia
       FROM (
         SELECT DATE(criado_em) as dia, COUNT(*) as falhas
         FROM auditoria
         WHERE criado_em >= datetime('now', '-30 days')
           AND acao = 'login_falha'
         GROUP BY DATE(criado_em)
       )`,
      []
    );
    
    // Detectar spikes de login falhado (>3x a média)
    const thresholdLogin = (mediaLoginsFalhadosPorDia || 0) * 3;
    const spikesLoginFalha = loginsFalhadosPorDia.filter(dia => dia.total > thresholdLogin);
    
    // IPs com muitos erros (possível ataque)
    const ipsComMuitosErros = await db.all(
      `SELECT 
        ip,
        COUNT(*) as total_erros
       FROM auditoria
       WHERE criado_em >= datetime('now', '-7 days')
         AND status_http >= 400
       GROUP BY ip
       HAVING COUNT(*) > 50
       ORDER BY total_erros DESC`,
      []
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Anomalias detectadas com sucesso',
      data: {
        periodo: 'Últimos 7 dias',
        anomalias: {
          spikesDeErro: spikesDeErro.length > 0 ?spikesDeErro : null,
          spikesLoginFalha: spikesLoginFalha.length > 0 ?spikesLoginFalha : null,
          ipsComMuitosErros: ipsComMuitosErros.length > 0 ?ipsComMuitosErros : null
        },
        metricas: {
          mediaErrosPorDia: mediaErrosPorDia || 0,
          mediaLoginsFalhadosPorDia: mediaLoginsFalhadosPorDia || 0,
          thresholdErros: threshold,
          thresholdLoginsFalha: thresholdLogin
        },
        temAnomalias: spikesDeErro.length > 0 || spikesLoginFalha.length > 0 || ipsComMuitosErros.length > 0
      }
    });
    
  } catch (error) {
    console.error('Erro ao detectar anomalias:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao detectar anomalias'
    });
  }
}

module.exports = {
  list,
  getStats,
  getSLA,
  getAnomalias
};
