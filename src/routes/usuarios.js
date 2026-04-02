const express = require('express');
const { body, param, query } = require('express-validator');
const usuariosController = require('../controllers/usuariosController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { validarIdentificadorAcesso } = require('../middleware/validators');

const router = express.Router();
const PERFIS_VALIDOS = ['admin', 'advogado', 'secretaria', 'gestor'];

function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Erros de validacao', errors: errors.array() });
  }
  return next();
}

router.get('/', requireAuth, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('perPage').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['ASC', 'DESC']),
  query('perfil').optional().isIn(PERFIS_VALIDOS),
  query('ativo').optional().isBoolean()
], handleValidationErrors, auditMiddleware('listar_usuarios', 'usuarios'), usuariosController.list);

router.get('/:id', requireAuth, requireAdmin, [param('id').isInt({ min: 1 })], handleValidationErrors, auditMiddleware('visualizar_usuario', 'usuarios'), usuariosController.getById);

router.post('/', requireAuth, requireAdmin, [
  body('nome').trim().notEmpty().isLength({ max: 255 }),
  body('email').trim().notEmpty().isLength({ max: 255 }).custom((value) => {
    if (!validarIdentificadorAcesso(value)) {
      throw new Error('Identificador de acesso invalido');
    }
    return true;
  }),
  body('senha').notEmpty().isLength({ min: 6 }),
  body('perfil').notEmpty().isIn(PERFIS_VALIDOS),
  body('ativo').optional().isBoolean()
], handleValidationErrors, auditMiddleware('criar_usuario', 'usuarios'), usuariosController.create);

router.put('/:id', requireAuth, requireAdmin, [
  param('id').isInt({ min: 1 }),
  body('nome').optional().trim().notEmpty().isLength({ max: 255 }),
  body('email').optional().trim().notEmpty().isLength({ max: 255 }).custom((value) => {
    if (!validarIdentificadorAcesso(value)) {
      throw new Error('Identificador de acesso invalido');
    }
    return true;
  }),
  body('perfil').optional().isIn(PERFIS_VALIDOS),
  body('ativo').optional().isBoolean()
], handleValidationErrors, auditMiddleware('atualizar_usuario', 'usuarios'), usuariosController.update);

router.delete('/:id', requireAuth, requireAdmin, [param('id').isInt({ min: 1 })], handleValidationErrors, auditMiddleware('excluir_usuario', 'usuarios'), usuariosController.deleteUsuario);
router.put('/:id/activate', requireAuth, requireAdmin, [param('id').isInt({ min: 1 })], handleValidationErrors, auditMiddleware('ativar_usuario', 'usuarios'), usuariosController.activate);
router.put('/:id/deactivate', requireAuth, requireAdmin, [param('id').isInt({ min: 1 })], handleValidationErrors, auditMiddleware('desativar_usuario', 'usuarios'), usuariosController.deactivate);

module.exports = router;
