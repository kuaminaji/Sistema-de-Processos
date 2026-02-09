// Middleware para verificar se o usuário está autenticado
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    return res.redirect('/login.html');
  }
  
  // Verificar se precisa trocar senha
  if (req.session.usuario.forcar_troca_senha && !req.path.includes('/trocar-senha')) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        success: false,
        message: 'Troca de senha obrigatória',
        requirePasswordChange: true
      });
    }
    return res.redirect('/trocar-senha.html');
  }
  
  // Verificar se a senha expirou
  if (req.session.usuario.senha_expira_em) {
    const expiraEm = new Date(req.session.usuario.senha_expira_em);
    if (expiraEm < new Date() && !req.path.includes('/trocar-senha')) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({
          success: false,
          message: 'Senha expirada. Troca de senha obrigatória',
          requirePasswordChange: true
        });
      }
      return res.redirect('/trocar-senha.html');
    }
  }
  
  next();
}

// Middleware para verificar permissões específicas
function requirePermission(...codigosPermissao) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    const usuario = req.session.usuario;
    
    // Admin tem todas as permissões
    if (usuario.perfil === 'admin') {
      return next();
    }
    
    // Verificar se usuário tem alguma das permissões necessárias
    const permissoesUsuario = req.session.permissoes || [];
    const temPermissao = codigosPermissao.some(codigo => 
      permissoesUsuario.includes(codigo)
    );
    
    if (!temPermissao) {
      return res.status(403).json({
        success: false,
        message: 'Permissão negada',
        requiredPermissions: codigosPermissao
      });
    }
    
    next();
  };
}

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação necessária'
    });
  }
  
  if (req.session.usuario.perfil !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a administradores'
    });
  }
  
  next();
}

module.exports = {
  requireAuth,
  requirePermission,
  requireAdmin
};
