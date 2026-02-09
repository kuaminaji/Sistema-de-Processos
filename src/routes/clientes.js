const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const clientesController = require('../controllers/clientesController');
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

// GET /api/clientes/search - Busca avançada (deve vir antes de /:id)
router.get(
  '/search',
  requireAuth,
  requirePermission('clientes.view'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('query').optional().isString().withMessage('Query de busca deve ser uma string')
  ],
  handleValidationErrors,
  auditMiddleware('buscar_clientes', 'clientes'),
  clientesController.search
);

// GET /api/clientes - Listar clientes com paginação e filtros
router.get(
  '/',
  requireAuth,
  requirePermission('clientes.view'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('nome').optional().isString().withMessage('Nome deve ser uma string'),
    query('cpf').optional().isString().withMessage('CPF deve ser uma string')
  ],
  handleValidationErrors,
  auditMiddleware('listar_clientes', 'clientes'),
  clientesController.list
);

// GET /api/clientes/:id - Obter cliente por ID com processos associados
router.get(
  '/:id',
  requireAuth,
  requirePermission('clientes.view'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('visualizar_cliente', 'clientes'),
  clientesController.getById
);

// POST /api/clientes - Criar novo cliente
router.post(
  '/',
  requireAuth,
  requirePermission('clientes.create'),
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
      .isLength({ max: 255 }).withMessage('Nome deve ter no máximo 255 caracteres'),
    body('cpf').trim().notEmpty().withMessage('CPF é obrigatório')
      .matches(/^[\d.-]+$/).withMessage('CPF deve conter apenas números, pontos e traços'),
    body('email').optional().trim().isEmail().withMessage('Email inválido')
      .isLength({ max: 255 }).withMessage('Email deve ter no máximo 255 caracteres'),
    body('whatsapp').optional().trim().matches(/^[\d\s()+-]+$/).withMessage('WhatsApp deve conter apenas números e caracteres de formatação'),
    body('telefone_secundario').optional().trim().matches(/^[\d\s()+-]+$/).withMessage('Telefone secundário deve conter apenas números e caracteres de formatação'),
    body('endereco').optional().isString().withMessage('Endereço deve ser uma string'),
    body('observacoes').optional().isString().withMessage('Observações devem ser uma string')
  ],
  handleValidationErrors,
  auditMiddleware('criar_cliente', 'clientes'),
  clientesController.create
);

// PUT /api/clientes/:id - Atualizar cliente
router.put(
  '/:id',
  requireAuth,
  requirePermission('clientes.update'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro'),
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
      .isLength({ max: 255 }).withMessage('Nome deve ter no máximo 255 caracteres'),
    body('cpf').optional().trim().notEmpty().withMessage('CPF não pode ser vazio')
      .matches(/^[\d.-]+$/).withMessage('CPF deve conter apenas números, pontos e traços'),
    body('email').optional().trim().isEmail().withMessage('Email inválido')
      .isLength({ max: 255 }).withMessage('Email deve ter no máximo 255 caracteres'),
    body('whatsapp').optional().trim().matches(/^[\d\s()+-]+$/).withMessage('WhatsApp deve conter apenas números e caracteres de formatação'),
    body('telefone_secundario').optional().trim().matches(/^[\d\s()+-]+$/).withMessage('Telefone secundário deve conter apenas números e caracteres de formatação'),
    body('endereco').optional().isString().withMessage('Endereço deve ser uma string'),
    body('observacoes').optional().isString().withMessage('Observações devem ser uma string')
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_cliente', 'clientes'),
  clientesController.update
);

// DELETE /api/clientes/:id - Excluir cliente
router.delete(
  '/:id',
  requireAuth,
  requirePermission('clientes.delete'),
  [
    param('id').isInt().withMessage('ID deve ser um número inteiro')
  ],
  handleValidationErrors,
  auditMiddleware('excluir_cliente', 'clientes'),
  clientesController.deleteCliente
);

module.exports = router;
