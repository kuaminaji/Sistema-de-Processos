const express = require('express');
const router = express.Router();
const prazoController = require('../controllers/prazoController');
const { requireAuth } = require('../middleware/auth');

// Todas as rotas de prazos requerem autenticação
router.use(requireAuth);

// Rotas de prazos
router.get('/prazos', prazoController.list.bind(prazoController));
router.get('/prazos/urgentes', prazoController.getUrgentes.bind(prazoController));
router.get('/prazos/:id', prazoController.getById.bind(prazoController));
router.post('/prazos', prazoController.create.bind(prazoController));
router.put('/prazos/:id', prazoController.update.bind(prazoController));
router.delete('/prazos/:id', prazoController.delete.bind(prazoController));

module.exports = router;
