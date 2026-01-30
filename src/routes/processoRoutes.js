const express = require('express');
const router = express.Router();
const processoController = require('../controllers/processoController');
const {
    validateCreateProcesso,
    validateUpdateProcesso,
    validateMovimentacao,
    validateId,
    handleValidationErrors
} = require('../middleware/validation');

// Get all processes
router.get('/', processoController.listarProcessos);

// Get statistics
router.get('/estatisticas', processoController.obterEstatisticas);

// Get a single process
router.get('/:id', validateId, handleValidationErrors, processoController.obterProcesso);

// Create a new process
router.post('/', validateCreateProcesso, handleValidationErrors, processoController.criarProcesso);

// Update a process
router.put('/:id', validateUpdateProcesso, handleValidationErrors, processoController.atualizarProcesso);

// Delete a process
router.delete('/:id', validateId, handleValidationErrors, processoController.deletarProcesso);

// Add movimentacao to a process
router.post('/:id/movimentacoes', validateMovimentacao, handleValidationErrors, processoController.adicionarMovimentacao);

module.exports = router;
