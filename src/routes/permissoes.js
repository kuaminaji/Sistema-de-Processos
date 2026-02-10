const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const permissoesController = require('../controllers/permissoesController');
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

// GET /api/permissoes - Listar todas as permissões (agrupadas por módulo)
router.get(
  '/',
  requireAuth,
  requireAdmin,
  auditMiddleware('listar_permissoes', 'permissoes'),
  permissoesController.listPermissoes
);

// GET /api/permissoes/usuario/:usuario_id - Obter permissões de um usuário
router.get(
  '/usuario/:usuario_id',
  requireAuth,
  requireAdmin,
  [
    param('usuario_id').isInt({ min: 1 }).withMessage('usuario_id deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  auditMiddleware('obter_permissoes_usuario', 'permissoes'),
  permissoesController.getUserPermissions
);

// PUT /api/permissoes/usuario/:usuario_id - Atualizar permissões de um usuário
router.put(
  '/usuario/:usuario_id',
  requireAuth,
  requireAdmin,
  [
    param('usuario_id').isInt({ min: 1 }).withMessage('usuario_id deve ser um número inteiro positivo'),
    body('permissao_ids').isArray().withMessage('permissao_ids deve ser um array')
      .custom((value) => {
        if (!value.every(id => Number.isInteger(id) && id > 0)) {
          throw new Error('Todos os IDs em permissao_ids devem ser números inteiros positivos');
        }
        return true;
      })
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_permissoes_usuario', 'permissoes'),
  permissoesController.updateUserPermissions
);

// POST /api/permissoes/usuario/:usuario_id/aplicar-perfil - Aplicar permissões por perfil
router.post(
  '/usuario/:usuario_id/aplicar-perfil',
  requireAuth,
  requireAdmin,
  [
    param('usuario_id').isInt({ min: 1 }).withMessage('usuario_id deve ser um número inteiro positivo'),
    body('perfil').notEmpty().withMessage('Perfil é obrigatório')
      .isIn(['admin', 'advogado']).withMessage('Perfil inválido')
  ],
  handleValidationErrors,
  auditMiddleware('aplicar_permissoes_por_perfil', 'permissoes'),
  permissoesController.applyPermissionsByPerfil
);

module.exports = router;
