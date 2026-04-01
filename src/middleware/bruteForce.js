const { Database } = require('../database/init');

function getMaxAttempts() {
  return parseInt(process.env.BRUTE_FORCE_MAX_ATTEMPTS || '10', 10);
}

function getBaseMinutes() {
  return parseInt(process.env.BRUTE_FORCE_BASE_MINUTES || '5', 10);
}

function getMaxMinutes() {
  return parseInt(process.env.BRUTE_FORCE_MAX_MINUTES || '120', 10);
}

async function checkBruteForce(chave, tipo = 'ip') {
  const db = new Database();

  try {
    await db.connect();
    const bloqueio = await db.get(
      'SELECT * FROM brute_force_locks WHERE chave_tipo = ?AND chave_valor = ?',
      [tipo, chave]
    );

    if (bloqueio && (bloqueio.tentativas || 0) < getMaxAttempts() && bloqueio.bloqueado_ate) {
      await db.run(
        `UPDATE brute_force_locks
         SET bloqueado_ate = NULL, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [bloqueio.id]
      );
      bloqueio.bloqueado_ate = null;
    }

    if (bloqueio?.bloqueado_ate) {
      const bloqueadoAte = new Date(bloqueio.bloqueado_ate);
      if (bloqueadoAte > new Date()) {
        await db.close();
        return {
          bloqueado: true,
          minutosRestantes: Math.ceil((bloqueadoAte - new Date()) / 60000),
          tentativas: bloqueio.tentativas || 0,
          maxTentativas: getMaxAttempts()
        };
      }
    }

    await db.close();
    return {
      bloqueado: false,
      tentativas: bloqueio?.tentativas || 0,
      maxTentativas: getMaxAttempts()
    };
  } catch (error) {
    console.error('Erro ao verificar brute force:', error);
    try { await db.close(); } catch (closeError) {}
    return { bloqueado: false, tentativas: 0, maxTentativas: getMaxAttempts() };
  }
}

async function registrarFalhaLogin(chave, tipo = 'ip') {
  const db = new Database();

  try {
    await db.connect();
    const bloqueio = await db.get(
      'SELECT * FROM brute_force_locks WHERE chave_tipo = ?AND chave_valor = ?',
      [tipo, chave]
    );

    const maxAttempts = getMaxAttempts();
    const baseMinutes = getBaseMinutes();
    const maxMinutes = getMaxMinutes();

    if (bloqueio) {
      const novasTentativas = (bloqueio.tentativas || 0) + 1;

      if (novasTentativas >= maxAttempts) {
        const minutosBloquear = Math.min(
          baseMinutes * Math.pow(2, Math.max(novasTentativas - maxAttempts, 0)),
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
        await db.run(
          `UPDATE brute_force_locks
           SET tentativas = ?, bloqueado_ate = NULL, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [novasTentativas, bloqueio.id]
        );
      }
    } else {
      await db.run(
        `INSERT INTO brute_force_locks (chave_tipo, chave_valor, tentativas, bloqueado_ate)
         VALUES (?, ?, ?, ?)`,
        [tipo, chave, 1, null]
      );
    }

    await db.close();
  } catch (error) {
    console.error('Erro ao registrar falha de login:', error);
    try { await db.close(); } catch (closeError) {}
  }
}

async function limparBloqueio(chave, tipo = 'ip') {
  const db = new Database();

  try {
    await db.connect();
    await db.run(
      'DELETE FROM brute_force_locks WHERE chave_tipo = ?AND chave_valor = ?',
      [tipo, chave]
    );
    await db.close();
  } catch (error) {
    console.error('Erro ao limpar bloqueio:', error);
    try { await db.close(); } catch (closeError) {}
  }
}

function bruteForceProtection(tipo = 'ip') {
  return async (req, res, next) => {
    const chave = tipo === 'ip'
      ?req.ip || req.connection?.remoteAddress
      : req.body?.email || 'unknown';

    if (!chave || chave === 'unknown') {
      return next();
    }

    const resultado = await checkBruteForce(chave, tipo);

    if (resultado.bloqueado) {
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas. O acesso foi bloqueado por ${resultado.minutosRestantes} minuto(s).`,
        minutosRestantes: resultado.minutosRestantes,
        tentativas: resultado.tentativas,
        maxTentativas: resultado.maxTentativas
      });
    }

    return next();
  };
}

module.exports = {
  bruteForceProtection,
  checkBruteForce,
  registrarFalhaLogin,
  limparBloqueio
};
