const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const usuariosController = require('../controllers/usuariosController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
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

// GET /api/usuarios - Listar usuários (admin only)
router.get(
  '/',
  requireAuth,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Itens por página deve ser entre 1 e 100'),
    query('sortBy').optional().isString().withMessage('Campo de ordenação deve ser uma string'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Ordem deve ser ASC ou DESC'),
    query('perfil').optional().isIn(['admin', 'advogado']).withMessage('Perfil inválido'),
    query('ativo').optional().isBoolean().withMessage('Ativo deve ser um booleano')
  ],
  handleValidationErrors,
  auditMiddleware('listar_usuarios', 'usuarios'),
  usuariosController.list
);

// GET /api/usuarios/:id - Buscar usuário por ID
router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('visualizar_usuario', 'usuarios'),
  usuariosController.getById
);

// POST /api/usuarios - Criar novo usuário
router.post(
  '/',
  requireAuth,
  requireAdmin,
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
      .isLength({ max: 255 }).withMessage('Nome deve ter no máximo 255 caracteres'),
    body('email').trim().notEmpty().withMessage('Email é obrigatório')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    body('senha').notEmpty().withMessage('Senha é obrigatória')
      .isLength({ min: 10 }).withMessage('Senha deve ter no mínimo 10 caracteres'),
    body('perfil').notEmpty().withMessage('Perfil é obrigatório')
      .isIn(['admin', 'advogado']).withMessage('Perfil inválido'),
    body('ativo').optional().isBoolean().withMessage('Ativo deve ser um booleano')
  ],
  handleValidationErrors,
  auditMiddleware('criar_usuario', 'usuarios'),
  usuariosController.create
);

// PUT /api/usuarios/:id - Atualizar usuário
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo'),
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
      .isLength({ max: 255 }).withMessage('Nome deve ter no máximo 255 caracteres'),
    body('email').optional().trim().notEmpty().withMessage('Email não pode ser vazio')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    body('perfil').optional().isIn(['admin', 'advogado']).withMessage('Perfil inválido'),
    body('ativo').optional().isBoolean().withMessage('Ativo deve ser um booleano')
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_usuario', 'usuarios'),
  usuariosController.update
);

// DELETE /api/usuarios/:id - Excluir usuário
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('excluir_usuario', 'usuarios'),
  usuariosController.deleteUsuario
);

// PUT /api/usuarios/:id/activate - Ativar usuário
router.put(
  '/:id/activate',
  requireAuth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('ativar_usuario', 'usuarios'),
  usuariosController.activate
);

// PUT /api/usuarios/:id/deactivate - Desativar usuário
router.put(
  '/:id/deactivate',
  requireAuth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('desativar_usuario', 'usuarios'),
  usuariosController.deactivate
);

module.exports = router;
