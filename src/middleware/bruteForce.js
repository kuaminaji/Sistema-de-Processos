const { Database } = require('../database/init');

// Proteção contra brute force
async function checkBruteForce(chave, tipo = 'ip') {
  const db = new Database();
  
  try {
    await db.connect();
    
    const bloqueio = await db.get(
      'SELECT * FROM brute_force_locks WHERE chave_tipo = ? AND chave_valor = ?',
      [tipo, chave]
    );
    
    if (bloqueio && bloqueio.bloqueado_ate) {
      const bloqueadoAte = new Date(bloqueio.bloqueado_ate);
      if (bloqueadoAte > new Date()) {
        await db.close();
        const minutosRestantes = Math.ceil((bloqueadoAte - new Date()) / 60000);
        return {
          bloqueado: true,
          minutosRestantes
        };
      }
    }
    
    await db.close();
    return { bloqueado: false };
  } catch (error) {
    console.error('Erro ao verificar brute force:', error);
    try {
      await db.close();
    } catch (e) {}
    return { bloqueado: false };
  }
}

// Registrar tentativa de login falha
async function registrarFalhaLogin(chave, tipo = 'ip') {
  const db = new Database();
  
  try {
    await db.connect();
    
    const bloqueio = await db.get(
      'SELECT * FROM brute_force_locks WHERE chave_tipo = ? AND chave_valor = ?',
      [tipo, chave]
    );
    
    const baseMinutes = parseInt(process.env.BRUTE_FORCE_BASE_MINUTES || '5');
    const maxMinutes = parseInt(process.env.BRUTE_FORCE_MAX_MINUTES || '120');
    
    if (bloqueio) {
      const novasTentativas = bloqueio.tentativas + 1;
      
      // Cálculo exponencial: 5min, 10min, 20min, 40min... até maxMinutes
      const minutosBloquear = Math.min(
        baseMinutes * Math.pow(2, novasTentativas - 1),
        maxMinutes
      );
      
      const bloqueadoAte = new Date();
      bloqueadoAte.setMinutes(bloqueadoAte.getMinutes() + minutosBloquear);
      
      await db.run(
        `UPDATE brute_force_locks 
         SET tentativas = ?, bloqueado_ate = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [novasTentativas, bloqueadoAte.toISOString(), bloqueio.id]
      );
    } else {
      const bloqueadoAte = new Date();
      bloqueadoAte.setMinutes(bloqueadoAte.getMinutes() + baseMinutes);
      
      await db.run(
        `INSERT INTO brute_force_locks (chave_tipo, chave_valor, tentativas, bloqueado_ate)
         VALUES (?, ?, ?, ?)`,
        [tipo, chave, 1, bloqueadoAte.toISOString()]
      );
    }
    
    await db.close();
  } catch (error) {
    console.error('Erro ao registrar falha de login:', error);
    try {
      await db.close();
    } catch (e) {}
  }
}

// Limpar tentativas após login bem-sucedido
async function limparBloqueio(chave, tipo = 'ip') {
  const db = new Database();
  
  try {
    await db.connect();
    await db.run(
      'DELETE FROM brute_force_locks WHERE chave_tipo = ? AND chave_valor = ?',
      [tipo, chave]
    );
    await db.close();
  } catch (error) {
    console.error('Erro ao limpar bloqueio:', error);
    try {
      await db.close();
    } catch (e) {}
  }
}

// Middleware de proteção
function bruteForceProtection(tipo = 'ip') {
  return async (req, res, next) => {
    const chave = tipo === 'ip' 
      ? req.ip || req.connection?.remoteAddress
      : req.body?.email || 'unknown';
    
    if (!chave || chave === 'unknown') {
      return next();
    }
    
    const resultado = await checkBruteForce(chave, tipo);
    
    if (resultado.bloqueado) {
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas. Bloqueado por ${resultado.minutosRestantes} minuto(s).`,
        minutosRestantes: resultado.minutosRestantes
      });
    }
    
    next();
  };
}

module.exports = {
  bruteForceProtection,
  checkBruteForce,
  registrarFalhaLogin,
  limparBloqueio
};
