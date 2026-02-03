const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { requireAuth } = require('../middleware/auth');

// Public route for consultation
router.get('/public/cpf/:cpf', clientController.getByCpf);

// Protected routes
router.use(requireAuth);

router.get('/', clientController.list);
router.get('/:id', clientController.get);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.delete('/:id', clientController.delete);
router.post('/:id/whatsapp', clientController.sendWhatsApp);

module.exports = router;
