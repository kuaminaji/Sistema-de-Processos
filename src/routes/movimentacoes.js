const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const movimentacoesController = require('../controllers/movimentacoesController');
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

// GET /api/movimentacoes - Listar movimentações por processo_id
router.get(
  '/',
  requireAuth,
  requirePermission('movimentacoes.view'),
  [
    query('processo_id').notEmpty().withMessage('processo_id é obrigatório')
      .isInt({ min: 1 }).withMessage('processo_id deve ser um número inteiro positivo'),
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC')
  ],
  handleValidationErrors,
  auditMiddleware('listar_movimentacoes', 'movimentacoes'),
  movimentacoesController.list
);

// POST /api/movimentacoes - Criar nova movimentação
router.post(
  '/',
  requireAuth,
  requirePermission('movimentacoes.create'),
  [
    body('processo_id').notEmpty().withMessage('processo_id é obrigatório')
      .isInt({ min: 1 }).withMessage('processo_id deve ser um número inteiro positivo'),
    body('tipo').trim().notEmpty().withMessage('Tipo é obrigatório')
      .isLength({ max: 100 }).withMessage('Tipo deve ter no máximo 100 caracteres'),
    body('descricao').trim().notEmpty().withMessage('Descrição é obrigatória'),
    body('data_movimentacao').notEmpty().withMessage('Data da movimentação é obrigatória')
      .isISO8601().withMessage('Data da movimentação deve estar no formato ISO8601')
  ],
  handleValidationErrors,
  auditMiddleware('criar_movimentacao', 'movimentacoes'),
  movimentacoesController.create
);

// PUT /api/movimentacoes/:id - Atualizar movimentação
router.put(
  '/:id',
  requireAuth,
  requirePermission('movimentacoes.update'),
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo'),
    body('tipo').optional().trim().notEmpty().withMessage('Tipo não pode ser vazio')
      .isLength({ max: 100 }).withMessage('Tipo deve ter no máximo 100 caracteres'),
    body('descricao').optional().trim().notEmpty().withMessage('Descrição não pode ser vazia'),
    body('data_movimentacao').optional().isISO8601().withMessage('Data da movimentação deve estar no formato ISO8601')
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_movimentacao', 'movimentacoes'),
  movimentacoesController.update
);

// DELETE /api/movimentacoes/:id - Excluir movimentação
router.delete(
  '/:id',
  requireAuth,
  requirePermission('movimentacoes.delete'),
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('excluir_movimentacao', 'movimentacoes'),
  movimentacoesController.deleteMovimentacao
);

module.exports = router;
