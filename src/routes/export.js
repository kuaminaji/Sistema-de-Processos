const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

// Exportar processos
router.get(
  '/processos/csv',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_processos_csv', 'export'),
  exportController.exportProcessosCSV
);

router.get(
  '/processos/excel',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_processos_excel', 'export'),
  exportController.exportProcessosExcel
);

router.get(
  '/processos/pdf',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_processos_pdf', 'export'),
  exportController.exportProcessosPDF
);

// Exportar auditoria
router.get(
  '/auditoria/csv',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_auditoria_csv', 'export'),
  exportController.exportAuditoriaCSV
);

router.get(
  '/auditoria/excel',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_auditoria_excel', 'export'),
  exportController.exportAuditoriaExcel
);

router.get(
  '/auditoria/pdf',
  requireAuth,
  requirePermission('admin.export'),
  auditMiddleware('export_auditoria_pdf', 'export'),
  exportController.exportAuditoriaPDF
);

module.exports = router;
