const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middlewares/check-auth');

const pool = require('../utilities/database');
const responseMessages = require('../utilities/responseMessages');

const subcategoryController = require('../controllers/subcategory');

// Fetching all the subcategories.
router.get('/', checkAuth,subcategoryController.getAllSubcategories);

// Fetching all the subcategories with language.
router.post('/', checkAuth, subcategoryController.getAllSubcategoriesWithLanguage);

// Fetching all the subcategories with the given category.
router.post('/withCategory', checkAuth, subcategoryController.getAllSubcategoriesWithGivenCategory);

// Fetching all the subcategories with category and the relevant topics to it.
router.post('/withCategory/withTopics', checkAuth, subcategoryController.getAllSubcategoriesWithGivenCategoryAndTopics);

// Fetching all the subcategories and the relevant topics to it.
router.post('/withTopics', checkAuth, subcategoryController.getAllSubcategoriesWithTopics);

module.exports = router;
