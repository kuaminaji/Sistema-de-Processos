const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const publicController = require('../controllers/publicController');
const rateLimit = require('express-rate-limit');

function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erros de validacao',
      errors: errors.array()
    });
  }
  return next();
}

const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Muitas requisicoes. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown'
});

router.get(
  '/consultarPorDocumento/:documento',
  publicRateLimiter,
  [param('documento').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorDocumento
);

router.get(
  '/consultarPorCPF/:cpf',
  publicRateLimiter,
  [param('cpf').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorCPF
);

router.get(
  '/consultarPorNumero/:numero',
  publicRateLimiter,
  [param('numero').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorNumero
);

router.get(
  '/consultar-documento',
  publicRateLimiter,
  [query('documento').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorDocumento
);

router.get(
  '/consultar-cpf',
  publicRateLimiter,
  [query('cpf').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorCPF
);

router.get(
  '/consultar-numero',
  publicRateLimiter,
  [query('numero').notEmpty().isString()],
  handleValidationErrors,
  publicController.consultarPorNumero
);

module.exports = router;
