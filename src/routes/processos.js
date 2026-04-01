const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const processosController = require('../controllers/processosController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { getUploadBaseDir } = require('../utils/storagePaths');

const router = express.Router();

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

function validateClienteDocumentos(value) {
  if (value === undefined || value === null || value === '') return true;

  let documentos = value;
  if (typeof value === 'string') {
    try {
      documentos = JSON.parse(value);
    } catch (error) {
      documentos = [value];
    }
  }

  if (!Array.isArray(documentos)) {
    documentos = [documentos];
  }

  if (!documentos.every((item) => typeof item === 'string')) {
    throw new Error('cliente_documentos deve conter apenas textos');
  }

  return true;
}

const uploadDir = getUploadBaseDir();
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || String(15 * 1024 * 1024), 10)
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Tipo de arquivo n?o permitido'));
      return;
    }
    cb(null, true);
  }
});

router.get(
  '/',
  requireAuth,
  requirePermission('processos.view'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('numero').optional().isString(),
    query('autor').optional().isString(),
    query('reu').optional().isString(),
    query('status').optional().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado']),
    query('prioridade').optional().isIn(['baixa', 'media', 'alta', 'urgente']),
    query('cliente_id').optional().isInt()
  ],
  handleValidationErrors,
  auditMiddleware('listar_processos', 'processos'),
  processosController.list
);

router.get('/stats', requireAuth, requirePermission('processos.view'), auditMiddleware('estatisticas_processos', 'processos'), processosController.getStats);
router.get('/notifications', requireAuth, requirePermission('processos.view'), auditMiddleware('notificacoes_processos', 'processos'), processosController.getNotifications);

router.get(
  '/search',
  requireAuth,
  requirePermission('processos.view'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('perPage').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('query').optional().isString(),
    query('status').optional().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado']),
    query('prioridade').optional().isIn(['baixa', 'media', 'alta', 'urgente']),
    query('tipo_acao').optional().isString(),
    query('data_inicio').optional().isISO8601(),
    query('data_fim').optional().isISO8601(),
    query('cliente_id').optional().isInt(),
    query('valor_min').optional().isFloat({ min: 0 }),
    query('valor_max').optional().isFloat({ min: 0 })
  ],
  handleValidationErrors,
  auditMiddleware('buscar_processos', 'processos'),
  processosController.search
);

router.get(
  '/:id',
  requireAuth,
  requirePermission('processos.view'),
  [param('id').isInt()],
  handleValidationErrors,
  auditMiddleware('visualizar_processo', 'processos'),
  processosController.getById
);

router.get(
  '/:id/anexos',
  requireAuth,
  requirePermission('processos.view'),
  [param('id').isInt()],
  handleValidationErrors,
  auditMiddleware('listar_anexos_processo', 'processos'),
  processosController.listAnexos
);

router.post(
  '/',
  requireAuth,
  requirePermission('processos.create'),
  [
    body('numero_processo').trim().notEmpty(),
    body('titulo').trim().notEmpty().isLength({ max: 255 }),
    body('descricao').optional().isString(),
    body('autor').trim().notEmpty().isLength({ max: 255 }),
    body('reu').trim().notEmpty().isLength({ max: 255 }),
    body('status').notEmpty().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado']),
    body('tipo_acao').optional().isString().isLength({ max: 100 }),
    body('valor_causa').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('data_distribuicao').optional({ values: 'falsy' }).isISO8601(),
    body('prazo_final').optional({ values: 'falsy' }).isISO8601(),
    body('prioridade').optional().isIn(['baixa', 'media', 'alta', 'urgente']),
    body('vara').optional().isString().isLength({ max: 100 }),
    body('comarca').optional().isString().isLength({ max: 100 }),
    body('advogado_autor').optional().isString().isLength({ max: 255 }),
    body('advogado_reu').optional().isString().isLength({ max: 255 }),
    body('observacoes').optional().isString(),
    body('cliente_id').optional({ values: 'falsy' }).isInt(),
    body('cliente_documentos').optional().custom(validateClienteDocumentos)
  ],
  handleValidationErrors,
  auditMiddleware('criar_processo', 'processos'),
  processosController.create
);

router.post(
  '/anexos-temporarios',
  requireAuth,
  requirePermission('processos.create'),
  upload.single('arquivo'),
  auditMiddleware('criar_anexo_temporario_processo', 'processos'),
  processosController.uploadTempAnexo
);

router.delete(
  '/anexos-temporarios',
  requireAuth,
  requirePermission('processos.create'),
  auditMiddleware('limpar_anexos_temporarios_processo', 'processos'),
  processosController.clearTempAnexos
);

router.delete(
  '/anexos-temporarios/:anexoId',
  requireAuth,
  requirePermission('processos.create'),
  [param('anexoId').isInt()],
  handleValidationErrors,
  auditMiddleware('excluir_anexo_temporario_processo', 'processos'),
  processosController.deleteTempAnexo
);

router.post(
  '/:id/anexos',
  requireAuth,
  requirePermission('processos.update'),
  [param('id').isInt()],
  handleValidationErrors,
  upload.single('arquivo'),
  auditMiddleware('criar_anexo_processo', 'processos'),
  processosController.uploadAnexo
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('processos.update'),
  [
    param('id').isInt(),
    body('numero_processo').optional().trim().notEmpty(),
    body('titulo').optional().trim().notEmpty().isLength({ max: 255 }),
    body('descricao').optional().isString(),
    body('autor').optional().trim().notEmpty().isLength({ max: 255 }),
    body('reu').optional().trim().notEmpty().isLength({ max: 255 }),
    body('status').optional().isIn(['distribuido', 'em_andamento', 'suspenso', 'arquivado', 'sentenciado', 'transitado_em_julgado']),
    body('tipo_acao').optional().isString().isLength({ max: 100 }),
    body('valor_causa').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('data_distribuicao').optional({ values: 'falsy' }).isISO8601(),
    body('prazo_final').optional({ values: 'falsy' }).isISO8601(),
    body('prioridade').optional().isIn(['baixa', 'media', 'alta', 'urgente']),
    body('vara').optional().isString().isLength({ max: 100 }),
    body('comarca').optional().isString().isLength({ max: 100 }),
    body('advogado_autor').optional().isString().isLength({ max: 255 }),
    body('advogado_reu').optional().isString().isLength({ max: 255 }),
    body('observacoes').optional().isString(),
    body('cliente_id').optional({ values: 'falsy' }).isInt(),
    body('cliente_documentos').optional().custom(validateClienteDocumentos)
  ],
  handleValidationErrors,
  auditMiddleware('atualizar_processo', 'processos'),
  processosController.update
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('processos.delete'),
  [param('id').isInt()],
  handleValidationErrors,
  auditMiddleware('excluir_processo', 'processos'),
  processosController.deleteProcesso
);

router.delete(
  '/:id/anexos/:anexoId',
  requireAuth,
  requirePermission('processos.update'),
  [param('id').isInt(), param('anexoId').isInt()],
  handleValidationErrors,
  auditMiddleware('excluir_anexo_processo', 'processos'),
  processosController.deleteAnexo
);

module.exports = router;
