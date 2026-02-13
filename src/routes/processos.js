const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const processosController = require('../controllers/processosController');
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

// GET /api/processos - Listar processos com paginação e filtros
router.get(
  '/',
  requireAuth,
  requirePermission('processos.view'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('numero').optional().isString().withMessage('Número do processo deve ser uma string'),
    query('autor').optional().isString().withMessage('Autor deve ser uma string'),
    query('reu').optional().isString().withMessage('Réu deve ser uma string'),
    query('status').optional().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'])
      .withMessage('Status inválido'),
    query('cliente_id').optional().isInt().withMessage('ID do cliente deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('listar_processos', 'processos'),
  processosController.list
);

// GET /api/processos/stats - Obter estatísticas
router.get(
  '/stats',
  requireAuth,
  requirePermission('processos.view'),
  auditMiddleware('estatisticas_processos', 'processos'),
  processosController.getStats
);

// GET /api/processos/search - Busca avançada
router.get(
  '/search',
  requireAuth,
  requirePermission('processos.view'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('query').optional().isString().withMessage('Query de busca deve ser uma string'),
    query('status').optional().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'])
      .withMessage('Status inválido'),
    query('tipo_acao').optional().isString().withMessage('Tipo de ação deve ser uma string'),
    query('data_inicio').optional().isISO8601().withMessage('Data de início deve estar no formato ISO8601'),
    query('data_fim').optional().isISO8601().withMessage('Data de fim deve estar no formato ISO8601'),
    query('cliente_id').optional().isInt().withMessage('ID do cliente deve ser um número inteiro'),
    query('valor_min').optional().isFloat({ min: 0 }).withMessage('Valor mínimo deve ser um número positivo'),
    query('valor_max').optional().isFloat({ min: 0 }).withMessage('Valor máximo deve ser um número positivo')
  ],
  handleValidationErrors,
  auditMiddleware('buscar_processos', 'processos'),
  processosController.search
);

// GET /api/processos/:id - Obter processo por ID com movimentações
router.get(
  '/:id',
  requireAuth,
  requirePermission('processos.view'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('visualizar_processo', 'processos'),
  processosController.getById
);

// POST /api/processos - Criar novo processo
router.post(
  '/',
  requireAuth,
  requirePermission('processos.create'),
  [
    body('numero_processo').trim().notEmpty().withMessage('Número do processo é obrigatório')
      .isLength({ min: 20, max: 25 }).withMessage('Número do processo deve ter 20 dígitos'),
    body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
      .isLength({ max: 255 }).withMessage('Título deve ter no máximo 255 caracteres'),
    body('descricao').optional().isString().withMessage('Descrição deve ser uma string'),
    body('autor').trim().notEmpty().withMessage('Autor é obrigatório')
      .isLength({ max: 255 }).withMessage('Autor deve ter no máximo 255 caracteres'),
    body('reu').trim().notEmpty().withMessage('Réu é obrigatório')
      .isLength({ max: 255 }).withMessage('Réu deve ter no máximo 255 caracteres'),
    body('status').notEmpty().withMessage('Status é obrigatório')
      .isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'])
      .withMessage('Status inválido'),
    body('tipo_acao').optional().isString().withMessage('Tipo de ação deve ser uma string')
      .isLength({ max: 100 }).withMessage('Tipo de ação deve ter no máximo 100 caracteres'),
    body('valor_causa').optional().isFloat({ min: 0 }).withMessage('Valor da causa deve ser um número positivo'),
    body('data_distribuicao').optional().isISO8601().withMessage('Data de distribuição deve estar no formato ISO8601'),
    body('vara').optional().isString().withMessage('Vara deve ser uma string')
      .isLength({ max: 100 }).withMessage('Vara deve ter no máximo 100 caracteres'),
    body('comarca').optional().isString().withMessage('Comarca deve ser uma string')
      .isLength({ max: 100 }).withMessage('Comarca deve ter no máximo 100 caracteres'),
    body('advogado_autor').optional().isString().withMessage('Advogado autor deve ser uma string')
      .isLength({ max: 255 }).withMessage('Advogado autor deve ter no máximo 255 caracteres'),
    body('advogado_reu').optional().isString().withMessage('Advogado réu deve ser uma string')
      .isLength({ max: 255 }).withMessage('Advogado réu deve ter no máximo 255 caracteres'),
    body('observacoes').optional().isString().withMessage('Observações devem ser uma string'),
    body('cliente_id').optional().isInt().withMessage('ID do cliente deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('criar_processo', 'processos'),
  processosController.create
);

// PUT /api/processos/:id - Atualizar processo
router.put(
  '/:id',
  requireAuth,
  requirePermission('processos.update'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro'),
    body('numero_processo').optional().trim().notEmpty().withMessage('Número do processo não pode ser vazio')
      .isLength({ min: 20, max: 25 }).withMessage('Número do processo deve ter 20 dígitos'),
    body('titulo').optional().trim().notEmpty().withMessage('Título não pode ser vazio')
      .isLength({ max: 255 }).withMessage('Título deve ter no máximo 255 caracteres'),
    body('descricao').optional().isString().withMessage('Descrição deve ser uma string'),
    body('autor').optional().trim().notEmpty().withMessage('Autor não pode ser vazio')
      .isLength({ max: 255 }).withMessage('Autor deve ter no máximo 255 caracteres'),
    body('reu').optional().trim().notEmpty().withMessage('Réu não pode ser vazio')
      .isLength({ max: 255 }).withMessage('Réu deve ter no máximo 255 caracteres'),
    body('status').optional()
      .isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado'])
      .withMessage('Status inválido'),
    body('tipo_acao').optional().isString().withMessage('Tipo de ação deve ser uma string')
      .isLength({ max: 100 }).withMessage('Tipo de ação deve ter no máximo 100 caracteres'),
    body('valor_causa').optional().isFloat({ min: 0 }).withMessage('Valor da causa deve ser um número positivo'),
    body('data_distribuicao').optional().isISO8601().withMessage('Data de distribuição deve estar no formato ISO8601'),
    body('vara').optional().isString().withMessage('Vara deve ser uma string')
      .isLength({ max: 100 }).withMessage('Vara deve ter no máximo 100 caracteres'),
    body('comarca').optional().isString().withMessage('Comarca deve ser uma string')
      .isLength({ max: 100 }).withMessage('Comarca deve ter no máximo 100 caracteres'),
    body('advogado_autor').optional().isString().withMessage('Advogado autor deve ser uma string')
      .isLength({ max: 255 }).withMessage('Advogado autor deve ter no máximo 255 caracteres'),
    body('advogado_reu').optional().isString().withMessage('Advogado réu deve ser uma string')
      .isLength({ max: 255 }).withMessage('Advogado réu deve ter no máximo 255 caracteres'),
    body('observacoes').optional().isString().withMessage('Observações devem ser uma string'),
    body('cliente_id').optional().isInt().withMessage('ID do cliente deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_processo', 'processos'),
  processosController.update
);

// DELETE /api/processos/:id - Excluir processo
router.delete(
  '/:id',
  requireAuth,
  requirePermission('processos.delete'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('excluir_processo', 'processos'),
  processosController.deleteProcesso
);

module.exports = router;
