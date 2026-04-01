const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { Database } = require('../database/init');
const { validarSenhaForte, sanitizarInput } = require('../middleware/validators');
const { registrarFalhaLogin, limparBloqueio } = require('../middleware/bruteForce');
const { auditLog } = require('../middleware/audit');
const { sendPasswordResetEmail } = require('../services/emailService');

function getPasswordRounds() {
  return parseInt(process.env.PASSWORD_ROUNDS || '12', 10);
}

async function login(req, res) {
  const db = new Database();

  try {
    const { email, senha, totpToken, token2fa } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Email ou usuário e senha são obrigatórios'
      });
    }

    const identificador = sanitizarInput(email);
    await db.connect();

    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE (email = ?OR nome = ?) AND ativo = 1',
      [identificador, identificador]
    );

    if (!usuario) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await registrarFalhaLogin(identificador, 'email');
      await auditLog(req, 'login_falha', { email: identificador, motivo: 'usuario_nao_encontrado' });
      await db.close();
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await registrarFalhaLogin(identificador, 'email');
      await auditLog(req, 'login_falha', { email: identificador, motivo: 'senha_invalida' });
      await db.close();
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    if (usuario.twofa_enabled) {
      const token = totpToken || token2fa;
      if (!token) {
        await db.close();
        return res.status(200).json({
          success: true,
          requires2FA: true,
          message: 'Código 2FA necessário'
        });
      }

      const tokenValido = authenticator.verify({
        token,
        secret: usuario.twofa_secret
      });

      if (!tokenValido) {
        await registrarFalhaLogin(req.ip || 'unknown', 'ip');
        await auditLog(req, 'login_falha', { email: identificador, motivo: '2fa_invalido' });
        await db.close();
        return res.status(401).json({ success: false, message: 'Código 2FA inválido' });
      }
    }

    const permissoes = await db.all(
      `SELECT p.codigo
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ?AND up.concedido = 1`,
      [usuario.id]
    );

    await db.run(
      'UPDATE usuarios SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?',
      [usuario.id]
    );

    await limparBloqueio(req.ip || 'unknown', 'ip');
    await limparBloqueio(identificador, 'email');

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      forcar_troca_senha: usuario.forcar_troca_senha,
      senha_expira_em: usuario.senha_expira_em,
      twofa_enabled: usuario.twofa_enabled
    };
    req.session.permissoes = permissoes.map((item) => item.codigo);

    await auditLog(req, 'login_sucesso', { email: identificador });
    await db.close();

    return req.session.save((sessionError) => {
      if (sessionError) {
        return res.status(500).json({
          success: false,
          message: 'Erro ao finalizar a sessao de login'
        });
      }

      return res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
          },
          permissoes: req.session.permissoes,
          forcar_troca_senha: usuario.forcar_troca_senha === 1,
          senha_expira_em: usuario.senha_expira_em
        }
      });
    });
  } catch (error) {
    console.error('Erro no login:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao processar login' });
  }
}

async function listLoginUsers(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const usuarios = await db.all(
      `SELECT id, nome, email, ultimo_login_em
       FROM usuarios
       WHERE ativo = 1
       ORDER BY COALESCE(ultimo_login_em, criado_em) DESC, nome ASC
       LIMIT 8`
    );
    await db.close();

    return res.json({
      success: true,
      data: usuarios
    });
  } catch (error) {
    console.error('Erro ao listar usu?rios do login:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao listar usu?rios' });
  }
}

async function logout(req, res) {
  try {
    await auditLog(req, 'logout', { email: req.session?.usuario?.email || 'unknown' });
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ success: false, message: 'Erro ao fazer logout' });
      }
      return res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao processar logout' });
  }
}

async function trocarSenha(req, res) {
  const db = new Database();

  try {
    const { senhaAtual, senhaNova, confirmarSenha } = req.body;
    const usuarioId = req.session.usuario.id;

    if (!senhaAtual || !senhaNova || !confirmarSenha) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }

    if (senhaNova !== confirmarSenha) {
      return res.status(400).json({ success: false, message: 'As senhas não coincidem' });
    }

    const validacao = validarSenhaForte(senhaNova);
    if (!validacao.valida) {
      return res.status(400).json({ success: false, message: validacao.mensagem });
    }

    await db.connect();
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [usuarioId]);
    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaAtualValida) {
      await auditLog(req, 'troca_senha_falha', { motivo: 'senha_atual_invalida' });
      await db.close();
      return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
    }

    const historyCount = parseInt(process.env.PASSWORD_HISTORY_COUNT || '5', 10);
    const historicoSenhas = await db.all(
      'SELECT senha_hash FROM historico_senhas WHERE usuario_id = ?ORDER BY criado_em DESC LIMIT ?',
      [usuarioId, historyCount]
    );

    for (const item of historicoSenhas) {
      const jaUsada = await bcrypt.compare(senhaNova, item.senha_hash);
      if (jaUsada) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: `Esta senha j?foi utilizada. Escolha uma senha diferente das ?ltimas ${historyCount}.`
        });
      }
    }

    const novoHash = await bcrypt.hash(senhaNova, getPasswordRounds());
    const expiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10);
    const senhaExpiraEm = new Date();
    senhaExpiraEm.setDate(senhaExpiraEm.getDate() + expiryDays);

    await db.run(
      `UPDATE usuarios
       SET senha_hash = ?, senha_expira_em = ?, forcar_troca_senha = 0, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [novoHash, senhaExpiraEm.toISOString(), usuarioId]
    );

    await db.run(
      'INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)',
      [usuarioId, novoHash]
    );

    await db.run(
      `DELETE FROM historico_senhas
       WHERE usuario_id = ?
       AND id NOT IN (
         SELECT id FROM historico_senhas
         WHERE usuario_id = ?
         ORDER BY criado_em DESC
         LIMIT ?
       )`,
      [usuarioId, usuarioId, historyCount]
    );

    req.session.usuario.forcar_troca_senha = 0;
    req.session.usuario.senha_expira_em = senhaExpiraEm.toISOString();

    await auditLog(req, 'troca_senha_sucesso');
    await db.close();
    return res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao trocar senha:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao processar troca de senha' });
  }
}

async function setup2FA(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario.id]);
    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usu?rio n?o encontrado' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(usuario.email, 'Sistema de Processos', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await db.run('UPDATE usuarios SET twofa_secret = ?WHERE id = ?', [secret, usuario.id]);
    await auditLog(req, '2fa_setup_iniciado');
    await db.close();

    return res.json({
      success: true,
      message: '2FA configurado com sucesso',
      data: { secret, qrCode }
    });
  } catch (error) {
    console.error('Erro ao configurar 2FA:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao configurar 2FA' });
  }
}

async function enable2FA(req, res) {
  const db = new Database();

  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token é obrigatório' });
    }

    await db.connect();
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario.id]);
    if (!usuario || !usuario.twofa_secret) {
      await db.close();
      return res.status(400).json({ success: false, message: 'Configure o 2FA primeiro' });
    }

    const tokenValido = authenticator.verify({ token, secret: usuario.twofa_secret });
    if (!tokenValido) {
      await db.close();
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    await db.run('UPDATE usuarios SET twofa_enabled = 1 WHERE id = ?', [usuario.id]);
    req.session.usuario.twofa_enabled = 1;
    await auditLog(req, '2fa_habilitado');
    await db.close();
    return res.json({ success: true, message: '2FA habilitado com sucesso' });
  } catch (error) {
    console.error('Erro ao habilitar 2FA:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao habilitar 2FA' });
  }
}

async function disable2FA(req, res) {
  const db = new Database();

  try {
    const { senha } = req.body;
    if (!senha) {
      return res.status(400).json({ success: false, message: 'Senha é obrigatória para desabilitar 2FA' });
    }

    await db.connect();
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario.id]);
    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      await db.close();
      return res.status(401).json({ success: false, message: 'Senha incorreta' });
    }

    await db.run('UPDATE usuarios SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?', [usuario.id]);
    req.session.usuario.twofa_enabled = 0;
    await auditLog(req, '2fa_desabilitado');
    await db.close();
    return res.json({ success: true, message: '2FA desabilitado com sucesso' });
  } catch (error) {
    console.error('Erro ao desabilitar 2FA:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao desabilitar 2FA' });
  }
}

async function verify2FA(req, res) {
  const db = new Database();

  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ success: false, message: 'Email e token são obrigatórios' });
    }

    await db.connect();
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE email = ?AND ativo = 1 AND twofa_enabled = 1',
      [sanitizarInput(email)]
    );

    if (!usuario) {
      await db.close();
      return res.status(401).json({ success: false, message: 'Usuário não encontrado ou 2FA não habilitado' });
    }

    const tokenValido = authenticator.verify({ token, secret: usuario.twofa_secret });
    if (!tokenValido) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await db.close();
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    await db.close();
    return res.json({ success: true, message: 'Token v?lido' });
  } catch (error) {
    console.error('Erro ao verificar 2FA:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao verificar 2FA' });
  }
}

async function getMe(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const usuario = await db.get(
      'SELECT id, nome, email, perfil, twofa_enabled, ultimo_login_em, criado_em FROM usuarios WHERE id = ?',
      [req.session.usuario.id]
    );

    if (!usuario) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const permissoes = await db.all(
      `SELECT p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ?AND up.concedido = 1
       ORDER BY p.modulo, p.descricao`,
      [usuario.id]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Dados do usuário recuperados com sucesso',
      data: { usuario, permissoes }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usu?rio:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao buscar dados do usu?rio' });
  }
}

async function requestPasswordReset(req, res) {
  const db = new Database();

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email ?obrigat?rio' });
    }

    const emailSanitizado = sanitizarInput(email);
    await db.connect();
    const usuario = await db.get('SELECT id, email, nome, ativo FROM usuarios WHERE email = ?', [emailSanitizado]);

    if (!usuario || !usuario.ativo) {
      await db.close();
      return res.json({
        success: true,
        message: 'Se o email existir e estiver ativo, um token de recupera?o foi gerado.'
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10) * 60000).toISOString();

    await db.run('UPDATE reset_tokens SET usado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?AND usado_em IS NULL', [usuario.id]);
    await db.run(
      'INSERT INTO reset_tokens (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)',
      [usuario.id, tokenHash, expiraEm]
    );

    await auditLog(req, 'reset_password_requested', { email: emailSanitizado });
    await db.close();

    const emailResult = await sendPasswordResetEmail({
      to: usuario.email,
      nome: usuario.nome,
      token,
      expiraEm
    });

    return res.json({
      success: true,
      message: emailResult.sent
        ?'Token de recupera?o gerado e enviado por email com sucesso'
        : 'Token de recupera?o gerado com sucesso',
      data: {
        token: emailResult.sent ?undefined : token,
        expira_em: expiraEm,
        email_enviado: emailResult.sent,
        instrucoes: emailResult.sent
          ?'Verifique sua caixa de entrada e use o token recebido para redefinir a senha.'
          : 'Use este token na tela de redefini?o de senha. Configure SMTP para envio autom?tico por email.'
      }
    });
  } catch (error) {
    console.error('Erro ao solicitar reset de senha:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao solicitar recupera?o de senha' });
  }
}

async function resetPassword(req, res) {
  const db = new Database();

  try {
    const { token, senhaNova, confirmarSenha } = req.body;
    if (!token || !senhaNova || !confirmarSenha) {
      return res.status(400).json({ success: false, message: 'Token e novas senhas s?o obrigat?rios' });
    }
    if (senhaNova !== confirmarSenha) {
      return res.status(400).json({ success: false, message: 'As senhas nao coincidem' });
    }

    const validacao = validarSenhaForte(senhaNova);
    if (!validacao.valida) {
      return res.status(400).json({ success: false, message: validacao.mensagem });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.connect();
    const registro = await db.get(
      `SELECT rt.*, u.email
       FROM reset_tokens rt
       INNER JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token_hash = ?AND rt.usado_em IS NULL`,
      [tokenHash]
    );

    if (!registro || new Date(registro.expira_em) < new Date()) {
      await db.close();
      return res.status(400).json({ success: false, message: 'Token inv?lido ou expirado' });
    }

    const historicoSenhas = await db.all(
      'SELECT senha_hash FROM historico_senhas WHERE usuario_id = ?ORDER BY criado_em DESC LIMIT ?',
      [registro.usuario_id, parseInt(process.env.PASSWORD_HISTORY_COUNT || '5', 10)]
    );

    for (const item of historicoSenhas) {
      if (await bcrypt.compare(senhaNova, item.senha_hash)) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Escolha uma senha diferente das ?ltimas utilizadas' });
      }
    }

    const senhaHash = await bcrypt.hash(senhaNova, getPasswordRounds());
    const senhaExpiraEm = new Date();
    senhaExpiraEm.setDate(senhaExpiraEm.getDate() + parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10));

    await db.run(
      `UPDATE usuarios
       SET senha_hash = ?, senha_expira_em = ?, forcar_troca_senha = 0, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [senhaHash, senhaExpiraEm.toISOString(), registro.usuario_id]
    );
    await db.run('INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)', [registro.usuario_id, senhaHash]);
    await db.run('UPDATE reset_tokens SET usado_em = CURRENT_TIMESTAMP WHERE id = ?', [registro.id]);

    await auditLog(req, 'reset_password_success', { email: registro.email });
    await db.close();
    return res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao redefinir senha' });
  }
}

module.exports = {
  login,
  listLoginUsers,
  logout,
  trocarSenha,
  setup2FA,
  enable2FA,
  disable2FA,
  verify2FA,
  getMe,
  requestPasswordReset,
  resetPassword
};
