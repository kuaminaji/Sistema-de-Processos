const { Database } = require('../database/init');

// Registrar ação na trilha de auditoria
async function auditLog(req, acao, detalhes = {}) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const usuario = req.session?.usuario;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    await db.run(
      `INSERT INTO auditoria 
       (usuario_id, usuario_email, acao, tela, metodo, rota, status_http, ip, user_agent, detalhes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario?.id || null,
        usuario?.email || 'anonymous',
        acao,
        detalhes.tela || null,
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
    console.error('Erro ao registrar auditoria:', error);
    // Não propagar erro de auditoria
    try {
      await db.close();
    } catch (e) {}
  }
}

// Middleware de auditoria para rotas
function auditMiddleware(acao, tela = null) {
  return async (req, res, next) => {
    // Salvar o método send original
    const originalSend = res.send;
    
    // Sobrescrever send para capturar status
    res.send = function(data) {
      res.send = originalSend; // Restaurar
      
      // Registrar auditoria
      auditLog(req, acao, {
        tela,
        status: res.statusCode
      }).catch(err => console.error('Erro na auditoria:', err));
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

module.exports = { auditLog, auditMiddleware };
