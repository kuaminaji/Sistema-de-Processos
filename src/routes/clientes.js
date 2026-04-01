const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const clientesController = require('../controllers/clientesController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erros de valida?o',
      errors: errors.array()
    });
  }
  return next();
}

router.get(
  '/search',
  requireAuth,
  requirePermission('clientes.view'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('query').optional().isString()
  ],
  handleValidationErrors,
  auditMiddleware('buscar_clientes', 'clientes'),
  clientesController.search
);

router.get(
  '/',
  requireAuth,
  requirePermission('clientes.view'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('nome').optional().isString(),
    query('documento').optional().isString(),
    query('cpf').optional().isString(),
    query('tipo_documento').optional().isIn(['CPF', 'CNPJ'])
  ],
  handleValidationErrors,
  auditMiddleware('listar_clientes', 'clientes'),
  clientesController.list
);

router.get(
  '/:id',
  requireAuth,
  requirePermission('clientes.view'),
  [param('id').isInt()],
  handleValidationErrors,
  auditMiddleware('visualizar_cliente', 'clientes'),
  clientesController.getById
);

router.post(
  '/',
  requireAuth,
  requirePermission('clientes.create'),
  [
    body('nome').trim().notEmpty().isLength({ max: 255 }),
    body(['documento', 'cpf']).custom((value, { req }) => {
      if (!value && !req.body.documento && !req.body.cpf) {
        throw new Error('Documento ?obrigat?rio');
      }
      return true;
    }),
    body('tipo_documento').optional().isIn(['CPF', 'CNPJ']),
    body('email').optional({ values: 'falsy' }).trim().isEmail().isLength({ max: 255 }),
    body('whatsapp').optional({ values: 'falsy' }).trim().matches(/^[\d\s()+-]+$/),
    body('telefone_secundario').optional({ values: 'falsy' }).trim().matches(/^[\d\s()+-]+$/),
    body('endereco').optional().isString(),
    body('observacoes').optional().isString()
  ],
  handleValidationErrors,
  auditMiddleware('criar_cliente', 'clientes'),
  clientesController.create
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('clientes.update'),
  [
    param('id').isInt(),
    body('nome').optional().trim().notEmpty().isLength({ max: 255 }),
    body('documento').optional().isString(),
    body('cpf').optional().isString(),
    body('tipo_documento').optional().isIn(['CPF', 'CNPJ']),
    body('email').optional({ values: 'falsy' }).trim().isEmail().isLength({ max: 255 }),
    body('whatsapp').optional({ values: 'falsy' }).trim().matches(/^[\d\s()+-]+$/),
    body('telefone_secundario').optional({ values: 'falsy' }).trim().matches(/^[\d\s()+-]+$/),
    body('endereco').optional().isString(),
    body('observacoes').optional().isString()
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_cliente', 'clientes'),
  clientesController.update
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('clientes.delete'),
  [param('id').isInt()],
  handleValidationErrors,
  auditMiddleware('excluir_cliente', 'clientes'),
  clientesController.deleteCliente
);

module.exports = router;
