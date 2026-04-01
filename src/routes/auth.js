const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { bruteForceProtection } = require('../middleware/bruteForce');
const { auditMiddleware } = require('../middleware/audit');

function skipCSRFForAPI(req, res, next) {
  const isAPIRequest =
    req.headers.accept?.includes('application/json') ||
    req.headers['content-type']?.includes('application/json');

  if (isAPIRequest) {
    req.skipCSRF = true;
  }

  next();
}

router.get('/login-users', authController.listLoginUsers);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

router.post(
  '/login',
  skipCSRFForAPI,
  bruteForceProtection('ip'),
  bruteForceProtection('email'),
  auditMiddleware('login_tentativa', 'auth'),
  authController.login
);

router.post('/logout', auditMiddleware('logout', 'auth'), authController.logout);
router.post('/trocar-senha', requireAuth, auditMiddleware('troca_senha_tentativa', 'auth'), authController.trocarSenha);
router.get('/me', requireAuth, auditMiddleware('me', 'auth'), authController.getMe);
router.get('/setup-2fa', requireAuth, auditMiddleware('setup_2fa', 'auth'), authController.setup2FA);
router.post('/enable-2fa', requireAuth, auditMiddleware('enable_2fa', 'auth'), authController.enable2FA);
router.post('/disable-2fa', requireAuth, auditMiddleware('disable_2fa', 'auth'), authController.disable2FA);
router.post('/verify-2fa', bruteForceProtection('ip'), bruteForceProtection('email'), auditMiddleware('verify_2fa', 'auth'), authController.verify2FA);

module.exports = router;
