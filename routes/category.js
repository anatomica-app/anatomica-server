const express = require('express');

const categoryController = require('../controllers/category');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Fetching all the categories.
router.get('/', checkAuth, categoryController.getAllCategories);

// Fetching all the categories with language.
router.post('/', checkAuth, categoryController.getAllCategoriesWithLanguage);

module.exports = router;