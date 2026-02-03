const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All user routes require admin
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', userController.list);
router.get('/:id', userController.get);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

module.exports = router;
