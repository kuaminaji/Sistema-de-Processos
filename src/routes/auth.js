const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { bruteForceProtection } = require('../middleware/bruteForce');
const { auditMiddleware } = require('../middleware/audit');

// Middleware condicional de CSRF
// Para endpoints de API (detectados por header), não usar CSRF
// Para formulários web tradicionais, CSRF será aplicado no app principal
function skipCSRFForAPI(req, res, next) {
  // Se for request de API (Accept: application/json ou Content-Type: application/json), pular CSRF
  const isAPIRequest = 
    req.headers.accept?.includes('application/json') || 
    req.headers['content-type']?.includes('application/json');
  
  if (isAPIRequest) {
    req.skipCSRF = true;
  }
  
  next();
}

// POST /login - Login com proteção contra brute force
// CSRF aplicado apenas para formulários web (não para API)
router.post(
  '/login',
  skipCSRFForAPI,
  bruteForceProtection('ip'),
  auditMiddleware('login_tentativa', 'auth'),
  authController.login
);

// POST /logout - Logout
router.post(
  '/logout',
  auditMiddleware('logout', 'auth'),
  authController.logout
);

// POST /trocar-senha - Trocar senha (requer autenticação)
router.post(
  '/trocar-senha',
  requireAuth,
  auditMiddleware('troca_senha_tentativa', 'auth'),
  authController.trocarSenha
);

// GET /me - Obter informações do usuário atual
router.get(
  '/me',
  requireAuth,
  auditMiddleware('me', 'auth'),
  authController.getMe
);

// GET /setup-2fa - Configurar 2FA (gerar QR code)
router.get(
  '/setup-2fa',
  requireAuth,
  auditMiddleware('setup_2fa', 'auth'),
  authController.setup2FA
);

// POST /enable-2fa - Habilitar 2FA
router.post(
  '/enable-2fa',
  requireAuth,
  auditMiddleware('enable_2fa', 'auth'),
  authController.enable2FA
);

// POST /disable-2fa - Desabilitar 2FA
router.post(
  '/disable-2fa',
  requireAuth,
  auditMiddleware('disable_2fa', 'auth'),
  authController.disable2FA
);

// POST /verify-2fa - Verificar código 2FA (durante login)
router.post(
  '/verify-2fa',
  bruteForceProtection('ip'),
  auditMiddleware('verify_2fa', 'auth'),
  authController.verify2FA
);

module.exports = router;
