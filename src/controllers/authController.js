const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { Database } = require('../database/init');
const { validarSenhaForte, sanitizarInput } = require('../middleware/validators');
const { registrarFalhaLogin, limparBloqueio } = require('../middleware/bruteForce');
const { auditLog } = require('../middleware/audit');

// Login
async function login(req, res) {
  const db = new Database();
  
  try {
    const { email, senha, totpToken } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Email/usuário e senha são obrigatórios'
      });
    }
    
    const emailSanitizado = sanitizarInput(email);
    await db.connect();
    
    // Buscar usuário por email OU nome
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE (email = ? OR nome = ?) AND ativo = 1',
      [emailSanitizado, emailSanitizado]
    );
    
    if (!usuario) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await registrarFalhaLogin(emailSanitizado, 'email');
      await auditLog(req, 'login_falha', { email: emailSanitizado, motivo: 'usuario_nao_encontrado' });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }
    
    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    
    if (!senhaValida) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await registrarFalhaLogin(emailSanitizado, 'email');
      await auditLog(req, 'login_falha', { email: emailSanitizado, motivo: 'senha_invalida' });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }
    
    // Verificar 2FA se habilitado
    if (usuario.twofa_enabled) {
      if (!totpToken) {
        await db.close();
        return res.status(200).json({
          success: true,
          requires2FA: true,
          message: 'Código 2FA necessário'
        });
      }
      
      const tokenValido = authenticator.verify({
        token: totpToken,
        secret: usuario.twofa_secret
      });
      
      if (!tokenValido) {
        await registrarFalhaLogin(req.ip || 'unknown', 'ip');
        await auditLog(req, 'login_falha', { email: emailSanitizado, motivo: '2fa_invalido' });
        await db.close();
        
        return res.status(401).json({
          success: false,
          message: 'Código 2FA inválido'
        });
      }
    }
    
    // Carregar permissões do usuário
    const permissoes = await db.all(
      `SELECT p.codigo 
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ? AND up.concedido = 1`,
      [usuario.id]
    );
    
    const codigosPermissoes = permissoes.map(p => p.codigo);
    
    // Atualizar último login
    await db.run(
      'UPDATE usuarios SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?',
      [usuario.id]
    );
    
    // Limpar bloqueios
    await limparBloqueio(req.ip || 'unknown', 'ip');
    await limparBloqueio(emailSanitizado, 'email');
    
    // Criar sessão
    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      forcar_troca_senha: usuario.forcar_troca_senha,
      senha_expira_em: usuario.senha_expira_em,
      twofa_enabled: usuario.twofa_enabled
    };
    
    req.session.permissoes = codigosPermissoes;
    
    await auditLog(req, 'login_sucesso', { email: emailSanitizado });
    await db.close();
    
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
        permissoes: codigosPermissoes,
        forcar_troca_senha: usuario.forcar_troca_senha === 1,
        senha_expira_em: usuario.senha_expira_em
      }
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar login'
    });
  }
}

// Logout
async function logout(req, res) {
  try {
    const usuarioEmail = req.session?.usuario?.email || 'unknown';
    
    await auditLog(req, 'logout', { email: usuarioEmail });
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Erro ao destruir sessão:', err);
        return res.status(500).json({
          success: false,
          message: 'Erro ao fazer logout'
        });
      }
      
      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    });
    
  } catch (error) {
    console.error('Erro no logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar logout'
    });
  }
}

// Trocar senha
async function trocarSenha(req, res) {
  const db = new Database();
  
  try {
    const { senhaAtual, senhaNova, confirmarSenha } = req.body;
    const usuarioId = req.session.usuario.id;
    
    if (!senhaAtual || !senhaNova || !confirmarSenha) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios'
      });
    }
    
    if (senhaNova !== confirmarSenha) {
      return res.status(400).json({
        success: false,
        message: 'As senhas não coincidem'
      });
    }
    
    // Validar complexidade da senha
    const validacao = validarSenhaForte(senhaNova);
    if (!validacao.valida) {
      return res.status(400).json({
        success: false,
        message: validacao.mensagem
      });
    }
    
    await db.connect();
    
    // Buscar usuário
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [usuarioId]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar senha atual
    const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    
    if (!senhaAtualValida) {
      await auditLog(req, 'troca_senha_falha', { motivo: 'senha_atual_invalida' });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }
    
    // Verificar histórico de senhas
    const historyCount = parseInt(process.env.PASSWORD_HISTORY_COUNT || '5');
    const historicoSenhas = await db.all(
      'SELECT senha_hash FROM historico_senhas WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT ?',
      [usuarioId, historyCount]
    );
    
    // Verificar se a nova senha já foi usada
    for (const historico of historicoSenhas) {
      const senhaJaUsada = await bcrypt.compare(senhaNova, historico.senha_hash);
      if (senhaJaUsada) {
        await db.close();
        return res.status(400).json({
          success: false,
          message: `Esta senha já foi utilizada. Escolha uma senha diferente das últimas ${historyCount}.`
        });
      }
    }
    
    // Hash da nova senha
    const novoHash = await bcrypt.hash(senhaNova, 10);
    
    // Calcular data de expiração
    const expiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90');
    const senhaExpiraEm = new Date();
    senhaExpiraEm.setDate(senhaExpiraEm.getDate() + expiryDays);
    
    // Atualizar senha
    await db.run(
      `UPDATE usuarios 
       SET senha_hash = ?, 
           senha_expira_em = ?,
           forcar_troca_senha = 0,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [novoHash, senhaExpiraEm.toISOString(), usuarioId]
    );
    
    // Adicionar ao histórico
    await db.run(
      'INSERT INTO historico_senhas (usuario_id, senha_hash) VALUES (?, ?)',
      [usuarioId, novoHash]
    );
    
    // Limpar histórico antigo
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
    
    // Atualizar sessão
    req.session.usuario.forcar_troca_senha = 0;
    req.session.usuario.senha_expira_em = senhaExpiraEm.toISOString();
    
    await auditLog(req, 'troca_senha_sucesso');
    await db.close();
    
    return res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao trocar senha:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar troca de senha'
    });
  }
}

// Setup 2FA - Gerar secret e QR code
async function setup2FA(req, res) {
  const db = new Database();
  
  try {
    const usuarioId = req.session.usuario.id;
    
    await db.connect();
    
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [usuarioId]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Gerar novo secret
    const secret = authenticator.generateSecret();
    
    // Gerar otpauth URL
    const otpauth = authenticator.keyuri(
      usuario.email,
      'Sistema de Processos',
      secret
    );
    
    // Gerar QR code
    const qrCodeDataURL = await QRCode.toDataURL(otpauth);
    
    // Salvar secret temporário (não habilitar ainda)
    await db.run(
      'UPDATE usuarios SET twofa_secret = ? WHERE id = ?',
      [secret, usuarioId]
    );
    
    await auditLog(req, '2fa_setup_iniciado');
    await db.close();
    
    return res.json({
      success: true,
      message: '2FA configurado. Escaneie o QR code com seu aplicativo autenticador.',
      data: {
        secret,
        qrCode: qrCodeDataURL
      }
    });
    
  } catch (error) {
    console.error('Erro ao configurar 2FA:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao configurar 2FA'
    });
  }
}

// Enable 2FA - Verificar token e habilitar
async function enable2FA(req, res) {
  const db = new Database();
  
  try {
    const { token } = req.body;
    const usuarioId = req.session.usuario.id;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token é obrigatório'
      });
    }
    
    await db.connect();
    
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [usuarioId]
    );
    
    if (!usuario || !usuario.twofa_secret) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Configure o 2FA primeiro'
      });
    }
    
    // Verificar token
    const tokenValido = authenticator.verify({
      token,
      secret: usuario.twofa_secret
    });
    
    if (!tokenValido) {
      await auditLog(req, '2fa_enable_falha', { motivo: 'token_invalido' });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    // Habilitar 2FA
    await db.run(
      'UPDATE usuarios SET twofa_enabled = 1 WHERE id = ?',
      [usuarioId]
    );
    
    // Atualizar sessão
    req.session.usuario.twofa_enabled = 1;
    
    await auditLog(req, '2fa_habilitado');
    await db.close();
    
    return res.json({
      success: true,
      message: '2FA habilitado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao habilitar 2FA:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao habilitar 2FA'
    });
  }
}

// Disable 2FA
async function disable2FA(req, res) {
  const db = new Database();
  
  try {
    const { senha } = req.body;
    const usuarioId = req.session.usuario.id;
    
    if (!senha) {
      return res.status(400).json({
        success: false,
        message: 'Senha é obrigatória para desabilitar 2FA'
      });
    }
    
    await db.connect();
    
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE id = ?',
      [usuarioId]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    
    if (!senhaValida) {
      await auditLog(req, '2fa_disable_falha', { motivo: 'senha_invalida' });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    // Desabilitar 2FA
    await db.run(
      'UPDATE usuarios SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?',
      [usuarioId]
    );
    
    // Atualizar sessão
    req.session.usuario.twofa_enabled = 0;
    
    await auditLog(req, '2fa_desabilitado');
    await db.close();
    
    return res.json({
      success: true,
      message: '2FA desabilitado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao desabilitar 2FA:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao desabilitar 2FA'
    });
  }
}

// Verify 2FA - Para verificação durante login
async function verify2FA(req, res) {
  const db = new Database();
  
  try {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: 'Email e token são obrigatórios'
      });
    }
    
    const emailSanitizado = sanitizarInput(email);
    await db.connect();
    
    const usuario = await db.get(
      'SELECT * FROM usuarios WHERE email = ? AND ativo = 1 AND twofa_enabled = 1',
      [emailSanitizado]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou 2FA não habilitado'
      });
    }
    
    // Verificar token
    const tokenValido = authenticator.verify({
      token,
      secret: usuario.twofa_secret
    });
    
    if (!tokenValido) {
      await registrarFalhaLogin(req.ip || 'unknown', 'ip');
      await auditLog(req, '2fa_verify_falha', { email: emailSanitizado });
      await db.close();
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    await auditLog(req, '2fa_verify_sucesso', { email: emailSanitizado });
    await db.close();
    
    return res.json({
      success: true,
      message: 'Token válido'
    });
    
  } catch (error) {
    console.error('Erro ao verificar 2FA:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar 2FA'
    });
  }
}

// Get current user info
async function getMe(req, res) {
  const db = new Database();
  
  try {
    const usuarioId = req.session.usuario.id;
    
    await db.connect();
    
    const usuario = await db.get(
      'SELECT id, nome, email, perfil, twofa_enabled, ultimo_login_em, criado_em FROM usuarios WHERE id = ?',
      [usuarioId]
    );
    
    if (!usuario) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Carregar permissões
    const permissoes = await db.all(
      `SELECT p.codigo, p.modulo, p.descricao
       FROM permissoes p
       INNER JOIN usuario_permissoes up ON up.permissao_id = p.id
       WHERE up.usuario_id = ? AND up.concedido = 1
       ORDER BY p.modulo, p.descricao`,
      [usuarioId]
    );
    
    await db.close();
    
    return res.json({
      success: true,
      message: 'Dados do usuário recuperados com sucesso',
      data: {
        usuario,
        permissoes
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    try {
      await db.close();
    } catch (e) {}
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do usuário'
    });
  }
}

module.exports = {
  login,
  logout,
  trocarSenha,
  setup2FA,
  enable2FA,
  disable2FA,
  verify2FA,
  getMe
};
