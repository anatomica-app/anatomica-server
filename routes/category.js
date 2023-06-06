const express = require('express');

const categoryController = require('../controllers/category');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

/**
 * @swagger
 * /v1/quiz/category:
 *  get:
 *    summary: Fetch all the categories
 *    description: Retrieves all the categories without localization.
 *    tags:
 *      - Category
 *    responses:
 *      '200':
 *        description: Success response.
 *      '500':
 *        description: An internal server error.
 */
router.get('/', checkAuth, categoryController.getAllCategories);

/**
 * @swagger
 * /v1/quiz/category:
 *  post:
 *    summary: Fetch all the categories with language.
 *    description: Retrieves all the categories in the database with the given localization data.
 *    tags:
 *      - Category
 *    responses:
 *      '200':
 *        description: Success response.
 *      '500':
 *        description: An internal server error.
 */
router.post('/', checkAuth, categoryController.getAllCategoriesWithLanguage);

module.exports = router;