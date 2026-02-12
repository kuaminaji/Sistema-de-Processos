const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

// GET /api/backup - Exportar todos os dados (backup)
router.get(
  '/',
  requireAuth,
  requirePermission('admin.backup'),
  auditMiddleware('backup_download', 'backup'),
  backupController.backup
);

// POST /api/backup/backup - Criar backup (alternative endpoint)
router.post(
  '/backup',
  requireAuth,
  requirePermission('admin.backup'),
  auditMiddleware('backup_create', 'backup'),
  backupController.backup
);

// POST /api/backup/restore - Restaurar dados do backup
router.post(
  '/restore',
  requireAuth,
  requirePermission('admin.restore'),
  auditMiddleware('backup_restore', 'backup'),
  backupController.restore
);

// POST /api/backup/reset - Resetar sistema
router.post(
  '/reset',
  requireAuth,
  requirePermission('admin.backup'),
  auditMiddleware('system_reset', 'sistema'),
  backupController.reset
);

module.exports = router;
