const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public consultation - no authentication required
router.get('/consulta/:query', publicController.search);

module.exports = router;
