const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', authController.getCurrentUser);
router.post('/change-password', authController.changePassword);

module.exports = router;
