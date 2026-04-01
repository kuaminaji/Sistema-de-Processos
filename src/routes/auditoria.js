const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const auditoriaController = require('../controllers/auditoriaController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

// Middleware de validação de erros
function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erros de validação',
      errors: errors.array()
    });
  }
  
  next();
}

// GET /api/auditoria - Listar registros de auditoria com filtros
router.get(
  '/',
  requireAuth,
  requirePermission('auditoria.view'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('acao').optional().isString().withMessage('Ação deve ser uma string'),
    query('tela').optional().isString().withMessage('Tela deve ser uma string'),
    query('usuario_email').optional().isString().withMessage('Email do usuário deve ser uma string'),
    query('ip').optional().isString().withMessage('IP deve ser uma string'),
    query('status_http').optional().isInt().withMessage('Status HTTP deve ser um número inteiro'),
    query('data_inicio').optional().isISO8601().withMessage('Data de início deve estar no formato ISO8601'),
    query('data_fim').optional().isISO8601().withMessage('Data de fim deve estar no formato ISO8601')
  ],
  handleValidationErrors,
  auditMiddleware('listar_auditoria', 'auditoria'),
  auditoriaController.list
);

// GET /api/auditoria/stats - Obter estatísticas para charts
router.get(
  '/stats',
  requireAuth,
  requirePermission('auditoria.view'),
  [
    query('dias').optional().isInt({ min: 1, max: 365 }).withMessage('Dias deve ser entre 1 e 365')
  ],
  handleValidationErrors,
  auditMiddleware('estatisticas_auditoria', 'auditoria'),
  auditoriaController.getStats
);

// GET /api/auditoria/sla - Obter métricas de SLA (últimos 30 dias)
router.get(
  '/sla',
  requireAuth,
  requirePermission('auditoria.view'),
  auditMiddleware('metricas_sla', 'auditoria'),
  auditoriaController.getSLA
);

// GET /api/auditoria/anomalias - Detectar anomalias (últimos 7 dias)
router.get(
  '/anomalias',
  requireAuth,
  requirePermission('auditoria.view'),
  auditMiddleware('detectar_anomalias', 'auditoria'),
  auditoriaController.getAnomalias
);

module.exports = router;
