const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const publicController = require('../controllers/publicController');
const rateLimit = require('express-rate-limit');

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

// Rate limiter para consultas públicas (mais restritivo)
// 10 requisições a cada 15 minutos por IP
const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requisições
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Usar IP como chave
  keyGenerator: (req) => {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
});

// GET /api/public/consultarPorCPF/:cpf - Consultar processos por CPF (path parameter)
router.get(
  '/consultarPorCPF/:cpf',
  publicRateLimiter,
  [
    param('cpf').notEmpty().withMessage('CPF é obrigatório')
      .isString().withMessage('CPF deve ser uma string')
  ],
  handleValidationErrors,
  publicController.consultarPorCPF
);

// GET /api/public/consultarPorNumero/:numero - Consultar processo por número (path parameter)
router.get(
  '/consultarPorNumero/:numero',
  publicRateLimiter,
  [
    param('numero').notEmpty().withMessage('Número do processo é obrigatório')
      .isString().withMessage('Número do processo deve ser uma string')
  ],
  handleValidationErrors,
  publicController.consultarPorNumero
);

// Legacy routes with query parameters (for backward compatibility)
// GET /api/public/consultar-cpf?cpf=xxx
router.get(
  '/consultar-cpf',
  publicRateLimiter,
  [
    query('cpf').notEmpty().withMessage('CPF é obrigatório')
      .isString().withMessage('CPF deve ser uma string')
  ],
  handleValidationErrors,
  publicController.consultarPorCPF
);

// GET /api/public/consultar-numero?numero=xxx
router.get(
  '/consultar-numero',
  publicRateLimiter,
  [
    query('numero').notEmpty().withMessage('Número do processo é obrigatório')
      .isString().withMessage('Número do processo deve ser uma string')
  ],
  handleValidationErrors,
  publicController.consultarPorNumero
);

module.exports = router;
